// Implementação web (localhost): mantém os dados em memória e salva no localStorage.
// Mesma interface do SQLite em index.ts, para as telas não precisarem saber a diferença.
import type {
  CardioFeito,
  Exercicio,
  Ficha,
  FichaExercicio,
  Id,
  Perfil,
  Repositorio,
  Rotina,
  Serie,
  Sessao,
} from './types';

export * from './types';

const CHAVE = 'app-treino:v1';
// Cache do antigo catálogo da wger: apagado ao carregar.
const CHAVE_CATALOGO_ANTIGO = 'app-treino:catalogo';

interface Banco {
  seq: number;
  exercicios: Exercicio[];
  rotinas: Rotina[];
  fichas: Ficha[];
  fichaExercicios: FichaExercicio[];
  sessoes: Sessao[];
  series: Serie[];
  /** Cardio feito dentro das sessões de treino. */
  cardios: CardioFeito[];
  perfil: Perfil;
  /** Chave "tipo:periodo", ex.: "agua:2026-10-05". */
  progresso: Record<string, number>;
}

function vazio(): Banco {
  return {
    seq: 0,
    exercicios: [],
    rotinas: [],
    fichas: [],
    fichaExercicios: [],
    sessoes: [],
    series: [],
    cardios: [],
    perfil: perfilVazio(),
    progresso: {},
  };
}

function perfilVazio(): Perfil {
  return {
    nome: null,
    idade: null,
    alturaCm: null,
    pesoKg: null,
    cardioAtividade: null,
    metaCardioMin: null,
    metaAguaMl: null,
    avatar: null,
  };
}

/** Converte dados salvos por versões anteriores, como as migrações do SQLite. */
function migrar(b: Banco) {
  for (const f of b.fichas) {
    f.ordem ??= f.id;
    f.descanso ??= false;
    f.cardio ??= null;
  }

  const semRotina = b.fichas.filter((f) => f.rotinaId == null);
  if (semRotina.length > 0) {
    const rotina: Rotina = {
      id: ++b.seq,
      nome: 'Minha rotina',
      descricao: null,
      ativa: b.rotinas.length === 0,
      criadaEm: Date.now(),
    };
    b.rotinas.push(rotina);
    for (const f of semRotina) f.rotinaId = rotina.id;
  }

  for (const fe of b.fichaExercicios) {
    const antigo = fe as FichaExercicio & { series?: number; repeticoes?: string };
    if (antigo.validas) continue;
    fe.validas = { series: antigo.series ?? 0, repeticoes: antigo.repeticoes ?? '' };
    fe.aquecimento = { series: 0, repeticoes: '' };
    fe.preparatoria = { series: 0, repeticoes: '' };
    delete antigo.series;
    delete antigo.repeticoes;
  }

  for (const fe of b.fichaExercicios) fe.cardioMin ??= null;

  for (const e of b.exercicios) delete (e as Exercicio & { wgerId?: unknown }).wgerId;
  for (const s of b.series) s.tipo ??= 'validas';
  b.perfil = { ...perfilVazio(), ...b.perfil };
}

let banco: Banco | null = null;

function carregar(): Banco {
  if (banco) return banco;
  try {
    const salvo = globalThis.localStorage?.getItem(CHAVE);
    banco = salvo ? { ...vazio(), ...JSON.parse(salvo) } : vazio();
    migrar(banco!);
    globalThis.localStorage?.removeItem(CHAVE_CATALOGO_ANTIGO);
  } catch {
    banco = vazio();
  }
  return banco!;
}

function salvar() {
  try {
    globalThis.localStorage?.setItem(CHAVE, JSON.stringify(banco));
  } catch {
    // Sem armazenamento disponível (ex.: aba privada): segue só em memória.
  }
}

/** Executa uma alteração e persiste. */
async function escrever<T>(fn: (b: Banco) => T): Promise<T> {
  const r = fn(carregar());
  salvar();
  return r;
}

async function ler<T>(fn: (b: Banco) => T): Promise<T> {
  // Cópia profunda para as telas não alterarem o estado por engano.
  return structuredClone(fn(carregar()));
}

function novoId(b: Banco) {
  return ++b.seq;
}

function porNome<T extends { nome: string }>(a: T, b: T) {
  return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
}

function atualizarItem<T extends { id: Id }>(lista: T[], id: Id, dados: object) {
  const item = lista.find((x) => x.id === id);
  if (!item) return;
  for (const [k, v] of Object.entries(dados)) {
    if (v !== undefined) (item as Record<string, unknown>)[k] = v;
  }
}

function removerFichas(b: Banco, ids: Set<Id>) {
  b.fichas = b.fichas.filter((f) => !ids.has(f.id));
  b.fichaExercicios = b.fichaExercicios.filter((fe) => !ids.has(fe.fichaId));
  for (const s of b.sessoes) if (s.fichaId !== null && ids.has(s.fichaId)) s.fichaId = null;
}

