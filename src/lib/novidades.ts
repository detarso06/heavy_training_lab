// Número da bolinha do sininho, compartilhado entre o cabeçalho e a tela de notificações:
// responder um pedido ou abrir as notificações atualiza o sininho na hora.
import { useSyncExternalStore } from 'react';

import { clubConfigurado, contarNovidades } from '@/lib/club';
import { supabase } from '@/lib/supabase';

let valor = 0;
const ouvintes = new Set<() => void>();

function definir(n: number) {
  if (n === valor) return;
  valor = n;
  for (const f of ouvintes) f();
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

const ler = () => valor;

export function useNovidades() {
  return useSyncExternalStore(assinar, ler, ler);
}

/** Busca de novo no Club (sem login ou sem internet, a bolinha some). */
export async function atualizarNovidades() {
  if (!clubConfigurado || !supabase) return definir(0);
  const { data } = await supabase.auth.getSession();
  if (!data.session) return definir(0);
  try {
    definir(await contarNovidades());
  } catch {
    // Sem conexão: mantém o último número.
  }
}
