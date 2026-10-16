// Cardio no app, de dois jeitos:
// - Dia de cardio: item do rodízio sem exercícios (`Ficha.cardio`). A sessão tem só cronômetro.
// - Cardio dentro do treino: item da lista de exercícios (`FichaExercicio.cardioMin`), cuja atividade é
//   um exercício do grupo "Cardio". Na sessão vira um cronômetro no cartão; o tempo vai para `CardioFeito`.
// Nos dois casos, ao finalizar a sessão, os minutos feitos somam no progresso da meta de cardio da semana.
import { repo, type Id, type Sessao } from '@/db';
import { obterOuCriarExercicio } from '@/lib/catalogo';
import { periodoDoCardio } from '@/lib/metas';

/** Grupo das atividades de cardio na tabela de exercícios (fica fora do seletor de musculação). */
export const GRUPO_CARDIO = 'Cardio';

/** Sugestões no editor do dia de cardio (o usuário pode digitar outra). */
export const ATIVIDADES_CARDIO = ['Esteira', 'Bike', 'Escada', 'Elíptico', 'Corrida', 'Caminhada', 'Remo', 'Natação'];

export const MINUTOS_CARDIO_PADRAO = 30;

/** Minutos inteiros entre o início e o fim (ou `agora`, se ainda está rolando). */
export function minutosDaSessao(sessao: Sessao, agora = Date.now()) {
  return Math.max(0, Math.floor(((sessao.fim ?? agora) - sessao.inicio) / 60000));
}

async function somarNaMeta(sessao: Sessao, minutos: number) {
  if (minutos <= 0) return 0;
  const periodo = periodoDoCardio(new Date(sessao.inicio));
  const atual = await repo.obterProgresso('cardio', periodo);
  await repo.salvarProgresso('cardio', periodo, atual + minutos);
  return minutos;
}

/** Dia de cardio encerrado: soma a duração da sessão na meta da semana em que ela começou. */
export function somarCardioNaMeta(sessao: Sessao) {
  return somarNaMeta(sessao, minutosDaSessao(sessao));
}

/** Treino encerrado: soma os cardios concluídos dentro dele na meta da semana. */
export async function somarCardiosDoTreinoNaMeta(sessao: Sessao) {
  const cardios = await repo.listarCardiosDaSessao(sessao.id);
  return somarNaMeta(
    sessao,
    cardios.reduce((total, c) => total + c.minutos, 0)
  );
}

/** Põe um cardio no fim da lista de exercícios do treino. */
export async function adicionarCardioNaFicha(fichaId: Id, atividade: string, minutos: number) {
  const exercicio = await obterOuCriarExercicio(atividade, GRUPO_CARDIO);
  const vazio = { series: 0, repeticoes: '' };
  return repo.adicionarExercicioNaFicha({
    fichaId,
    exercicioId: exercicio.id,
    aquecimento: vazio,
    preparatoria: vazio,
    validas: vazio,
    descansoSeg: 0,
    cardioMin: minutos,
  });
}
