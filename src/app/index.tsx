import { router, useTheme } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function Inicio() {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.titulo, { color: colors.text }]}>Treino do dia</Text>
      <Pressable
        accessibilityRole="button"
        // Provisório: leva às fichas até a tela de sessão existir.
        onPress={() => router.navigate('/treinos')}
        style={({ pressed }) => [
          styles.botao,
          { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
        ]}>
        <Text style={styles.textoBotao}>Iniciar sessão de treino</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 24 },
  titulo: { fontSize: 28, fontWeight: '700' },
  botao: { paddingVertical: 16, paddingHorizontal: 32, borderRadius: 12 },
  textoBotao: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
