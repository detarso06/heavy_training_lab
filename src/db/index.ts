// Implementação SQLite (iOS/Android). No web o Metro usa index.web.ts.
import * as SQLite from 'expo-sqlite';

import type {
  CardioFeito,
  Exercicio,
  Ficha,
  FichaExercicio,
  FichaExercicioDetalhe,
  Id,
  Perfil,
  Repositorio,
  Rotina,
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
  // Rotinas, tipos de série (as colunas antigas series/repeticoes viram as séries válidas),
  // vínculo com o catálogo wger e cache do catálogo.
  `
  CREATE TABLE rotinas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    descricao TEXT,
    ativa INTEGER NOT NULL DEFAULT 0,
    criada_em INTEGER NOT NULL
  );
  INSERT INTO rotinas (nome, ativa, criada_em)
    SELECT 'Minha rotina', 1, CAST(strftime('%s', 'now') AS INTEGER) * 1000
    WHERE EXISTS (SELECT 1 FROM fichas);
  ALTER TABLE fichas ADD COLUMN rotina_id INTEGER REFERENCES rotinas(id) ON DELETE CASCADE;
  UPDATE fichas SET rotina_id = (SELECT MIN(id) FROM rotinas);
  ALTER TABLE ficha_exercicios ADD COLUMN aquecimento_series INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE ficha_exercicios ADD COLUMN aquecimento_reps TEXT NOT NULL DEFAULT '';
  ALTER TABLE ficha_exercicios ADD COLUMN preparatoria_series INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE ficha_exercicios ADD COLUMN preparatoria_reps TEXT NOT NULL DEFAULT '';
  ALTER TABLE exercicios ADD COLUMN wger_id INTEGER;
  CREATE UNIQUE INDEX idx_exercicios_wger ON exercicios(wger_id) WHERE wger_id IS NOT NULL;
  CREATE TABLE cache (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);
  `,
  `
  CREATE TABLE perfil (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    nome TEXT,
    idade INTEGER,
    altura_cm REAL,
    peso_kg REAL,
    cardio_atividade TEXT,
    meta_cardio_min INTEGER,
    meta_agua_ml INTEGER
  );
  INSERT INTO perfil (id) VALUES (1);
  CREATE TABLE progresso_metas (
    tipo TEXT NOT NULL,
    periodo TEXT NOT NULL,
    valor REAL NOT NULL,
    PRIMARY KEY (tipo, periodo)
  );
  `,
  `
  ALTER TABLE perfil ADD COLUMN avatar TEXT;
  `,
  `
  ALTER TABLE series ADD COLUMN tipo TEXT NOT NULL DEFAULT 'validas';
  `,
  // Catálogo da wger abandonado (lista própria em src/lib/catalogo.ts). A coluna wger_id fica, sem uso.
  `
  DROP TABLE cache;
  `,
  `
  ALTER TABLE fichas ADD COLUMN descanso INTEGER NOT NULL DEFAULT 0;
  `,
  // Dia de cardio: atividade e minutos planejados (nulos nos treinos e descansos).
  `
  ALTER TABLE fichas ADD COLUMN cardio_atividade TEXT;
  ALTER TABLE fichas ADD COLUMN cardio_min INTEGER;
  `,
  // Cardio dentro do treino: item da lista de exercícios com minutos planejados, e o tempo feito na sessão.
  `
  ALTER TABLE ficha_exercicios ADD COLUMN cardio_min INTEGER;
  CREATE TABLE sessao_cardios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sessao_id INTEGER NOT NULL REFERENCES sessoes(id) ON DELETE CASCADE,
    exercicio_id INTEGER NOT NULL REFERENCES exercicios(id) ON DELETE RESTRICT,
    minutos INTEGER NOT NULL,
    concluido_em INTEGER NOT NULL
  );
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
const COLS_ROTINA = `id, nome, descricao, ativa, criada_em AS criadaEm`;
const COLS_FICHA = `id, rotina_id AS rotinaId, nome, descricao, ordem, descanso,
  cardio_atividade AS cardioAtividade, cardio_min AS cardioMin, criada_em AS criadaEm`;
const COLS_SESSAO = `id, ficha_id AS fichaId, nome, inicio, fim`;
const COLS_SERIE = `id, sessao_id AS sessaoId, exercicio_id AS exercicioId, numero, tipo, carga,
  repeticoes, concluida_em AS concluidaEm`;

type LinhaRotina = Omit<Rotina, 'ativa'> & { ativa: number };

function paraRotina({ ativa, ...r }: LinhaRotina): Rotina {
  return { ...r, ativa: ativa === 1 };
}

type LinhaFicha = Omit<Ficha, 'descanso' | 'cardio'> & {
  descanso: number;
  cardioAtividade: string | null;
  cardioMin: number | null;
};

function paraFicha({ descanso, cardioAtividade, cardioMin, ...f }: LinhaFicha): Ficha {
  const cardio = cardioAtividade === null ? null : { atividade: cardioAtividade, minutos: cardioMin ?? 0 };
  return { ...f, descanso: descanso === 1, cardio };
}

interface LinhaFichaExercicio {
  id: Id;
  fichaId: Id;
  exercicioId: Id;
  ordem: number;
  aqSeries: number;
  aqReps: string;
  prepSeries: number;
  prepReps: string;
  series: number;
  repeticoes: string;
  descansoSeg: number;
  cardioMin: number | null;
}

const COLS_FICHA_EXERCICIO = `fe.id, fe.ficha_id AS fichaId, fe.exercicio_id AS exercicioId, fe.ordem,
  fe.aquecimento_series AS aqSeries, fe.aquecimento_reps AS aqReps,
  fe.preparatoria_series AS prepSeries, fe.preparatoria_reps AS prepReps,
  fe.series, fe.repeticoes, fe.descanso_seg AS descansoSeg, fe.cardio_min AS cardioMin`;
const COLS_CARDIO = `id, sessao_id AS sessaoId, exercicio_id AS exercicioId, minutos, concluido_em AS concluidoEm`;

function paraFichaExercicio(l: LinhaFichaExercicio): FichaExercicio {
  return {
    id: l.id,
    fichaId: l.fichaId,
    exercicioId: l.exercicioId,
    ordem: l.ordem,
    aquecimento: { series: l.aqSeries, repeticoes: l.aqReps },
    preparatoria: { series: l.prepSeries, repeticoes: l.prepReps },
    validas: { series: l.series, repeticoes: l.repeticoes },
    descansoSeg: l.descansoSeg,
    cardioMin: l.cardioMin,
  };
}

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
    const usado = await db.getFirstAsync(
      'SELECT 1 FROM series WHERE exercicio_id = ? UNION ALL SELECT 1 FROM sessao_cardios WHERE exercicio_id = ? LIMIT 1',
      id,
      id
    );
    if (usado) throw new Error('Este exercício já tem treinos registrados e não pode ser apagado.');
    await db.runAsync('DELETE FROM exercicios WHERE id = ?', id);
  },

  async listarRotinas() {
    const db = await getDb();
    const linhas = await db.getAllAsync<LinhaRotina>(
      `SELECT ${COLS_ROTINA} FROM rotinas ORDER BY criada_em, id`
    );
    return linhas.map(paraRotina);
  },
  async obterRotina(id) {
    const db = await getDb();
    const l = await db.getFirstAsync<LinhaRotina>(`SELECT ${COLS_ROTINA} FROM rotinas WHERE id = ?`, id);
    return l ? paraRotina(l) : null;
  },
  async obterRotinaAtiva() {
    const db = await getDb();
    const l = await db.getFirstAsync<LinhaRotina>(
      `SELECT ${COLS_ROTINA} FROM rotinas WHERE ativa = 1 LIMIT 1`
    );
    return l ? paraRotina(l) : null;
  },
  async criarRotina(dados) {
    const db = await getDb();
    const criadaEm = Date.now();
    const existe = await db.getFirstAsync('SELECT 1 FROM rotinas LIMIT 1');
    const ativa = !existe;
    const r = await db.runAsync(
      'INSERT INTO rotinas (nome, descricao, ativa, criada_em) VALUES (?, ?, ?, ?)',
      dados.nome,
      dados.descricao,
      ativa ? 1 : 0,
      criadaEm
    );
    return { id: r.lastInsertRowId, ativa, criadaEm, ...dados };
  },
  atualizarRotina(id, dados) {
    return atualizar('rotinas', id, dados, { nome: 'nome', descricao: 'descricao' });
  },
  async ativarRotina(id) {
    const db = await getDb();
    await db.runAsync('UPDATE rotinas SET ativa = (id = ?)', id);
  },
  async removerRotina(id) {
    const db = await getDb();
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM rotinas WHERE id = ?', id);
      const ativa = await db.getFirstAsync('SELECT 1 FROM rotinas WHERE ativa = 1');
      if (!ativa) {
        await db.runAsync(
          'UPDATE rotinas SET ativa = 1 WHERE id = (SELECT id FROM rotinas ORDER BY criada_em, id LIMIT 1)'
        );
      }
    });
  },

  async listarFichas(rotinaId) {
    const db = await getDb();
    const linhas = await db.getAllAsync<LinhaFicha>(
      `SELECT ${COLS_FICHA} FROM fichas WHERE rotina_id = ? ORDER BY ordem, id`,
      rotinaId
    );
    return linhas.map(paraFicha);
  },
  async obterFicha(id) {
    const db = await getDb();
    const l = await db.getFirstAsync<LinhaFicha>(`SELECT ${COLS_FICHA} FROM fichas WHERE id = ?`, id);
    return l ? paraFicha(l) : null;
  },
  async criarFicha(dados) {
    const db = await getDb();
    const criadaEm = Date.now();
    const max = await db.getFirstAsync<{ m: number | null }>(
      'SELECT MAX(ordem) AS m FROM fichas WHERE rotina_id = ?',
      dados.rotinaId
    );
    const ordem = (max?.m ?? -1) + 1;
    const descanso = dados.descanso ?? false;
    const cardio = dados.cardio ?? null;
    const r = await db.runAsync(
      `INSERT INTO fichas (rotina_id, nome, descricao, ordem, descanso, cardio_atividade, cardio_min, criada_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      dados.rotinaId,
      dados.nome,
      dados.descricao,
      ordem,
      descanso ? 1 : 0,
      cardio?.atividade ?? null,
      cardio?.minutos ?? null,
      criadaEm
    );
    return { id: r.lastInsertRowId, ordem, criadaEm, ...dados, descanso, cardio };
  },
  atualizarFicha(id, { cardio, ...dados }) {
    const colunasCardio =
      cardio === undefined ? {} : { cardioAtividade: cardio?.atividade ?? null, cardioMin: cardio?.minutos ?? null };
    return atualizar(
      'fichas',
      id,
      { ...dados, ...colunasCardio },
      { nome: 'nome', descricao: 'descricao', cardioAtividade: 'cardio_atividade', cardioMin: 'cardio_min' }
    );
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
      LinhaFichaExercicio & Omit<Exercicio, 'id'> & { exId: Id }
    >(
      `SELECT ${COLS_FICHA_EXERCICIO},
         e.id AS exId, e.nome, e.grupo_muscular AS grupoMuscular, e.video_url AS videoUrl,
         e.observacoes
       FROM ficha_exercicios fe JOIN exercicios e ON e.id = fe.exercicio_id
       WHERE fe.ficha_id = ? ORDER BY fe.ordem`,
      fichaId
    );
    return linhas.map(
      ({ exId, nome, grupoMuscular, videoUrl, observacoes, ...fe }): FichaExercicioDetalhe => ({
        ...paraFichaExercicio(fe),
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
      `INSERT INTO ficha_exercicios (ficha_id, exercicio_id, ordem,
         aquecimento_series, aquecimento_reps, preparatoria_series, preparatoria_reps,
         series, repeticoes, descanso_seg, cardio_min)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      dados.fichaId,
      dados.exercicioId,
      ordem,
      dados.aquecimento.series,
      dados.aquecimento.repeticoes,
      dados.preparatoria.series,
      dados.preparatoria.repeticoes,
      dados.validas.series,
      dados.validas.repeticoes,
      dados.descansoSeg,
      dados.cardioMin ?? null
    );
    return { id: r.lastInsertRowId, ordem, ...dados, cardioMin: dados.cardioMin ?? null };
  },
  atualizarExercicioDaFicha(id, dados) {
    return atualizar(
      'ficha_exercicios',
      id,
      {
        aqSeries: dados.aquecimento?.series,
        aqReps: dados.aquecimento?.repeticoes,
        prepSeries: dados.preparatoria?.series,
        prepReps: dados.preparatoria?.repeticoes,
        series: dados.validas?.series,
        repeticoes: dados.validas?.repeticoes,
        descansoSeg: dados.descansoSeg,
        cardioMin: dados.cardioMin,
      },
      {
        aqSeries: 'aquecimento_series',
        aqReps: 'aquecimento_reps',
        prepSeries: 'preparatoria_series',
        prepReps: 'preparatoria_reps',
        series: 'series',
        repeticoes: 'repeticoes',
        descansoSeg: 'descanso_seg',
        cardioMin: 'cardio_min',
      }
    );
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
  async atualizarInicioSessao(id, inicio) {
    const db = await getDb();
    await db.runAsync('UPDATE sessoes SET inicio = ? WHERE id = ? AND fim IS NULL', inicio, id);
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
      `INSERT INTO series (sessao_id, exercicio_id, numero, tipo, carga, repeticoes, concluida_em)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      dados.sessaoId,
      dados.exercicioId,
      dados.numero,
      dados.tipo,
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
  async registrarCardio(dados) {
    const db = await getDb();
    const concluidoEm = Date.now();
    const r = await db.runAsync(
      'INSERT INTO sessao_cardios (sessao_id, exercicio_id, minutos, concluido_em) VALUES (?, ?, ?, ?)',
      dados.sessaoId,
      dados.exercicioId,
      dados.minutos,
      concluidoEm
    );
    return { id: r.lastInsertRowId, concluidoEm, ...dados };
  },
  async atualizarCardio(id, minutos) {
    const db = await getDb();
    await db.runAsync('UPDATE sessao_cardios SET minutos = ? WHERE id = ?', minutos, id);
  },
  async removerCardio(id) {
    const db = await getDb();
    await db.runAsync('DELETE FROM sessao_cardios WHERE id = ?', id);
  },
  async listarCardiosDaSessao(sessaoId) {
    const db = await getDb();
    return db.getAllAsync<CardioFeito>(
      `SELECT ${COLS_CARDIO} FROM sessao_cardios WHERE sessao_id = ? ORDER BY concluido_em`,
      sessaoId
    );
  },
  async ultimasSeriesDoExercicio(exercicioId, ignorarSessaoId = -1) {
    const db = await getDb();
    return db.getAllAsync<Serie>(
      `SELECT ${COLS_SERIE} FROM series
       WHERE exercicio_id = ? AND sessao_id = (
         SELECT s.sessao_id FROM series s JOIN sessoes ss ON ss.id = s.sessao_id
         WHERE s.exercicio_id = ? AND ss.fim IS NOT NULL AND ss.id != ?
         ORDER BY s.concluida_em DESC LIMIT 1
       )
       ORDER BY numero`,
      exercicioId,
      exercicioId,
      ignorarSessaoId
    );
  },

  async importarSessao(dados) {
    const db = await getDb();
    let id = 0;
    await db.withTransactionAsync(async () => {
      const r = await db.runAsync(
        'INSERT INTO sessoes (ficha_id, nome, inicio, fim) VALUES (?, ?, ?, ?)',
        dados.fichaId,
        dados.nome,
        dados.inicio,
        dados.fim
      );
      id = r.lastInsertRowId;
      for (const s of dados.series) {
        await db.runAsync(
          `INSERT INTO series (sessao_id, exercicio_id, numero, tipo, carga, repeticoes, concluida_em)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          id,
          s.exercicioId,
          s.numero,
          s.tipo,
          s.carga,
          s.repeticoes,
          s.concluidaEm
        );
      }
    });
    return { id, fichaId: dados.fichaId, nome: dados.nome, inicio: dados.inicio, fim: dados.fim };
  },
  async apagarDadosDeTreino() {
    const db = await getDb();
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        DELETE FROM series;
        DELETE FROM sessao_cardios;
        DELETE FROM sessoes;
        DELETE FROM ficha_exercicios;
        DELETE FROM fichas;
        DELETE FROM rotinas;
        DELETE FROM exercicios;
        DELETE FROM progresso_metas;
      `);
    });
  },

  async obterPerfil() {
    const db = await getDb();
    const p = await db.getFirstAsync<Perfil>(
      `SELECT nome, idade, altura_cm AS alturaCm, peso_kg AS pesoKg, cardio_atividade AS cardioAtividade,
         meta_cardio_min AS metaCardioMin, meta_agua_ml AS metaAguaMl, avatar
       FROM perfil WHERE id = 1`
    );
    return p!;
  },
  salvarPerfil(dados) {
    return atualizar('perfil', 1, dados, {
      nome: 'nome',
      idade: 'idade',
      alturaCm: 'altura_cm',
      pesoKg: 'peso_kg',
      cardioAtividade: 'cardio_atividade',
      metaCardioMin: 'meta_cardio_min',
      metaAguaMl: 'meta_agua_ml',
      avatar: 'avatar',
    });
  },
  async obterProgresso(tipo, periodo) {
    const db = await getDb();
    const l = await db.getFirstAsync<{ valor: number }>(
      'SELECT valor FROM progresso_metas WHERE tipo = ? AND periodo = ?',
      tipo,
      periodo
    );
    return l?.valor ?? 0;
  },
  async salvarProgresso(tipo, periodo, valor) {
    const db = await getDb();
    await db.runAsync(
      'INSERT OR REPLACE INTO progresso_metas (tipo, periodo, valor) VALUES (?, ?, ?)',
      tipo,
      periodo,
      valor
    );
  },
};
