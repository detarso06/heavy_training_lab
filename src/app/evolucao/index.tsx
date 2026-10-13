import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { RelatorioMusculos } from '@/components/relatorio-musculos';
import { Cartao, Selo } from '@/components/ui';
import { repo, type Ficha, type Rotina, type Sessao } from '@/db';
import { formatarData } from '@/lib/evolucao';
import { CORES } from '@/lib/tema';

interface Dados {
  rotinas: Rotina[];
  fichasPorRotina: Map<number, Ficha[]>;
  concluidas: Sessao[];
}

export default function Evolucao() {
  const [dados, setDados] = useState<Dados | null>(null);
  /** Nulo = ainda não escolheu: usa a rotina ativa. */
  const [escolhida, setEscolhida] = useState<number | null>(null);
  const [aba, setAba] = useState<Aba>('relatorio');

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      (async () => {
        const [rotinas, sessoes] = await Promise.all([repo.listarRotinas(), repo.listarSessoes()]);
        const fichas = await Promise.all(rotinas.map((r) => repo.listarFichas(r.id)));
        if (!ativo) return;
        setDados({
          rotinas,
          fichasPorRotina: new Map(rotinas.map((r, i) => [r.id, fichas[i]])),
          concluidas: sessoes.filter((s) => s.fim !== null),
        });
      })();
      return () => {
        ativo = false;
      };
    }, [])
  );

  return (
    <ScrollView contentContainerStyle={styles.conteudo}>
      <View style={styles.abas}>
        {ABAS.map(({ id, titulo }) => {
          const ativa = id === aba;
          return (
            <Pressable
              key={id}
              accessibilityRole="tab"
              accessibilityState={{ selected: ativa }}
              onPress={() => setAba(id)}
              style={[styles.aba, ativa && styles.abaAtiva]}>
              <Text style={[styles.textoAba, ativa && styles.textoAbaAtiva]}>{titulo}</Text>
            </Pressable>
          );
        })}
      </View>
      {aba === 'relatorio' ? <RelatorioMusculos /> : <PorTreino dados={dados} escolhida={escolhida} onEscolher={setEscolhida} />}
    </ScrollView>
  );
}

type Aba = 'relatorio' | 'treinos';

const ABAS: { id: Aba; titulo: string }[] = [
  { id: 'relatorio', titulo: 'Relatório' },
  { id: 'treinos', titulo: 'Por treino' },
];

function PorTreino({
  dados,
  escolhida,
  onEscolher,
}: {
  dados: Dados | null;
  escolhida: number | null;
  onEscolher: (id: number) => void;
}) {
  if (!dados) return <ActivityIndicator style={styles.carregando} />;

  const { rotinas, fichasPorRotina, concluidas } = dados;
  if (rotinas.length === 0) {
    return <Text style={styles.textoVazio}>Crie uma rotina e conclua treinos para acompanhar sua evolução aqui.</Text>;
  }

  const rotinaId = escolhida ?? rotinas.find((r) => r.ativa)?.id ?? rotinas[0].id;
  const rotina = rotinas.find((r) => r.id === rotinaId)!;
  // Descansos não têm exercícios, então não entram na Evolução.
  const fichas = (fichasPorRotina.get(rotinaId) ?? []).filter((f) => !f.descanso);

  return (
    <>
      <Text style={styles.rotulo}>Rotina</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtros}>
        {rotinas.map((r) => {
          const ativo = r.id === rotinaId;
          return (
            <Pressable
              key={r.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: ativo }}
              onPress={() => onEscolher(r.id)}
              style={[styles.chip, ativo && styles.chipAtivo]}>
              <Text style={[styles.textoChip, ativo && styles.textoChipAtivo]}>{r.nome}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.cabecalhoRotina}>
        <Text style={styles.nomeRotina}>{rotina.nome}</Text>
        {rotina.ativa && <Selo texto="Atual" />}
      </View>
      <Text style={styles.dica}>Toque em um treino para ver a evolução de cada exercício.</Text>

      {fichas.length === 0 && <Text style={styles.dica}>Esta rotina não tem treinos.</Text>}
      {fichas.map((f) => {
        const doTreino = concluidas.filter((s) => s.fichaId === f.id);
        const ultima = doTreino.reduce<number | null>((m, s) => Math.max(m ?? 0, s.fim!), null);
        return (
          <Pressable
            key={f.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/evolucao/treino/[id]', params: { id: String(f.id) } })}>
            {({ pressed }) => (
              <Cartao style={[styles.item, { opacity: pressed ? 0.7 : 1 }]}>
                <View style={styles.flex}>
                  <Text style={styles.nome}>{f.nome}</Text>
                  <Text style={styles.detalhe}>
                    {doTreino.length === 0
                      ? 'Nenhum treino concluído ainda'
                      : `${doTreino.length} ${doTreino.length === 1 ? 'treino concluído' : 'treinos concluídos'} · último em ${formatarData(ultima!)}`}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color={CORES.texto} />
              </Cartao>
            )}
          </Pressable>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  carregando: { marginTop: 40 },
  textoVazio: { color: CORES.textoSuave, fontSize: 16, textAlign: 'center', marginTop: 24 },
  conteudo: { padding: 16, gap: 12, paddingBottom: 40 },
  abas: { flexDirection: 'row', backgroundColor: CORES.cartao, borderRadius: 12, padding: 4 },
  aba: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 9 },
  abaAtiva: { backgroundColor: CORES.borda },
  textoAba: { color: CORES.textoSuave, fontSize: 15, fontWeight: '700' },
  textoAbaAtiva: { color: CORES.texto },
  rotulo: { color: CORES.textoSuave, fontSize: 13, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  filtros: { gap: 8 },
  chip: { borderWidth: 1.5, borderColor: CORES.borda, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  chipAtivo: { backgroundColor: CORES.vermelho, borderColor: CORES.vermelho },
  textoChip: { color: CORES.texto, fontSize: 15, fontWeight: '600' },
  textoChipAtivo: { color: CORES.texto },
  cabecalhoRotina: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  nomeRotina: { color: CORES.texto, fontSize: 22, fontWeight: '800' },
  dica: { color: CORES.textoSuave, fontSize: 14 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 72 },
  flex: { flex: 1, gap: 2 },
  nome: { color: CORES.texto, fontSize: 17, fontWeight: '700' },
  detalhe: { color: CORES.textoSuave, fontSize: 14 },
});
