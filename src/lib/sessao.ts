// Regras da sessão de treino (tela do treino em andamento e resumo final).
import type { FichaExercicioDetalhe, Serie, TipoSerie } from '@/db';

export const NOME_TIPO: Record<TipoSerie, string> = {
  aquecimento: 'Aquecimento',
  preparatoria: 'Preparatória',
  validas: 'Válida',
};

export interface LinhaPlanejada {
  /** 1, 2, 3... dentro do exercício, contando todos os tipos (vira `Serie.numero`). */
  numero: number;
  tipo: TipoSerie;
  /** 1, 2, 3... dentro do tipo (ex.: "Válida 2"). */
  ordemNoTipo: number;
  repsAlvo: string;
}

const ORDEM_TIPOS: TipoSerie[] = ['aquecimento', 'preparatoria', 'validas'];

/** Séries que o exercício pede, na ordem: aquecimento, preparatórias, válidas. */
export function linhasDoExercicio(fe: FichaExercicioDetalhe): LinhaPlanejada[] {
  const linhas: LinhaPlanejada[] = [];
  for (const tipo of ORDEM_TIPOS) {
    const { series, repeticoes } = fe[tipo];
    for (let i = 1; i <= series; i++) {
      linhas.push({ numero: linhas.length + 1, tipo, ordemNoTipo: i, repsAlvo: repeticoes });
    }
  }
  return linhas;
}

/** Primeiro número de "8-12" → 8. */
function primeiroNumero(texto: string) {
  const m = texto.match(/\d+/);
  return m ? Number(m[0]) : null;
}

/**
 * Valores iniciais da linha: o que foi feito na mesma série da última vez (mesmo tipo e posição);
 * se não houver, a última série daquele tipo; as repetições caem para o alvo planejado.
 */
export function sugestaoParaLinha(linha: LinhaPlanejada, anteriores: Serie[]) {
  const doTipo = anteriores.filter((s) => s.tipo === linha.tipo);
  const mesma = doTipo[linha.ordemNoTipo - 1] ?? doTipo[doTipo.length - 1];
  return {
    carga: mesma ? mesma.carga : null,
    repeticoes: mesma ? mesma.repeticoes : primeiroNumero(linha.repsAlvo),
  };
}

export function volume(series: Serie[]) {
  return series.reduce((t, s) => t + s.carga * s.repeticoes, 0);
}

export function resumirSeries(series: Serie[]) {
  return {
    series: series.length,
    validas: series.filter((s) => s.tipo === 'validas').length,
    repeticoes: series.reduce((t, s) => t + s.repeticoes, 0),
    volume: volume(series),
  };
}

export interface Evolucao {
  cargaMax: number;
  cargaMaxAnterior: number | null;
  volume: number;
  volumeAnterior: number | null;
}

/** Compara com a última vez que o exercício foi feito, olhando as séries válidas (ou todas, se não houver). */
export function compararEvolucao(atuais: Serie[], anteriores: Serie[]): Evolucao {
  const base = (lista: Serie[]) => {
    const validas = lista.filter((s) => s.tipo === 'validas');
    return validas.length > 0 ? validas : lista;
  };
  const a = base(atuais);
  const p = base(anteriores);
  return {
    cargaMax: Math.max(0, ...a.map((s) => s.carga)),
    cargaMaxAnterior: p.length ? Math.max(0, ...p.map((s) => s.carga)) : null,
    volume: volume(a),
    volumeAnterior: p.length ? volume(p) : null,
  };
}

export function formatarKg(kg: number) {
  return `${kg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`;
}

/** 3_725_000 ms → "1:02:05"; 125_000 → "02:05". */
export function formatarCronometro(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

/** Duração legível para o resumo: "1h 05min", "42min". */
export function formatarDuracao(ms: number) {
  const min = Math.max(1, Math.round(ms / 60000));
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  return `${h}h ${String(m).padStart(2, '0')}min`;
}
