import Ionicons from '@expo/vector-icons/Ionicons';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import type { ComponentProps } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

type NomeIcone = ComponentProps<typeof Ionicons>['name'];

const TELAS: { name: string; titulo: string; icone: NomeIcone }[] = [
  { name: 'index', titulo: 'Início', icone: 'home-outline' },
  { name: 'usuario', titulo: 'Usuário', icone: 'person-outline' },
  { name: 'treinos', titulo: 'Treinos', icone: 'barbell-outline' },
  { name: 'evolucao', titulo: 'Evolução', icone: 'trending-up-outline' },
];

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Drawer>
          {TELAS.map(({ name, titulo, icone }) => (
            <Drawer.Screen
              key={name}
              name={name}
              options={{
                title: titulo,
                drawerIcon: ({ color, size }) => <Ionicons name={icone} color={color} size={size} />,
              }}
            />
          ))}
        </Drawer>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
