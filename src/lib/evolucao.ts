// Histórico de cargas por exercício de um treino (aba Evolução).
// Usa só as séries válidas das sessões concluídas daquele treino.
import { repo, type Id, type Serie, type Sessao } from '@/db';

export interface PontoEvolucao {
  sessaoId: Id;
  /** Quando a sessão foi concluída. */
  data: number;
  /** Séries válidas do exercício naquela sessão, na ordem feita. */
  validas: Serie[];
  cargaMax: number;
}

export interface HistoricoExercicio {
  exercicioId: Id;
  nome: string;
  /** Do mais antigo para o mais recente. */
  pontos: PontoEvolucao[];
}

/**
 * @param ordem ids dos exercícios na ordem atual do treino; os que saíram do treino
 *              mas têm histórico vêm depois.
 */
export function montarHistorico(
  sessoes: Sessao[],
  series: Serie[],
  nomes: Map<Id, string>,
  ordem: Id[]
): HistoricoExercicio[] {
  const concluidas = sessoes.filter((s) => s.fim !== null).sort((a, b) => a.fim! - b.fim!);
  const porExercicio = new Map<Id, PontoEvolucao[]>();

  for (const sessao of concluidas) {
    const daSessao = series.filter((s) => s.sessaoId === sessao.id && s.tipo === 'validas');
    const ids = [...new Set(daSessao.map((s) => s.exercicioId))];
    for (const exercicioId of ids) {
      const validas = daSessao.filter((s) => s.exercicioId === exercicioId).sort((a, b) => a.numero - b.numero);
      const ponto = {
        sessaoId: sessao.id,
        data: sessao.fim!,
        validas,
        cargaMax: Math.max(...validas.map((s) => s.carga)),
      };
      porExercicio.set(exercicioId, [...(porExercicio.get(exercicioId) ?? []), ponto]);
    }
  }

  const posicao = (id: Id) => {
    const i = ordem.indexOf(id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...porExercicio.entries()]
    .map(([exercicioId, pontos]) => ({ exercicioId, nome: nomes.get(exercicioId) ?? 'Exercício', pontos }))
    .sort((a, b) => posicao(a.exercicioId) - posicao(b.exercicioId));
}

export async function carregarHistoricoDoTreino(fichaId: Id) {
  const [sessoes, exercicios, daFicha] = await Promise.all([
    repo.listarSessoes(),
    repo.listarExercicios(),
    repo.listarExerciciosDaFicha(fichaId),
  ]);
  const doTreino = sessoes.filter((s) => s.fichaId === fichaId && s.fim !== null);
  const series = (await Promise.all(doTreino.map((s) => repo.listarSeriesDaSessao(s.id)))).flat();
  return montarHistorico(
    doTreino,
    series,
    new Map(exercicios.map((e) => [e.id, e.nome])),
    daFicha.map((fe) => fe.exercicioId)
  );
}

/** Ticks "redondos" para o eixo Y (ex.: 40, 50, 60) cobrindo de `min` a `max`. */
export function ticksDoEixo(min: number, max: number, quantidade = 4) {
  if (min === max) {
    const folga = Math.max(5, Math.abs(min) * 0.1);
    min -= folga;
    max += folga;
  }
  const passoBruto = (max - min) / (quantidade - 1);
  const magnitude = 10 ** Math.floor(Math.log10(passoBruto));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((p) => p >= passoBruto) ?? passoBruto;
  const inicio = Math.max(0, Math.floor(min / passo) * passo);
  const fim = Math.ceil(max / passo) * passo;
  const ticks: number[] = [];
  for (let v = inicio; v <= fim + passo / 2; v += passo) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

export function formatarData(ms: number) {
  return new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
