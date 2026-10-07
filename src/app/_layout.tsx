import Ionicons from '@expo/vector-icons/Ionicons';
import { ThemeProvider } from 'expo-router';
import {
  Drawer,
  DrawerContentScrollView,
  DrawerItem,
  DrawerItemList,
  type DrawerContentComponentProps,
} from 'expo-router/drawer';
import { StatusBar } from 'expo-status-bar';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BotaoUsuario } from '@/components/botao-usuario';
import { CORES, TEMA } from '@/lib/tema';

type NomeIcone = ComponentProps<typeof Ionicons>['name'];

const TELAS: {
  name: string;
  titulo: string;
  icone: NomeIcone;
  cabecalhoProprio?: boolean;
  botaoUsuario?: boolean;
  /** Fica fora da lista principal: aparece fixo no rodapé do menu. */
  rodape?: boolean;
}[] = [
  { name: 'index', titulo: 'Início', icone: 'home-outline', botaoUsuario: true },
  // Treinos e Evolução têm pilha de telas própria (com botão voltar), então escondem o cabeçalho do menu.
  { name: 'treinos', titulo: 'Treinos', icone: 'barbell-outline', cabecalhoProprio: true },
  { name: 'evolucao', titulo: 'Evolução', icone: 'trending-up-outline', cabecalhoProprio: true },
  { name: 'usuario', titulo: 'Configurações', icone: 'settings-outline', rodape: true },
];

function ConteudoMenu(props: DrawerContentComponentProps) {
  const { bottom } = useSafeAreaInsets();
  const atual = props.state.routes[props.state.index]?.name;

  return (
    <View style={styles.menu}>
      <DrawerContentScrollView {...props}>
        <DrawerItemList {...props} />
      </DrawerContentScrollView>
      <View style={[styles.rodape, { paddingBottom: bottom + 8 }]}>
        {TELAS.filter((t) => t.rodape).map(({ name, titulo, icone }) => (
          <DrawerItem
            key={name}
            label={titulo}
            focused={atual === name}
            activeTintColor={CORES.vermelho}
            inactiveTintColor={CORES.texto}
            icon={({ color, size }) => <Ionicons name={icone} color={color} size={size} />}
            onPress={() => props.navigation.navigate(name)}
          />
        ))}
      </View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: CORES.fundo }}>
      <ThemeProvider value={TEMA}>
        <StatusBar style="light" />
        <Drawer
          drawerContent={(props) => <ConteudoMenu {...props} />}
          screenOptions={{
            drawerActiveTintColor: CORES.vermelho,
            drawerInactiveTintColor: CORES.texto,
            drawerStyle: { backgroundColor: CORES.fundo },
          }}>
          {TELAS.map(({ name, titulo, icone, cabecalhoProprio, botaoUsuario, rodape }) => (
            <Drawer.Screen
              key={name}
              name={name}
              options={{
                title: titulo,
                headerShown: !cabecalhoProprio,
                headerRight: botaoUsuario ? () => <BotaoUsuario /> : undefined,
                drawerIcon: ({ color, size }) => <Ionicons name={icone} color={color} size={size} />,
                // Itens do rodapé são desenhados à parte em ConteudoMenu.
                drawerItemStyle: rodape ? { display: 'none' } : undefined,
              }}
            />
          ))}
        </Drawer>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  menu: { flex: 1 },
  rodape: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: CORES.borda,
    paddingTop: 8,
  },
});
