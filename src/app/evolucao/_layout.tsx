import { Stack } from 'expo-router';

import { BotaoMenu } from '@/components/botao-menu';

// Ao abrir um link direto (ou recarregar no web), mantém a lista embaixo para o "voltar".
export const unstable_settings = { initialRouteName: 'index' };

export default function EvolucaoLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Voltar' }}>
      <Stack.Screen name="index" options={{ title: 'Evolução', headerLeft: () => <BotaoMenu /> }} />
      <Stack.Screen name="treino/[id]" options={{ title: 'Evolução do treino' }} />
    </Stack>
  );
}
