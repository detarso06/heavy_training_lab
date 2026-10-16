import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { BotaoMenu } from '@/components/botao-menu';
import { voltarAoInicio } from '@/lib/navegacao';
import { CORES } from '@/lib/tema';

// Ao abrir um link direto (ou recarregar no web), mantém a lista de rotinas embaixo para o "voltar".
export const unstable_settings = { initialRouteName: 'index' };

export default function TreinosLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Voltar' }}>
      <Stack.Screen name="index" options={{ title: 'Treinos', headerLeft: () => <BotaoMenu /> }} />
      <Stack.Screen name="rotina/[id]" options={{ title: 'Rotina' }} />
      <Stack.Screen name="ficha/[id]" options={{ title: 'Treino' }} />
      <Stack.Screen name="cardio/[id]" options={{ title: 'Dia de cardio' }} />
      {/* Treino em andamento: o "voltar" vai ao Início com a sessão ainda aberta ("Continuar treino").
          Sem gesto de arrastar, para não sair sem querer. */}
      <Stack.Screen
        name="sessao/[id]"
        options={{
          title: 'Treino',
          headerBackVisible: false,
          headerLeft: () => <BotaoIrAoInicio />,
          gestureEnabled: false,
        }}
      />
      {/* Resumo: sem "voltar" (o treino já foi encerrado). */}
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

function BotaoIrAoInicio() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Voltar ao Início (o treino continua aberto)"
      hitSlop={8}
      onPress={voltarAoInicio}
      style={({ pressed }) => [styles.voltar, { opacity: pressed ? 0.6 : 1 }]}>
      <Ionicons name="arrow-back" size={24} color={CORES.texto} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  voltar: { marginLeft: 16, marginRight: 8 },
});
