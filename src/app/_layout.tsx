import Ionicons from '@expo/vector-icons/Ionicons';
import { router, ThemeProvider } from 'expo-router';
import {
  Drawer,
  DrawerContentScrollView,
  DrawerItem,
  DrawerItemList,
  type DrawerContentComponentProps,
} from 'expo-router/drawer';
import { StatusBar } from 'expo-status-bar';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BotaoNotificacoes } from '@/components/botao-notificacoes';
import { BotaoUsuario } from '@/components/botao-usuario';
import { TreinoEmAndamento } from '@/components/treino-em-andamento';
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
  /** Não aparece no menu (abre por um botão) e tem seta de voltar. */
  oculta?: boolean;
}[] = [
  { name: 'index', titulo: 'Início', icone: 'home-outline', botaoUsuario: true },
  { name: 'perfil', titulo: 'Perfil', icone: 'person-circle-outline' },
  // Treinos, Evolução e Club têm pilha de telas própria (com botão voltar), então escondem o cabeçalho do menu.
  { name: 'treinos', titulo: 'Treinos', icone: 'barbell-outline', cabecalhoProprio: true },
  { name: 'evolucao', titulo: 'Evolução', icone: 'trending-up-outline', cabecalhoProprio: true },
  { name: 'club', titulo: 'Heavy Club', icone: 'people-outline', cabecalhoProprio: true },
  { name: 'usuario', titulo: 'Configurações', icone: 'settings-outline', rodape: true },
  { name: 'notificacoes', titulo: 'Notificações', icone: 'notifications-outline', oculta: true },
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
          }}
          // Cartão do treino em andamento por cima de todas as telas (e por baixo do menu aberto).
          screenLayout={({ route, children }) => (
            <View style={styles.tela}>
              {children}
              <TreinoEmAndamento
                abaixoDoCabecalho={!TELAS.find((t) => t.name === route.name)?.cabecalhoProprio}
              />
            </View>
          )}>
          {TELAS.map(({ name, titulo, icone, cabecalhoProprio, botaoUsuario, rodape, oculta }) => (
            <Drawer.Screen
              key={name}
              name={name}
              options={{
                title: titulo,
                headerShown: !cabecalhoProprio,
                headerRight: botaoUsuario
                  ? () => (
                      <View style={styles.cantoDireito}>
                        <BotaoNotificacoes />
                        <BotaoUsuario />
                      </View>
                    )
                  : undefined,
                headerLeft: oculta ? () => <BotaoVoltar /> : undefined,
                drawerIcon: ({ color, size }) => <Ionicons name={icone} color={color} size={size} />,
                // Itens do rodapé são desenhados à parte em ConteudoMenu; os ocultos não aparecem.
                drawerItemStyle: rodape || oculta ? { display: 'none' } : undefined,
              }}
            />
          ))}
        </Drawer>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function BotaoVoltar() {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={8} onPress={() => router.back()} style={styles.voltar}>
      <Ionicons name="arrow-back" size={24} color={CORES.texto} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1 },
  cantoDireito: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  voltar: { marginLeft: 16, marginRight: 8 },
  menu: { flex: 1 },
  rodape: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: CORES.borda,
    paddingTop: 8,
  },
});
