import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GraficoEvolucao } from '@/components/grafico-evolucao';
import { Cartao } from '@/components/ui';
import { repo } from '@/db';
import { carregarHistoricoDoTreino, formatarData, type HistoricoExercicio } from '@/lib/evolucao';
import { formatarKg } from '@/lib/sessao';
import { CORES } from '@/lib/tema';

function dataCompleta(ms: number) {
  const d = new Date(ms);
  const semana = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  return `${semana}, ${formatarData(ms)}`;
}

export default function EvolucaoDoTreino() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const fichaId = Number(id);
  const [nome, setNome] = useState('');
  const [historico, setHistorico] = useState<HistoricoExercicio[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      Promise.all([repo.obterFicha(fichaId), carregarHistoricoDoTreino(fichaId)]).then(([ficha, h]) => {
        if (!ativo) return;
        setNome(ficha?.nome ?? 'Treino');
        setHistorico(h);
      });
      return () => {
        ativo = false;
      };
    }, [fichaId])
  );

  if (!historico) return <ActivityIndicator style={styles.carregando} />;

  return (
    <ScrollView contentContainerStyle={styles.conteudo}>
      <Stack.Screen options={{ title: nome }} />
      <Text style={styles.titulo}>{nome}</Text>
      <Text style={styles.dica}>
        Carga máxima das séries válidas em cada treino. Toque em um ponto para ver as séries daquele dia.
      </Text>

      {historico.length === 0 && (
        <Cartao>
          <Text style={styles.vazio}>
            Você ainda não concluiu este treino com séries válidas. Os gráficos aparecem depois do primeiro treino
            finalizado.
          </Text>
        </Cartao>
      )}

      {historico.map((h) => (
        <CartaoExercicio key={h.exercicioId} historico={h} />
      ))}
    </ScrollView>
  );
}

function CartaoExercicio({ historico }: { historico: HistoricoExercicio }) {
  const { nome, pontos } = historico;
  const [selecionado, setSelecionado] = useState(pontos.length - 1);
  const [verTudo, setVerTudo] = useState(false);
  const ponto = pontos[Math.min(selecionado, pontos.length - 1)];

  const primeiro = pontos[0].cargaMax;
  const ultimo = pontos[pontos.length - 1].cargaMax;
  const diferenca = ultimo - primeiro;

  return (
    <Cartao style={styles.cartao}>
      <View style={styles.cabecalho}>
        <Text style={styles.nome}>{nome}</Text>
        {pontos.length > 1 && (
          <Text style={styles.variacao}>
            {diferenca === 0 ? 'mesma carga' : `${diferenca > 0 ? '+' : '−'}${formatarKg(Math.abs(diferenca))}`}
          </Text>
        )}
      </View>
      <Text style={styles.subtitulo}>
        {pontos.length} {pontos.length === 1 ? 'treino' : 'treinos'}
        {pontos.length > 1 ? ` · desde ${formatarData(pontos[0].data)}` : ''}
      </Text>

      <GraficoEvolucao pontos={pontos} selecionado={selecionado} onSelecionar={setSelecionado} nomeExercicio={nome} />

      <View style={styles.detalhe}>
        <Text style={styles.dataDetalhe}>{dataCompleta(ponto.data)}</Text>
        {ponto.validas.map((s, i) => (
          <View key={s.id} style={styles.linhaSerie}>
            <Text style={styles.rotuloSerie}>Válida {i + 1}</Text>
            <Text style={styles.valorSerie}>
              {formatarKg(s.carga)} × {s.repeticoes}
            </Text>
          </View>
        ))}
      </View>

      {pontos.length === 1 && (
        <Text style={styles.dica}>Faça este treino mais vezes para ver a linha da sua evolução.</Text>
      )}

      {pontos.length > 1 && (
        <Pressable accessibilityRole="button" onPress={() => setVerTudo(!verTudo)}>
          <Text style={styles.link}>{verTudo ? 'Esconder histórico' : 'Ver todos os treinos'}</Text>
        </Pressable>
      )}
      {verTudo && (
        <View style={styles.tabela}>
          {[...pontos].reverse().map((p) => (
            <View key={p.sessaoId} style={styles.linhaTabela}>
              <Text style={styles.dataTabela}>{formatarData(p.data)}</Text>
              <Text style={styles.seriesTabela}>
                {p.validas.map((s) => `${s.carga.toLocaleString('pt-BR')}×${s.repeticoes}`).join('   ')}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Cartao>
  );
}

const styles = StyleSheet.create({
  carregando: { marginTop: 40 },
  conteudo: { padding: 16, gap: 12, paddingBottom: 40 },
  titulo: { color: CORES.texto, fontSize: 24, fontWeight: '800' },
  dica: { color: CORES.textoSuave, fontSize: 14 },
  vazio: { color: CORES.textoSuave, fontSize: 15 },
  cartao: { gap: 6 },
  cabecalho: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  nome: { color: CORES.texto, fontSize: 17, fontWeight: '700', flexShrink: 1 },
  variacao: { color: CORES.texto, fontSize: 15, fontWeight: '800' },
  subtitulo: { color: CORES.textoSuave, fontSize: 13 },
  detalhe: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: CORES.borda, paddingTop: 10, gap: 4 },
  dataDetalhe: { color: CORES.dourado, fontSize: 14, fontWeight: '700', textTransform: 'capitalize' },
  linhaSerie: { flexDirection: 'row', justifyContent: 'space-between' },
  rotuloSerie: { color: CORES.textoSuave, fontSize: 15 },
  valorSerie: { color: CORES.texto, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  link: { color: CORES.dourado, fontSize: 14, fontWeight: '700', paddingVertical: 6 },
  tabela: { gap: 6 },
  linhaTabela: { flexDirection: 'row', gap: 12 },
  dataTabela: { color: CORES.textoSuave, fontSize: 14, width: 48, fontVariant: ['tabular-nums'] },
  seriesTabela: { color: CORES.texto, fontSize: 14, flex: 1, fontVariant: ['tabular-nums'] },
});
