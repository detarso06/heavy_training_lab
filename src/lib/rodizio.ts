// Rodízio semanal: toda segunda-feira o ciclo recomeça. O treino do dia é a primeira
// ficha, na ordem do rodízio, que ainda não foi concluída na semana — mesmo que o
// usuário tenha treinado fora de ordem. Dias de descanso são itens do rodízio como os treinos:
// marcar "Descansei hoje" grava uma sessão concluída sem séries.
import type { Ficha, Id, Sessao } from '@/db';

/** Segunda-feira 00:00 (horário local) da semana de `data`. */
export function inicioDaSemana(data: Date): number {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  const diasDesdeSegunda = (d.getDay() + 6) % 7; // getDay(): 0 = domingo
  d.setDate(d.getDate() - diasDesdeSegunda);
  return d.getTime();
}

export interface TreinoDoDia {
  /** Nula se não há fichas ou se todas já foram feitas na semana. */
  ficha: Ficha | null;
  feitasNaSemana: Set<Id>;
  semanaCompleta: boolean;
}

/**
 * @param fichas na ordem do rodízio
 * @param sessoesDaSemana sessões iniciadas desde `inicioDaSemana`
 */
export function calcularTreinoDoDia(fichas: Ficha[], sessoesDaSemana: Sessao[]): TreinoDoDia {
  const feitasNaSemana = new Set(
    sessoesDaSemana.filter((s) => s.fim !== null && s.fichaId !== null).map((s) => s.fichaId!)
  );
  const ficha = fichas.find((f) => !feitasNaSemana.has(f.id)) ?? null;
  return { ficha, feitasNaSemana, semanaCompleta: fichas.length > 0 && ficha === null };
}

/** Treino (não descanso) concluído hoje, o mais recente, se houver. */
export function treinoDeHoje(fichas: Ficha[], sessoes: Sessao[], agora: Date): Sessao | null {
  const descansos = new Set(fichas.filter((f) => f.descanso).map((f) => f.id));
  const hoje = agora.toDateString();
  const deHoje = sessoes.filter(
    (s) =>
      s.fim !== null && !(s.fichaId !== null && descansos.has(s.fichaId)) && new Date(s.fim).toDateString() === hoje
  );
  return deHoje.reduce<Sessao | null>((a, s) => (a === null || s.fim! > a.fim! ? s : a), null);
}

/** Descanso marcado hoje (sessão concluída de um item de descanso da rotina), se houver. */
export function descansoDeHoje(fichas: Ficha[], sessoes: Sessao[], agora: Date): Sessao | null {
  const descansos = new Set(fichas.filter((f) => f.descanso).map((f) => f.id));
  const hoje = agora.toDateString();
  return (
    sessoes.find(
      (s) =>
        s.fim !== null && s.fichaId !== null && descansos.has(s.fichaId) && new Date(s.fim).toDateString() === hoje
    ) ?? null
  );
}
