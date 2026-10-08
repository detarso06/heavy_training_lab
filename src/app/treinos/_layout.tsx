import { Stack } from 'expo-router';

import { BotaoMenu } from '@/components/botao-menu';

// Ao abrir um link direto (ou recarregar no web), mantém a lista de rotinas embaixo para o "voltar".
export const unstable_settings = { initialRouteName: 'index' };

export default function TreinosLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Voltar' }}>
      <Stack.Screen name="index" options={{ title: 'Treinos', headerLeft: () => <BotaoMenu /> }} />
      <Stack.Screen name="rotina/[id]" options={{ title: 'Rotina' }} />
      <Stack.Screen name="ficha/[id]" options={{ title: 'Treino' }} />
      {/* Treino em andamento e resumo: sem "voltar" para não sair do treino sem querer. */}
      <Stack.Screen
        name="sessao/[id]"
        options={{ title: 'Treino', headerBackVisible: false, headerLeft: () => null, gestureEnabled: false }}
      />
      <Stack.Screen
        name="resumo/[id]"
        options={{
          title: 'Treino concluído',
          headerBackVisible: false,
          headerLeft: () => null,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen name="postar/[id]" options={{ title: 'Postar no Club', presentation: 'modal' }} />
      <Stack.Screen
        name="adicionar-exercicio"
        options={{ title: 'Adicionar exercícios', presentation: 'modal' }}
      />
    </Stack>
  );
}
