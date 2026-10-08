// Preferências da tela de sessão guardadas no aparelho (localStorage; no celular, via expo-sqlite).
// - Modo de exibição: um exercício por vez ou todos numa lista (vale para todos os treinos).
// - Exercícios pulados em cada sessão em andamento (só para a tela; não vai para o histórico:
//   o exercício pulado simplesmente não tem séries naquela sessão).
import type { Id } from '@/db';
import { armazenamentoDaSessao as armazenamento } from '@/lib/armazenamento-sessao';

export type ModoSessao = 'um-por-vez' | 'lista';

const CHAVE_MODO = 'app-treino:modo-sessao';
const chavePulados = (sessaoId: Id) => `app-treino:pulados:${sessaoId}`;

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