export const repo: Repositorio = {
  listarExercicios: () => ler((b) => [...b.exercicios].sort(porNome)),
  criarExercicio: (dados) =>
    escrever((b) => {
      const ex = { id: novoId(b), ...dados };
      b.exercicios.push(ex);
      return { ...ex };
    }),
  atualizarExercicio: (id, dados) => escrever((b) => atualizarItem(b.exercicios, id, dados)),
  removerExercicio: (id) =>
    escrever((b) => {
      if (b.series.some((s) => s.exercicioId === id) || b.cardios.some((c) => c.exercicioId === id)) {
        throw new Error('Este exercício já tem treinos registrados e não pode ser apagado.');
      }
      b.exercicios = b.exercicios.filter((e) => e.id !== id);
      b.fichaExercicios = b.fichaExercicios.filter((fe) => fe.exercicioId !== id);
    }),

  listarRotinas: () =>
    ler((b) => [...b.rotinas].sort((x, y) => x.criadaEm - y.criadaEm || x.id - y.id)),
  obterRotina: (id) => ler((b) => b.rotinas.find((r) => r.id === id) ?? null),
  obterRotinaAtiva: () => ler((b) => b.rotinas.find((r) => r.ativa) ?? null),
  criarRotina: (dados) =>
    escrever((b) => {
      const rotina = { id: novoId(b), ativa: b.rotinas.length === 0, criadaEm: Date.now(), ...dados };
      b.rotinas.push(rotina);
      return { ...rotina };
    }),
  atualizarRotina: (id, dados) => escrever((b) => atualizarItem(b.rotinas, id, dados)),
  ativarRotina: (id) =>
    escrever((b) => {
      for (const r of b.rotinas) r.ativa = r.id === id;
    }),
  removerRotina: (id) =>
    escrever((b) => {
      b.rotinas = b.rotinas.filter((r) => r.id !== id);
      removerFichas(b, new Set(b.fichas.filter((f) => f.rotinaId === id).map((f) => f.id)));
      if (b.rotinas.length > 0 && !b.rotinas.some((r) => r.ativa)) {
        const primeira = [...b.rotinas].sort((x, y) => x.criadaEm - y.criadaEm || x.id - y.id)[0];
        primeira.ativa = true;
      }
    }),

  listarFichas: (rotinaId) =>
    ler((b) =>
      b.fichas.filter((f) => f.rotinaId === rotinaId).sort((x, y) => x.ordem - y.ordem || x.id - y.id)
    ),
  obterFicha: (id) => ler((b) => b.fichas.find((f) => f.id === id) ?? null),
  criarFicha: (dados) =>
    escrever((b) => {
      const ordens = b.fichas.filter((f) => f.rotinaId === dados.rotinaId).map((f) => f.ordem);
      const ficha: Ficha = {
        id: novoId(b),
        ordem: Math.max(-1, ...ordens) + 1,
        criadaEm: Date.now(),
        ...dados,
        descanso: dados.descanso ?? false,
        cardio: dados.cardio ?? null,
      };
      b.fichas.push(ficha);
      return { ...ficha };
    }),
  atualizarFicha: (id, dados) => escrever((b) => atualizarItem(b.fichas, id, dados)),
  removerFicha: (id) => escrever((b) => removerFichas(b, new Set([id]))),
  reordenarFichas: (idsNaOrdem) =>
    escrever((b) => {
      idsNaOrdem.forEach((id, ordem) => {
        const f = b.fichas.find((x) => x.id === id);
        if (f) f.ordem = ordem;
      });
    }),

  listarExerciciosDaFicha: (fichaId) =>
    ler((b) =>
      b.fichaExercicios
        .filter((fe) => fe.fichaId === fichaId)
        .sort((x, y) => x.ordem - y.ordem)
        .flatMap((fe) => {
          const exercicio = b.exercicios.find((e) => e.id === fe.exercicioId);
          return exercicio ? [{ ...fe, exercicio }] : [];
        })
    ),
  adicionarExercicioNaFicha: (dados) =>
    escrever((b) => {
      const ordens = b.fichaExercicios.filter((fe) => fe.fichaId === dados.fichaId).map((fe) => fe.ordem);
      const fe = {
        id: novoId(b),
        ordem: Math.max(-1, ...ordens) + 1,
        ...structuredClone(dados),
        cardioMin: dados.cardioMin ?? null,
      };
      b.fichaExercicios.push(fe);
      return structuredClone(fe);
    }),
  atualizarExercicioDaFicha: (id, dados) =>
    escrever((b) => atualizarItem(b.fichaExercicios, id, structuredClone(dados))),
  removerExercicioDaFicha: (id) =>
    escrever((b) => {
      b.fichaExercicios = b.fichaExercicios.filter((fe) => fe.id !== id);
    }),
  reordenarFicha: (fichaId, idsNaOrdem) =>
    escrever((b) => {
      idsNaOrdem.forEach((id, ordem) => {
        const fe = b.fichaExercicios.find((x) => x.id === id && x.fichaId === fichaId);
        if (fe) fe.ordem = ordem;
      });
    }),

  iniciarSessao: (fichaId) =>
    escrever((b) => {
      const ficha = b.fichas.find((f) => f.id === fichaId);
      if (!ficha) throw new Error('Ficha não encontrada.');
      const sessao: Sessao = { id: novoId(b), fichaId, nome: ficha.nome, inicio: Date.now(), fim: null };
      b.sessoes.push(sessao);
      return { ...sessao };
    }),
  encerrarSessao: (id) =>
    escrever((b) => {
      const s = b.sessoes.find((x) => x.id === id);
      if (s && s.fim === null) s.fim = Date.now();
    }),
  atualizarInicioSessao: (id, inicio) =>
    escrever((b) => {
      const s = b.sessoes.find((x) => x.id === id);
      if (s && s.fim === null) s.inicio = inicio;
    }),
  obterSessao: (id) => ler((b) => b.sessoes.find((s) => s.id === id) ?? null),
  obterSessaoAtiva: () =>
    ler((b) => b.sessoes.filter((s) => s.fim === null).sort((x, y) => y.inicio - x.inicio)[0] ?? null),
  listarSessoes: (desde = 0) =>
    ler((b) => b.sessoes.filter((s) => s.inicio >= desde).sort((x, y) => y.inicio - x.inicio)),
  removerSessao: (id) =>
    escrever((b) => {
      b.sessoes = b.sessoes.filter((s) => s.id !== id);
      b.series = b.series.filter((s) => s.sessaoId !== id);
      b.cardios = b.cardios.filter((c) => c.sessaoId !== id);
    }),

  registrarSerie: (dados) =>
    escrever((b) => {
      const serie = { id: novoId(b), concluidaEm: Date.now(), ...dados };
      b.series.push(serie);
      return { ...serie };
    }),
  atualizarSerie: (id, dados) => escrever((b) => atualizarItem(b.series, id, dados)),
  removerSerie: (id) =>
    escrever((b) => {
      b.series = b.series.filter((s) => s.id !== id);
    }),
  listarSeriesDaSessao: (sessaoId) =>
    ler((b) => b.series.filter((s) => s.sessaoId === sessaoId).sort((x, y) => x.concluidaEm - y.concluidaEm)),
  registrarCardio: (dados) =>
    escrever((b) => {
      const cardio = { id: novoId(b), concluidoEm: Date.now(), ...dados };
      b.cardios.push(cardio);
      return { ...cardio };
    }),
  atualizarCardio: (id, minutos) => escrever((b) => atualizarItem(b.cardios, id, { minutos })),
  removerCardio: (id) =>
    escrever((b) => {
      b.cardios = b.cardios.filter((c) => c.id !== id);
    }),
  listarCardiosDaSessao: (sessaoId) =>
    ler((b) => b.cardios.filter((c) => c.sessaoId === sessaoId).sort((x, y) => x.concluidoEm - y.concluidoEm)),
  ultimasSeriesDoExercicio: (exercicioId, ignorarSessaoId) =>
    ler((b) => {
      const encerradas = new Set(
        b.sessoes.filter((s) => s.fim !== null && s.id !== ignorarSessaoId).map((s) => s.id)
      );
      const doExercicio = b.series.filter((s) => s.exercicioId === exercicioId && encerradas.has(s.sessaoId));
      if (doExercicio.length === 0) return [];
      const ultima = doExercicio.reduce((a, s) => (s.concluidaEm > a.concluidaEm ? s : a));
      return doExercicio.filter((s) => s.sessaoId === ultima.sessaoId).sort((x, y) => x.numero - y.numero);
    }),

  importarSessao: ({ series, ...dados }) =>
    escrever((b) => {
      const sessao: Sessao = { id: novoId(b), ...dados };
      b.sessoes.push(sessao);
      for (const s of series) b.series.push({ id: novoId(b), sessaoId: sessao.id, ...s });
      return { ...sessao };
    }),
  apagarDadosDeTreino: () =>
    escrever((b) => {
      Object.assign(b, {
        exercicios: [],
        rotinas: [],
        fichas: [],
        fichaExercicios: [],
        sessoes: [],
        series: [],
        cardios: [],
        progresso: {},
      });
    }),

  obterPerfil: () => ler((b) => b.perfil),
  salvarPerfil: (dados) =>
    escrever((b) => {
      for (const [k, v] of Object.entries(dados)) {
        if (v !== undefined) (b.perfil as unknown as Record<string, unknown>)[k] = v;
      }
    }),
  obterProgresso: (tipo, periodo) => ler((b) => b.progresso[`${tipo}:${periodo}`] ?? 0),
  salvarProgresso: (tipo, periodo, valor) =>
    escrever((b) => {
      b.progresso[`${tipo}:${periodo}`] = valor;
    }),
};
