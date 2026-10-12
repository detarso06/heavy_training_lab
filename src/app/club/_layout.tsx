import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, type Href } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { BotaoMenu } from '@/components/botao-menu';
import { CORES } from '@/lib/tema';

// Ao abrir um link direto (ou recarregar no web), mantém a tela do Club embaixo para o "voltar".
export const unstable_settings = { initialRouteName: 'index' };

export default function ClubLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Voltar' }}>
      <Stack.Screen name="index" options={{ title: 'Heavy Club', headerLeft: () => <BotaoMenu /> }} />
      <Stack.Screen name="privacidade" options={{ title: 'Privacidade' }} />
      <Stack.Screen name="amigo/[id]" options={{ title: 'Perfil' }} />
      {/* Post aberto do feed do Início, do sininho ou de um perfil: o "voltar" leva de volta para lá. */}
      <Stack.Screen
        name="checkin/[id]"
        options={({ route }) => ({
          title: 'Treino',
          headerBackVisible: false,
          headerLeft: () => <BotaoVoltarDoPost de={(route.params as { de?: string } | undefined)?.de} />,
        })}
      />
    </Stack>
  );
}

function BotaoVoltarDoPost({ de }: { de?: string }) {
  const voltar = () => {
    // Veio de fora do Club (Início, sininho, Meus check-ins): fecha o post e volta para a tela de origem.
    if (de && !de.startsWith('/club')) {
      router.dismissTo('/club');
      router.navigate(de as Href);
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate('/club');
    }
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Voltar"
      hitSlop={8}
      onPress={voltar}
      style={({ pressed }) => [styles.voltar, { opacity: pressed ? 0.6 : 1 }]}>
      <Ionicons name="arrow-back" size={24} color={CORES.texto} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  voltar: { marginLeft: 16, marginRight: 8 },
});
