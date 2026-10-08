// Cliente do Supabase (Heavy Training Club). Os treinos continuam no aparelho; aqui só vai o que é social.
// Configuração em .env.local: EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
// Sem elas o app funciona normalmente e o Club aparece como "não configurado".
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { armazenamentoDaSessao } from '@/lib/armazenamento-sessao';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const chave = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabase: SupabaseClient | null =
  url && chave
    ? createClient(url, chave, {
        auth: {
          storage: armazenamentoDaSessao,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

// No celular o refresh do token roda em loop; só deixa ligado com o app em primeiro plano.
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (estado) => {
    if (estado === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
