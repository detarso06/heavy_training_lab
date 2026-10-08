import { Stack } from 'expo-router';

import { BotaoMenu } from '@/components/botao-menu';

// Ao abrir um link direto (ou recarregar no web), mantém a tela do Club embaixo para o "voltar".
export const unstable_settings = { initialRouteName: 'index' };

export default function ClubLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Voltar' }}>
      <Stack.Screen name="index" options={{ title: 'Heavy Club', headerLeft: () => <BotaoMenu /> }} />
      <Stack.Screen name="privacidade" options={{ title: 'Privacidade' }} />
      <Stack.Screen name="amigo/[id]" options={{ title: 'Perfil' }} />
    </Stack>
  );
}
