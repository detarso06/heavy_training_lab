// Tela provisória: confirma que a camada de dados funciona. Será substituída na etapa 3.
import { useTheme } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { repo } from '@/db';

export default function Inicio() {
  const { colors } = useTheme();
  const [status, setStatus] = useState('Carregando banco de dados...');

  useEffect(() => {
    Promise.all([repo.listarFichas(), repo.listarExercicios(), repo.listarSessoes()])
      .then(([fichas, exercicios, sessoes]) =>
        setStatus(
          `Banco OK (${Platform.OS === 'web' ? 'navegador' : 'SQLite'})\n` +
            `${fichas.length} fichas · ${exercicios.length} exercícios · ${sessoes.length} treinos`
        )
      )
      .catch((e: unknown) => setStatus(`Erro no banco: ${String(e)}`));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={[styles.titulo, { color: colors.text }]}>App Treino</Text>
      <Text style={[styles.status, { color: colors.text }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  titulo: { fontSize: 28, fontWeight: '700' },
  status: { fontSize: 16, textAlign: 'center', opacity: 0.8 },
});
