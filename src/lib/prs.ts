// PR (recorde pessoal) = maior carga numa série válida de uma sessão concluída.
// Empate na carga: vale a série com mais repetições; persistindo o empate, a primeira vez que foi feita.
import { repo, type Id, type Serie, type Sessao } from '@/db';

export interface Recorde {
  exercicioId: Id;
  exercicio: string;
  carga: number;
  repeticoes: number;
  /** Quando a série do recorde foi feita. */
  feitoEm: number;
  sessaoId: Id;
}

function melhor(a: Serie, b: Serie) {
  return b.carga > a.carga || (b.carga === a.carga && b.repeticoes > a.repeticoes) ? b : a;
}

/** Recorde atual de cada exercício. */
export function calcularRecordes(sessoes: Sessao[], series: Serie[], nomes: Map<Id, string>): Recorde[] {
  const concluidas = new Set(sessoes.filter((s) => s.fim !== null).map((s) => s.id));
  const porExercicio = new Map<Id, Serie>();
  for (const s of [...series].sort((a, b) => a.concluidaEm - b.concluidaEm)) {
    if (s.tipo !== 'validas' || !concluidas.has(s.sessaoId)) continue;
    const atual = porExercicio.get(s.exercicioId);
    porExercicio.set(s.exercicioId, atual ? melhor(atual, s) : s);
  }
  return [...porExercicio.values()]
    .map((s) => ({
      exercicioId: s.exercicioId,
      exercicio: nomes.get(s.exercicioId) ?? 'Exercício',
      carga: s.carga,
      repeticoes: s.repeticoes,
      feitoEm: s.concluidaEm,
      sessaoId: s.sessaoId,
    }))
    .sort((a, b) => a.exercicio.localeCompare(b.exercicio, 'pt-BR'));
}

/**
 * PRs batidos numa sessão: exercícios em que a carga máxima válida passou do recorde
 * de antes dela. A primeira vez que um exercício é feito não conta como PR.
 */
export function prsDaSessao(sessao: Sessao, sessoes: Sessao[], series: Serie[], nomes: Map<Id, string>): Recorde[] {
  const anteriores = sessoes.filter((s) => s.id !== sessao.id && s.fim !== null && s.fim < (sessao.fim ?? Infinity));
  const antes = new Map(calcularRecordes(anteriores, series, nomes).map((r) => [r.exercicioId, r]));
  const daSessao = calcularRecordes([sessao], series.filter((s) => s.sessaoId === sessao.id), nomes);
  return daSessao.filter((r) => {
    const anterior = antes.get(r.exercicioId);
    return anterior !== undefined && r.carga > anterior.carga;
  });
}

/** Lê do aparelho tudo o que os cálculos de PR precisam. */
export async function carregarHistoricoCompleto() {
  const [sessoes, exercicios] = await Promise.all([repo.listarSessoes(), repo.listarExercicios()]);
  const concluidas = sessoes.filter((s) => s.fim !== null);
  const series = (await Promise.all(concluidas.map((s) => repo.listarSeriesDaSessao(s.id)))).flat();
  return { sessoes, series, nomes: new Map(exercicios.map((e) => [e.id, e.nome])) };
}
