// Implementação SQLite (iOS/Android). No web o Metro usa index.web.ts.
import * as SQLite from 'expo-sqlite';

import type {
  Exercicio,
  Ficha,
  FichaExercicio,
  FichaExercicioDetalhe,
  Id,
  Repositorio,
  Serie,
  Sessao,
} from './types';

export * from './types';

// Cada item é uma migração; a posição + 1 vira o PRAGMA user_version.
const MIGRACOES = [
  `
  CREATE TABLE exercicios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    grupo_muscular TEXT,
    video_url TEXT,
    observacoes TEXT
  );
  CREATE TABLE fichas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    descricao TEXT,
    criada_em INTEGER NOT NULL
  );
  CREATE TABLE ficha_exercicios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ficha_id INTEGER NOT NULL REFERENCES fichas(id) ON DELETE CASCADE,
    exercicio_id INTEGER NOT NULL REFERENCES exercicios(id) ON DELETE CASCADE,
    ordem INTEGER NOT NULL,
    series INTEGER NOT NULL,
    repeticoes TEXT NOT NULL,
    descanso_seg INTEGER NOT NULL
  );
  CREATE TABLE sessoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ficha_id INTEGER REFERENCES fichas(id) ON DELETE SET NULL,
    nome TEXT NOT NULL,
    inicio INTEGER NOT NULL,
    fim INTEGER
  );
  CREATE TABLE series (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sessao_id INTEGER NOT NULL REFERENCES sessoes(id) ON DELETE CASCADE,
    exercicio_id INTEGER NOT NULL REFERENCES exercicios(id) ON DELETE RESTRICT,
    numero INTEGER NOT NULL,
    carga REAL NOT NULL,
    repeticoes INTEGER NOT NULL,
    concluida_em INTEGER NOT NULL
  );
  CREATE INDEX idx_series_exercicio ON series(exercicio_id, concluida_em);
  CREATE INDEX idx_series_sessao ON series(sessao_id);
  `,
  `
  ALTER TABLE fichas ADD COLUMN ordem INTEGER NOT NULL DEFAULT 0;
  UPDATE fichas SET ordem = id;
  `,
];

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb() {
  dbPromise ??= (async () => {
    const db = await SQLite.openDatabaseAsync('treino.db');
    await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    const atual = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    let versao = atual?.user_version ?? 0;
    while (versao < MIGRACOES.length) {
      const sql = MIGRACOES[versao];
      const proxima = versao + 1;
      await db.withExclusiveTransactionAsync(async (tx) => {
        await tx.execAsync(`${sql}\nPRAGMA user_version = ${proxima};`);
      });
      versao = proxima;
    }
    return db;
  })();
  return dbPromise;
}

const COLS_EXERCICIO = `id, nome, grupo_muscular AS grupoMuscular, video_url AS videoUrl, observacoes`;
const COLS_FICHA = `id, nome, descricao, ordem, criada_em AS criadaEm`;
const COLS_SESSAO = `id, ficha_id AS fichaId, nome, inicio, fim`;
const COLS_SERIE = `id, sessao_id AS sessaoId, exercicio_id AS exercicioId, numero, carga,
  repeticoes, concluida_em AS concluidaEm`;

/** Monta "col = ?, col2 = ?" apenas com os campos presentes em `dados`. */
function montarUpdate(dados: Record<string, unknown>, colunas: Record<string, string>) {
  const sets: string[] = [];
  const valores: SQLite.SQLiteBindValue[] = [];
  for (const [campo, coluna] of Object.entries(colunas)) {
    if (dados[campo] !== undefined) {
      sets.push(`${coluna} = ?`);
      valores.push(dados[campo] as SQLite.SQLiteBindValue);
    }
  }
  return { sets: sets.join(', '), valores };
}

async function atualizar(
  tabela: string,
  id: Id,
  dados: Record<string, unknown>,
  colunas: Record<string, string>
) {
  const { sets, valores } = montarUpdate(dados, colunas);
  if (!sets) return;
  const db = await getDb();
  await db.runAsync(`UPDATE ${tabela} SET ${sets} WHERE id = ?`, ...valores, id);
}

