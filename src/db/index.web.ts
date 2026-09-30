// Implementação web (localhost): mantém os dados em memória e salva no localStorage.
// Mesma interface do SQLite em index.ts, para as telas não precisarem saber a diferença.
import type {
  Exercicio,
  Ficha,
  FichaExercicio,
  Id,
  Repositorio,
  Serie,
  Sessao,
} from './types';

export * from './types';

const CHAVE = 'app-treino:v1';

interface Banco {
  seq: number;
  exercicios: Exercicio[];
  fichas: Ficha[];
  fichaExercicios: FichaExercicio[];
  sessoes: Sessao[];
  series: Serie[];
}

function vazio(): Banco {
  return { seq: 0, exercicios: [], fichas: [], fichaExercicios: [], sessoes: [], series: [] };
}

let banco: Banco | null = null;

function carregar(): Banco {
  if (banco) return banco;
  try {
    const salvo = globalThis.localStorage?.getItem(CHAVE);
    banco = salvo ? { ...vazio(), ...JSON.parse(salvo) } : vazio();
    // Dados salvos antes do campo `ordem` existir.
    for (const f of banco!.fichas) f.ordem ??= f.id;
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
      if (b.series.some((s) => s.exercicioId === id)) {
        throw new Error('Este exercício já tem treinos registrados e não pode ser apagado.');
      }
      b.exercicios = b.exercicios.filter((e) => e.id !== id);
      b.fichaExercicios = b.fichaExercicios.filter((fe) => fe.exercicioId !== id);
    }),

  listarFichas: () => ler((b) => [...b.fichas].sort((x, y) => x.ordem - y.ordem || x.id - y.id)),
  obterFicha: (id) => ler((b) => b.fichas.find((f) => f.id === id) ?? null),
  criarFicha: (dados) =>
    escrever((b) => {
      const ordem = Math.max(-1, ...b.fichas.map((f) => f.ordem)) + 1;
      const ficha = { id: novoId(b), ordem, criadaEm: Date.now(), ...dados };
      b.fichas.push(ficha);
      return { ...ficha };
    }),
  atualizarFicha: (id, dados) => escrever((b) => atualizarItem(b.fichas, id, dados)),
  removerFicha: (id) =>
    escrever((b) => {
      b.fichas = b.fichas.filter((f) => f.id !== id);
      b.fichaExercicios = b.fichaExercicios.filter((fe) => fe.fichaId !== id);
      for (const s of b.sessoes) if (s.fichaId === id) s.fichaId = null;
    }),
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
      const fe = { id: novoId(b), ordem: Math.max(-1, ...ordens) + 1, ...dados };
      b.fichaExercicios.push(fe);
      return { ...fe };
    }),
  atualizarExercicioDaFicha: (id, dados) =>
    escrever((b) => atualizarItem(b.fichaExercicios, id, dados)),
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
  obterSessao: (id) => ler((b) => b.sessoes.find((s) => s.id === id) ?? null),
  obterSessaoAtiva: () =>
    ler((b) => b.sessoes.filter((s) => s.fim === null).sort((x, y) => y.inicio - x.inicio)[0] ?? null),
  listarSessoes: (desde = 0) =>
    ler((b) => b.sessoes.filter((s) => s.inicio >= desde).sort((x, y) => y.inicio - x.inicio)),
  removerSessao: (id) =>
    escrever((b) => {
      b.sessoes = b.sessoes.filter((s) => s.id !== id);
      b.series = b.series.filter((s) => s.sessaoId !== id);
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
  ultimasSeriesDoExercicio: (exercicioId) =>
    ler((b) => {
      const encerradas = new Set(b.sessoes.filter((s) => s.fim !== null).map((s) => s.id));
      const doExercicio = b.series.filter((s) => s.exercicioId === exercicioId && encerradas.has(s.sessaoId));
      if (doExercicio.length === 0) return [];
      const ultima = doExercicio.reduce((a, s) => (s.concluidaEm > a.concluidaEm ? s : a));
      return doExercicio.filter((s) => s.sessaoId === ultima.sessaoId).sort((x, y) => x.numero - y.numero);
    }),
};
