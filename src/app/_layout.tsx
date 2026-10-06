import Ionicons from '@expo/vector-icons/Ionicons';
import { ThemeProvider } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { StatusBar } from 'expo-status-bar';
import type { ComponentProps } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { BotaoUsuario } from '@/components/botao-usuario';
import { CORES, TEMA } from '@/lib/tema';

type NomeIcone = ComponentProps<typeof Ionicons>['name'];

const TELAS: {
  name: string;
  titulo: string;
  icone: NomeIcone;
  cabecalhoProprio?: boolean;
  botaoUsuario?: boolean;
}[] = [
  { name: 'index', titulo: 'Início', icone: 'home-outline', botaoUsuario: true },
  { name: 'usuario', titulo: 'Usuário', icone: 'person-outline' },
  // Treinos e Evolução têm pilha de telas própria (com botão voltar), então escondem o cabeçalho do menu.
  { name: 'treinos', titulo: 'Treinos', icone: 'barbell-outline', cabecalhoProprio: true },
  { name: 'evolucao', titulo: 'Evolução', icone: 'trending-up-outline', cabecalhoProprio: true },
];

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: CORES.fundo }}>
      <ThemeProvider value={TEMA}>
        <StatusBar style="light" />
        <Drawer
          screenOptions={{
            drawerActiveTintColor: CORES.vermelho,
            drawerInactiveTintColor: CORES.texto,
            drawerStyle: { backgroundColor: CORES.fundo },
          }}>
          {TELAS.map(({ name, titulo, icone, cabecalhoProprio, botaoUsuario }) => (
            <Drawer.Screen
              key={name}
              name={name}
              options={{
                title: titulo,
                headerShown: !cabecalhoProprio,
                headerRight: botaoUsuario ? () => <BotaoUsuario /> : undefined,
                drawerIcon: ({ color, size }) => <Ionicons name={icone} color={color} size={size} />,
              }}
            />
          ))}
        </Drawer>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
