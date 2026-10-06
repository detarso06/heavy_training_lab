import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useTheme } from 'expo-router';
import { DrawerActions } from 'expo-router/react-navigation';
import { Platform, Pressable } from 'react-native';

/** Abre o menu lateral a partir de uma pilha de telas própria (abas Treinos e Evolução). */
export function BotaoMenu() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Abrir menu"
      hitSlop={8}
      onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      // No navegador o cabeçalho da pilha não recua o botão da borda (no celular já recua).
      style={Platform.OS === 'web' ? { marginLeft: 16, marginRight: 8 } : undefined}>
      <Ionicons name="menu" size={24} color={colors.text} />
    </Pressable>
  );
}
