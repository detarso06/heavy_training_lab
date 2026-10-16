// Relatório da Evolução: números do período e séries válidas por músculo (mapa do corpo).
// `somarTrabalho` também serve para o plano de um treino (tela do treino).
import { repo, type Exercicio, type Serie, type Sessao } from '@/db';
import {
  DIVISOES,
  FAMILIA_DA_REGIAO,
  MUSCULOS,
  familiasDoExercicio,
  regioesDoExercicio,
  trabalhoDoExercicio,
  type Familia,
  type Musculo,
  type Regiao,
} from '@/lib/musculos';
import { inicioDaSemana } from '@/lib/rodizio';
import { volume } from '@/lib/sessao';

export type Periodo = 'hoje' | 'semana' | 'mes';

export const NOME_PERIODO: Record<Periodo, string> = { hoje: 'Hoje', semana: 'Semana', mes: 'Mês' };

/** Séries válidas por semana consideradas o mínimo por músculo (comum para hipertrofia). */
const SERIES_POR_SEMANA = 10;
const DIA_MS = 24 * 60 * 60 * 1000;

export function inicioDoPeriodo(periodo: Periodo, agora: Date): number {
  if (periodo === 'semana') return inicioDaSemana(agora);
  if (periodo === 'mes') return new Date(agora.getFullYear(), agora.getMonth(), 1).getTime();
  return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();
}

export interface TrabalhoSomado {
  /** Séries por músculo (fracionadas), na ordem de `MUSCULOS`. */
  porMusculo: { musculo: Musculo; series: number }[];
  /** Séries por região dos músculos com divisões (ver `DIVISOES`). */
  porRegiao: Map<Regiao, number>;
  /** Séries de exercícios sem grupo muscular, que não entram no mapa. */
  semGrupo: number;
  /** Movimentos que aparecem (empurrar/puxar), para só cobrar partes do mesmo tipo num treino. */
  familias: Set<Familia>;
}

/** Soma o trabalho de cada músculo e região para uma lista de (exercício, quantidade de séries válidas). */
export function somarTrabalho(itens: { exercicio: Exercicio; series: number }[]): TrabalhoSomado {
  const contagem = new Map<Musculo, number>(MUSCULOS.map((m) => [m, 0]));
  const porRegiao = new Map<Regiao, number>();
  const familias = new Set<Familia>();
  let semGrupo = 0;
  for (const { exercicio, series } of itens) {
    if (series <= 0) continue;
    for (const f of familiasDoExercicio(exercicio)) familias.add(f);
    const t = trabalhoDoExercicio(exercicio);
    if (!t) {
      semGrupo += series;
      continue;
    }
    for (const [musculo, peso] of Object.entries(t) as [Musculo, number][]) {
      contagem.set(musculo, contagem.get(musculo)! + peso * series);
    }
    for (const [regiao, peso] of Object.entries(regioesDoExercicio(exercicio)) as [Regiao, number][]) {
      porRegiao.set(regiao, (porRegiao.get(regiao) ?? 0) + peso * series);
    }
  }
  return {
    porMusculo: [...contagem].map(([musculo, series]) => ({ musculo, series })),
    porRegiao,
    semGrupo,
    familias,
  };
}

export interface Relatorio extends TrabalhoSomado {
  /** Sessões concluídas com pelo menos uma série (dias de descanso não contam). */
  treinos: number;
  /** Séries válidas de verdade (sem fração). */
  validas: number;
  volume: number;
  tempoMs: number;
  /**
   * Séries esperadas por músculo até agora: 10 por semana, proporcional aos dias já passados (na terça,
   * ~2,9; no domingo, 10). Nula em "Hoje", que não cobra nada de quem não foi treinado no dia.
   */
  esperado: number | null;
  /** Divisor para a intensidade de cada músculo (0 a 1): o esperado ou, em "Hoje", o mais treinado. */
  escala: number;
  /** Músculos com menos da metade do esperado, do menos treinado para o mais. */
  precisamFoco: Musculo[];
}

