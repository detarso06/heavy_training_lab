// Sequência de treinos: dias seguidos (do calendário, horário local) com pelo menos uma
// sessão concluída. Se hoje ainda não teve treino, a sequência de ontem continua valendo até
// o fim do dia; passou um dia inteiro sem treino, ela zera.
import type { Sessao } from '@/db';
import { dataLocal } from '@/lib/metas';

export interface Sequencia {
  dias: number;
  treinouHoje: boolean;
}

function diaAnterior(d: Date) {
  const r = new Date(d);
  r.setDate(r.getDate() - 1);
  return r;
}

export function calcularSequencia(sessoes: Sessao[], agora: Date): Sequencia {
  const diasComTreino = new Set(
    sessoes.filter((s) => s.fim !== null).map((s) => dataLocal(new Date(s.fim!)))
  );

  const hoje = new Date(agora);
  const treinouHoje = diasComTreino.has(dataLocal(hoje));
  let dia = treinouHoje ? hoje : diaAnterior(hoje);
  let dias = 0;
  while (diasComTreino.has(dataLocal(dia))) {
    dias++;
    dia = diaAnterior(dia);
  }

  return { dias, treinouHoje };
}

export interface NivelSequencia {
  /** 0 = sem sequência. Futuro: cada nível terá uma imagem própria do Heavy Guy. */
  nivel: number;
  /** Desenhados lado a lado (um pouco sobrepostos). */
  icones: string[];
  titulo: string;
}

const NIVEIS: { aPartirDe: number; icones: string[]; titulo: string }[] = [
  { aPartirDe: 0, icones: ['🧊'], titulo: 'Frio' },
  { aPartirDe: 1, icones: ['🔥'], titulo: 'Aquecendo' },
  { aPartirDe: 3, icones: ['🔥', '🔥'], titulo: 'Pegando fogo' },
  { aPartirDe: 7, icones: ['🔥', '🔥', '🔥'], titulo: 'Em chamas' },
  { aPartirDe: 14, icones: ['☄️'], titulo: 'Imparável' },
  { aPartirDe: 30, icones: ['🌋'], titulo: 'Lendário' },
];

export function nivelDaSequencia(dias: number): NivelSequencia {
  let nivel = 0;
  NIVEIS.forEach((n, i) => {
    if (dias >= n.aPartirDe) nivel = i;
  });
  return { nivel, icones: NIVEIS[nivel].icones, titulo: NIVEIS[nivel].titulo };
}
