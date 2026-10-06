import { router } from 'expo-router';

/**
 * Volta ao painel Início deixando a aba Treinos na lista de rotinas, para a sessão ou o
 * resumo não reaparecerem quando o usuário abrir a aba de novo. (Quando o treino é aberto
 * pelo Início, a pilha da aba pode não ter a lista embaixo, então não basta "fechar" telas.)
 */
export function voltarAoInicio() {
  router.dismissTo('/treinos');
  router.navigate('/');
}
