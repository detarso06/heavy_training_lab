import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useTheme } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Cartao, CriarComNome, Selo } from '@/components/ui';
import { repo, type Rotina } from '@/db';

type RotinaComTotal = Rotina & { totalTreinos: number; totalDescansos: number; totalCardios: number };

export default function Rotinas() {
  const { colors } = useTheme();
  const [rotinas, setRotinas] = useState<RotinaComTotal[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      (async () => {
        const lista = await repo.listarRotinas();
        const comTotal = await Promise.all(
          lista.map(async (r) => {
            const fichas = await repo.listarFichas(r.id);
            const totalDescansos = fichas.filter((f) => f.descanso).length;
            const totalCardios = fichas.filter((f) => f.cardio).length;
            return { ...r, totalTreinos: fichas.length - totalDescansos - totalCardios, totalDescansos, totalCardios };
          })
        );
        if (ativo) setRotinas(comTotal);
      })();
      return () => {
        ativo = false;
      };
    }, [])
  );

  const criar = async (nome: string) => {
    const rotina = await repo.criarRotina({ nome, descricao: null });
    router.push({ pathname: '/treinos/rotina/[id]', params: { id: String(rotina.id) } });
  };

  if (!rotinas) return <ActivityIndicator style={styles.carregando} />;

  return (
    <ScrollView contentContainerStyle={styles.conteudo}>
      <Text style={[styles.explicacao, { color: colors.text }]}>
        {rotinas.length === 0
          ? 'Comece criando uma rotina (ex.: "ABC", "Push Pull Legs"). Dentro dela você cria os treinos que vão se revezar na semana.'
          : 'O treino do dia segue o rodízio da rotina ativa.'}
      </Text>

      {rotinas.map((r) => (
        <Pressable
          key={r.id}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/treinos/rotina/[id]', params: { id: String(r.id) } })}>
          {({ pressed }) => (
            <Cartao style={[styles.item, { opacity: pressed ? 0.7 : 1 }]}>
              <View style={styles.flex}>
                <View style={styles.linhaTitulo}>
                  <Text style={[styles.nome, { color: colors.text }]}>{r.nome}</Text>
                  {r.ativa && <Selo texto="Ativa" />}
                </View>
                <Text style={[styles.detalhe, { color: colors.text }]}>
                  {r.totalTreinos === 1 ? '1 treino' : `${r.totalTreinos} treinos`}
                  {r.totalCardios > 0 && ` · ${r.totalCardios === 1 ? '1 cardio' : `${r.totalCardios} cardios`}`}
                  {r.totalDescansos > 0 &&
                    ` · ${r.totalDescansos === 1 ? '1 descanso' : `${r.totalDescansos} descansos`}`}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </Cartao>
          )}
        </Pressable>
      ))}

      <CriarComNome titulo="Criar nova rotina de treino" placeholder="Nome da rotina" onCriar={criar} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  carregando: { marginTop: 40 },
  conteudo: { padding: 16, gap: 12 },
  explicacao: { fontSize: 15, opacity: 0.7, marginBottom: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1, gap: 4 },
  linhaTitulo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nome: { fontSize: 18, fontWeight: '600' },
  detalhe: { fontSize: 14, opacity: 0.6 },
});