export const repo: Repositorio = {
  async listarExercicios() {
    const db = await getDb();
    return db.getAllAsync<Exercicio>(
      `SELECT ${COLS_EXERCICIO} FROM exercicios ORDER BY nome COLLATE NOCASE`
    );
  },
  async criarExercicio(dados) {
    const db = await getDb();
    const r = await db.runAsync(
      'INSERT INTO exercicios (nome, grupo_muscular, video_url, observacoes) VALUES (?, ?, ?, ?)',
      dados.nome,
      dados.grupoMuscular,
      dados.videoUrl,
      dados.observacoes
    );
    return { id: r.lastInsertRowId, ...dados };
  },
  atualizarExercicio(id, dados) {
    return atualizar('exercicios', id, dados, {
      nome: 'nome',
      grupoMuscular: 'grupo_muscular',
      videoUrl: 'video_url',
      observacoes: 'observacoes',
    });
  },
  async removerExercicio(id) {
    const db = await getDb();
    const usado = await db.getFirstAsync('SELECT 1 FROM series WHERE exercicio_id = ? LIMIT 1', id);
    if (usado) throw new Error('Este exercício já tem treinos registrados e não pode ser apagado.');
    await db.runAsync('DELETE FROM exercicios WHERE id = ?', id);
  },

  async listarFichas() {
    const db = await getDb();
    return db.getAllAsync<Ficha>(`SELECT ${COLS_FICHA} FROM fichas ORDER BY ordem, id`);
  },
  async obterFicha(id) {
    const db = await getDb();
    return db.getFirstAsync<Ficha>(`SELECT ${COLS_FICHA} FROM fichas WHERE id = ?`, id);
  },
  async criarFicha(dados) {
    const db = await getDb();
    const criadaEm = Date.now();
    const max = await db.getFirstAsync<{ m: number | null }>('SELECT MAX(ordem) AS m FROM fichas');
    const ordem = (max?.m ?? -1) + 1;
    const r = await db.runAsync(
      'INSERT INTO fichas (nome, descricao, ordem, criada_em) VALUES (?, ?, ?, ?)',
      dados.nome,
      dados.descricao,
      ordem,
      criadaEm
    );
    return { id: r.lastInsertRowId, ordem, criadaEm, ...dados };
  },
  atualizarFicha(id, dados) {
    return atualizar('fichas', id, dados, { nome: 'nome', descricao: 'descricao' });
  },
  async removerFicha(id) {
    const db = await getDb();
    await db.runAsync('DELETE FROM fichas WHERE id = ?', id);
  },
  async reordenarFichas(idsNaOrdem) {
    const db = await getDb();
    await db.withTransactionAsync(async () => {
      for (const [ordem, id] of idsNaOrdem.entries()) {
        await db.runAsync('UPDATE fichas SET ordem = ? WHERE id = ?', ordem, id);
      }
    });
  },

  async listarExerciciosDaFicha(fichaId) {
    const db = await getDb();
    const linhas = await db.getAllAsync<
      FichaExercicio & Omit<Exercicio, 'id'> & { exId: Id }
    >(
      `SELECT fe.id, fe.ficha_id AS fichaId, fe.exercicio_id AS exercicioId, fe.ordem, fe.series,
         fe.repeticoes, fe.descanso_seg AS descansoSeg,
         e.id AS exId, e.nome, e.grupo_muscular AS grupoMuscular, e.video_url AS videoUrl,
         e.observacoes
       FROM ficha_exercicios fe JOIN exercicios e ON e.id = fe.exercicio_id
       WHERE fe.ficha_id = ? ORDER BY fe.ordem`,
      fichaId
    );
    return linhas.map(
      ({ exId, nome, grupoMuscular, videoUrl, observacoes, ...fe }): FichaExercicioDetalhe => ({
        ...fe,
        exercicio: { id: exId, nome, grupoMuscular, videoUrl, observacoes },
      })
    );
  },
  async adicionarExercicioNaFicha(dados) {
    const db = await getDb();
    const max = await db.getFirstAsync<{ m: number | null }>(
      'SELECT MAX(ordem) AS m FROM ficha_exercicios WHERE ficha_id = ?',
      dados.fichaId
    );
    const ordem = (max?.m ?? -1) + 1;
    const r = await db.runAsync(
      `INSERT INTO ficha_exercicios (ficha_id, exercicio_id, ordem, series, repeticoes, descanso_seg)
       VALUES (?, ?, ?, ?, ?, ?)`,
      dados.fichaId,
      dados.exercicioId,
      ordem,
      dados.series,
      dados.repeticoes,
      dados.descansoSeg
    );
    return { id: r.lastInsertRowId, ordem, ...dados };
  },
  atualizarExercicioDaFicha(id, dados) {
    return atualizar('ficha_exercicios', id, dados, {
      series: 'series',
      repeticoes: 'repeticoes',
      descansoSeg: 'descanso_seg',
    });
  },
  async removerExercicioDaFicha(id) {
    const db = await getDb();
    await db.runAsync('DELETE FROM ficha_exercicios WHERE id = ?', id);
  },
  async reordenarFicha(fichaId, idsNaOrdem) {
    const db = await getDb();
    await db.withTransactionAsync(async () => {
      for (const [ordem, id] of idsNaOrdem.entries()) {
        await db.runAsync(
          'UPDATE ficha_exercicios SET ordem = ? WHERE id = ? AND ficha_id = ?',
          ordem,
          id,
          fichaId
        );
      }
    });
  },

  async iniciarSessao(fichaId) {
    const db = await getDb();
    const ficha = await repo.obterFicha(fichaId);
    if (!ficha) throw new Error('Ficha não encontrada.');
    const inicio = Date.now();
    const r = await db.runAsync(
      'INSERT INTO sessoes (ficha_id, nome, inicio) VALUES (?, ?, ?)',
      fichaId,
      ficha.nome,
      inicio
    );
    return { id: r.lastInsertRowId, fichaId, nome: ficha.nome, inicio, fim: null };
  },
  async encerrarSessao(id) {
    const db = await getDb();
    await db.runAsync('UPDATE sessoes SET fim = ? WHERE id = ? AND fim IS NULL', Date.now(), id);
  },
  async obterSessao(id) {
    const db = await getDb();
    return db.getFirstAsync<Sessao>(`SELECT ${COLS_SESSAO} FROM sessoes WHERE id = ?`, id);
  },
  async obterSessaoAtiva() {
    const db = await getDb();
    return db.getFirstAsync<Sessao>(
      `SELECT ${COLS_SESSAO} FROM sessoes WHERE fim IS NULL ORDER BY inicio DESC LIMIT 1`
    );
  },
  async listarSessoes(desde = 0) {
    const db = await getDb();
    return db.getAllAsync<Sessao>(
      `SELECT ${COLS_SESSAO} FROM sessoes WHERE inicio >= ? ORDER BY inicio DESC`,
      desde
    );
  },
  async removerSessao(id) {
    const db = await getDb();
    await db.runAsync('DELETE FROM sessoes WHERE id = ?', id);
  },

  async registrarSerie(dados) {
    const db = await getDb();
    const concluidaEm = Date.now();
    const r = await db.runAsync(
      `INSERT INTO series (sessao_id, exercicio_id, numero, carga, repeticoes, concluida_em)
       VALUES (?, ?, ?, ?, ?, ?)`,
      dados.sessaoId,
      dados.exercicioId,
      dados.numero,
      dados.carga,
      dados.repeticoes,
      concluidaEm
    );
    return { id: r.lastInsertRowId, concluidaEm, ...dados };
  },
  atualizarSerie(id, dados) {
    return atualizar('series', id, dados, { carga: 'carga', repeticoes: 'repeticoes' });
  },
  async removerSerie(id) {
    const db = await getDb();
    await db.runAsync('DELETE FROM series WHERE id = ?', id);
  },
  async listarSeriesDaSessao(sessaoId) {
    const db = await getDb();
    return db.getAllAsync<Serie>(
      `SELECT ${COLS_SERIE} FROM series WHERE sessao_id = ? ORDER BY concluida_em`,
      sessaoId
    );
  },
  async ultimasSeriesDoExercicio(exercicioId) {
    const db = await getDb();
    return db.getAllAsync<Serie>(
      `SELECT ${COLS_SERIE} FROM series
       WHERE exercicio_id = ? AND sessao_id = (
         SELECT s.sessao_id FROM series s JOIN sessoes ss ON ss.id = s.sessao_id
         WHERE s.exercicio_id = ? AND ss.fim IS NOT NULL
         ORDER BY s.concluida_em DESC LIMIT 1
       )
       ORDER BY numero`,
      exercicioId,
      exercicioId
    );
  },
};