/** @param diasDecorridos dias do período até agora (ex.: terça = 2 na semana). */
export function montarRelatorio(
  periodo: Periodo,
  sessoes: Sessao[],
  seriesPorSessao: Map<number, Serie[]>,
  exercicios: Exercicio[],
  diasDecorridos: number
): Relatorio {
  const porId = new Map(exercicios.map((e) => [e.id, e]));
  const validasPorExercicio = new Map<number, number>();
  let treinos = 0;
  let validas = 0;
  let kg = 0;
  let tempoMs = 0;

  for (const sessao of sessoes) {
    const series = seriesPorSessao.get(sessao.id) ?? [];
    if (sessao.fim === null || series.length === 0) continue;
    treinos++;
    tempoMs += sessao.fim - sessao.inicio;
    kg += volume(series);
    for (const s of series) {
      if (s.tipo !== 'validas') continue;
      validas++;
      validasPorExercicio.set(s.exercicioId, (validasPorExercicio.get(s.exercicioId) ?? 0) + 1);
    }
  }

  const somado = somarTrabalho(
    [...validasPorExercicio].flatMap(([id, series]) => {
      const exercicio = porId.get(id);
      return exercicio ? [{ exercicio, series }] : [];
    })
  );
  const maior = Math.max(0, ...somado.porMusculo.map((m) => m.series));
  const esperado = periodo === 'hoje' ? null : (SERIES_POR_SEMANA * diasDecorridos) / 7;
  // Sem nenhuma série no período não há o que comparar.
  const precisamFoco =
    esperado === null || validas === 0
      ? []
      : somado.porMusculo
          .filter((m) => m.series < esperado / 2)
          .sort((a, b) => a.series - b.series)
          .map((m) => m.musculo);
  return {
    ...somado,
    treinos,
    validas,
    volume: kg,
    tempoMs,
    esperado,
    escala: Math.max(1, esperado ?? maior),
    precisamFoco,
  };
}

export async function carregarRelatorio(periodo: Periodo, agora = new Date()) {
  const desde = inicioDoPeriodo(periodo, agora);
  const [sessoes, exercicios] = await Promise.all([repo.listarSessoes(desde), repo.listarExercicios()]);
  const concluidas = sessoes.filter((s) => s.fim !== null);
  const series = await Promise.all(concluidas.map((s) => repo.listarSeriesDaSessao(s.id)));
  return montarRelatorio(
    periodo,
    concluidas,
    new Map(concluidas.map((s, i) => [s.id, series[i]])),
    exercicios,
    Math.max(1, Math.ceil((agora.getTime() - desde) / DIA_MS))
  );
}

export interface AnaliseDivisao {
  musculo: Musculo;
  total: number;
  regioes: { regiao: Regiao; nome: string; completo: string; series: number }[];
  /** Nula se o músculo não teve séries no período. */
  maisFocada: Regiao | null;
  /** Regiões com menos da metade das séries da mais focada, da menos treinada para a mais. */
  precisamFoco: Regiao[];
}

/**
 * Para cada músculo com divisões: quanto cada parte recebeu, qual foi mais focada e quais ficaram para trás.
 * @param familias num treino (ou no dia), só cobra partes dos movimentos que ele tem: dia de empurrar não
 * cobra deltoide posterior. Sem ela (semana, mês) cobra tudo.
 */
export function analisarDivisoes(porRegiao: Map<Regiao, number>, familias?: Set<Familia>): AnaliseDivisao[] {
  return DIVISOES.map(({ musculo, regioes }) => {
    const lista = regioes.map((r) => ({ ...r, series: porRegiao.get(r.regiao) ?? 0 }));
    const total = lista.reduce((t, r) => t + r.series, 0);
    if (total === 0) return { musculo, total, regioes: lista, maisFocada: null, precisamFoco: [] };
    const maior = lista.reduce((a, r) => (r.series > a.series ? r : a));
    const precisamFoco = lista
      .filter((r) => r.series < maior.series / 2 && (!familias || familias.has(FAMILIA_DA_REGIAO[r.regiao])))
      .sort((a, b) => a.series - b.series)
      .map((r) => r.regiao);
    return { musculo, total, regioes: lista, maisFocada: maior.regiao, precisamFoco };
  });
}

/** 7.5 → "7,5"; 6 → "6". */
export function formatarSeries(n: number) {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}
