import { router, useFocusEffect, useTheme } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { repo, type Ficha } from '@/db';
import { calcularTreinoDoDia, inicioDaSemana, type TreinoDoDia } from '@/lib/rodizio';

export default function Inicio() {
  const { colors } = useTheme();
  const [dados, setDados] = useState<{ fichas: Ficha[]; treino: TreinoDoDia } | null>(null);

  // Recarrega sempre que a tela volta ao foco (ex.: depois de criar ficha ou treinar).
  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      Promise.all([repo.listarFichas(), repo.listarSessoes(inicioDaSemana(new Date()))]).then(
        ([fichas, sessoes]) => {
          if (ativo) setDados({ fichas, treino: calcularTreinoDoDia(fichas, sessoes) });
        }
      );
      return () => {
        ativo = false;
      };
    }, [])
  );

  if (!dados) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
      </View>
    );
  }

  const { fichas, treino } = dados;
  const semFichas = fichas.length === 0;

  let destaque = treino.ficha?.nome;
  if (semFichas) destaque = 'Nenhuma ficha cadastrada';
  else if (treino.semanaCompleta) destaque = 'Semana concluída!';

  return (
    <View style={styles.container}>
      <Text style={[styles.titulo, { color: colors.text }]}>Treino do dia</Text>
      <Text style={[styles.destaque, { color: colors.primary }]}>{destaque}</Text>

      {!semFichas && (
        <View style={styles.rodizio}>
          {fichas.map((f) => {
            const feita = treino.feitasNaSemana.has(f.id);
            const atual = f.id === treino.ficha?.id;
            return (
              <View
                key={f.id}
                style={[
                  styles.chip,
                  { borderColor: atual ? colors.primary : colors.border },
                  feita && { backgroundColor: colors.border },
                ]}>
                <Text style={[styles.textoChip, { color: colors.text }, feita && styles.feita]}>
                  {feita ? '✓ ' : ''}
                  {f.nome}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        // Provisório: leva às fichas até a tela de sessão existir.
        onPress={() => router.navigate('/treinos')}
        style={({ pressed }) => [
          styles.botao,
          { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
        ]}>
        <Text style={styles.textoBotao}>
          {semFichas ? 'Criar ficha de treino' : 'Iniciar sessão de treino'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  titulo: { fontSize: 28, fontWeight: '700' },
  destaque: { fontSize: 22, fontWeight: '600', textAlign: 'center' },
  rodizio: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  textoChip: { fontSize: 14 },
  feita: { opacity: 0.6 },
  botao: { marginTop: 8, paddingVertical: 16, paddingHorizontal: 32, borderRadius: 12 },
  textoBotao: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
