import { useTheme } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

/** Conteúdo provisório para telas ainda não implementadas. */
export function EmConstrucao({ titulo, descricao }: { titulo: string; descricao: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <Text style={[styles.titulo, { color: colors.text }]}>{titulo}</Text>
      <Text style={[styles.descricao, { color: colors.text }]}>{descricao}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  titulo: { fontSize: 24, fontWeight: '700' },
  descricao: { fontSize: 16, textAlign: 'center', opacity: 0.7 },
});
