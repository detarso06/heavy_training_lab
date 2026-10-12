// Preferências da tela de sessão guardadas no aparelho (localStorage; no celular, via expo-sqlite).
// - Modo de exibição: um exercício por vez ou todos numa lista (vale para todos os treinos).
// - Aviso do fim do descanso (vibração + notificação) ligado ou desligado.
// - Posição do cartão flutuante do treino em andamento.
// - Cronômetros dos cardios dentro do treino em andamento (continuam ao sair da tela).
// - Pausa do dia de cardio em andamento (desde quando está pausado).
// - Exercícios pulados em cada sessão em andamento (só para a tela; não vai para o histórico:
//   o exercício pulado simplesmente não tem séries naquela sessão).
import type { Id } from '@/db';
import { armazenamentoDaSessao as armazenamento } from '@/lib/armazenamento-sessao';

export type ModoSessao = 'um-por-vez' | 'lista';

const CHAVE_MODO = 'app-treino:modo-sessao';
const CHAVE_AVISO = 'app-treino:aviso-descanso';
const CHAVE_POSICAO_CARTAO = 'app-treino:posicao-cartao-treino';
const chavePulados = (sessaoId: Id) => `app-treino:pulados:${sessaoId}`;
const chaveCronometros = (sessaoId: Id) => `app-treino:cardio:${sessaoId}`;
const chavePausa = (sessaoId: Id) => `app-treino:pausa:${sessaoId}`;

function ler(chave: string) {
  try {
    return armazenamento?.getItem(chave) ?? null;
  } catch {
    return null;
  }
}

function gravar(chave: string, valor: string | null) {
  try {
    if (valor === null) armazenamento?.removeItem(chave);
    else armazenamento?.setItem(chave, valor);
  } catch {
    // Sem armazenamento: a preferência vale só enquanto a tela estiver aberta.
  }
}

export function lerModoSessao(): ModoSessao {
  return ler(CHAVE_MODO) === 'lista' ? 'lista' : 'um-por-vez';
}

export function salvarModoSessao(modo: ModoSessao) {
  gravar(CHAVE_MODO, modo);
}

/** Vibrar e avisar (mesmo com o celular bloqueado) quando o descanso acaba. Ligado por padrão. */
export function lerAvisoDescanso() {
  return ler(CHAVE_AVISO) !== 'desligado';
}

export function salvarAvisoDescanso(ligado: boolean) {
  gravar(CHAVE_AVISO, ligado ? null : 'desligado');
}

/** Onde o usuário deixou o cartão do treino em andamento (distâncias da borda direita e do topo da janela). */
export interface PosicaoCartao {
  direita: number;
  topo: number;
}

export function lerPosicaoCartao(): PosicaoCartao | null {
  try {
    const p = JSON.parse(ler(CHAVE_POSICAO_CARTAO) ?? 'null');
    return typeof p?.direita === 'number' && typeof p?.topo === 'number' ? p : null;
  } catch {
    return null;
  }
}

export function salvarPosicaoCartao(p: PosicaoCartao) {
  gravar(CHAVE_POSICAO_CARTAO, JSON.stringify(p));
}

/** Ids dos exercícios pulados na sessão. */
export function lerPulados(sessaoId: Id): Id[] {
  try {
    const lista = JSON.parse(ler(chavePulados(sessaoId)) ?? '[]');
    return Array.isArray(lista) ? lista.filter((n) => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

export function salvarPulados(sessaoId: Id, ids: Id[]) {
  gravar(chavePulados(sessaoId), ids.length ? JSON.stringify(ids) : null);
}

/** Ao finalizar ou descartar a sessão. */
export function limparPulados(sessaoId: Id) {
  gravar(chavePulados(sessaoId), null);
}

/** Cronômetro de um cardio do treino: tempo já contado e, se está rodando, desde quando. */
export interface CronometroCardio {
  acumuladoMs: number;
  rodandoDesde: number | null;
}

/** Cronômetros da sessão, por `exercicioId` do cardio. */
export function lerCronometrosCardio(sessaoId: Id): Record<number, CronometroCardio> {
  try {
    const salvo = JSON.parse(ler(chaveCronometros(sessaoId)) ?? '{}');
    return salvo && typeof salvo === 'object' ? salvo : {};
  } catch {
    return {};
  }
}

/** `null` apaga o cronômetro do cardio (concluído ou desfeito). */
export function salvarCronometroCardio(sessaoId: Id, exercicioId: Id, cronometro: CronometroCardio | null) {
  const todos = lerCronometrosCardio(sessaoId);
  if (cronometro) todos[exercicioId] = cronometro;
  else delete todos[exercicioId];
  gravar(chaveCronometros(sessaoId), Object.keys(todos).length ? JSON.stringify(todos) : null);
}

/** Ao finalizar ou descartar a sessão. */
export function limparCronometrosCardio(sessaoId: Id) {
  gravar(chaveCronometros(sessaoId), null);
}

/** Dia de cardio pausado: desde quando (nulo = rodando). Ao retomar, o início da sessão é empurrado. */
export function lerPausaSessao(sessaoId: Id): number | null {
  const n = Number(ler(chavePausa(sessaoId)));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function salvarPausaSessao(sessaoId: Id, desde: number | null) {
  gravar(chavePausa(sessaoId), desde === null ? null : String(desde));
}
