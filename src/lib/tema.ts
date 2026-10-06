// Identidade Heavy Training Lab (mascote Heavy Guy): preto, vermelho, dourado e branco creme.
// O app é sempre escuro.
import { DarkTheme, type Theme } from 'expo-router';

export const CORES = {
  fundo: '#0B0A09',
  cartao: '#171412',
  borda: '#2E2823',
  texto: '#F3E9D8',
  textoSuave: '#A89C8C',
  vermelho: '#E3262B',
  dourado: '#F2B33D',
  /** Texto sobre botões/selos vermelhos ou dourados. */
  sobreDestaque: '#0B0A09',
} as const;

export const TEMA: Theme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: CORES.vermelho,
    background: CORES.fundo,
    card: CORES.cartao,
    text: CORES.texto,
    border: CORES.borda,
    notification: CORES.vermelho,
  },
};
