// Cartão da tela do treino: quais músculos o plano trabalha (pelas séries válidas planejadas) e quais
// partes desses músculos ficam de fora, com exercícios do catálogo para completar.
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { corDaIntensidade } from '@/components/mapa-corpo';
import { Cartao } from '@/components/ui';
import type { FichaExercicioDetalhe } from '@/db';
import { NOME_MUSCULO, exerciciosParaRegiao } from '@/lib/musculos';
import { analisarDivisoes, formatarSeries, somarTrabalho } from '@/lib/relatorio';
import { CORES } from '@/lib/tema';

/** Séries válidas num treino que já contam como um bom estímulo para o músculo (cor cheia). */
const SERIES_CHEIAS = 6;

export function MusculosDoTreino({ itens }: { itens: FichaExercicioDetalhe[] }) {
  const { porMusculo, porRegiao, semGrupo, familias } = somarTrabalho(
    itens.map((i) => ({ exercicio: i.exercicio, series: i.validas.series }))
  );
  const trabalhados = porMusculo.filter((m) => m.series > 0).sort((a, b) => b.series - a.series);
  if (trabalhados.length === 0 && semGrupo === 0) return null;

  const faltando = analisarDivisoes(porRegiao, familias).flatMap((a) =>
    a.precisamFoco.map((regiao) => {
      const r = a.regioes.find((x) => x.regiao === regiao)!;
      return { regiao, nome: r.completo, series: r.series };
    })
  );

  return (
    <Cartao style={styles.cartao}>
      <Text style={styles.titulo}>Músculos deste treino</Text>
      <Text style={styles.dica}>Pelas séries válidas planejadas; músculos auxiliares contam meia série.</Text>

      <View style={styles.etiquetas}>
        {trabalhados.map(({ musculo, series }) => (
          <View key={musculo} style={[styles.etiqueta, { borderColor: corDaIntensidade(series / SERIES_CHEIAS) }]}>
            <Text style={styles.textoEtiqueta}>{NOME_MUSCULO[musculo]}</Text>
            <Text style={styles.numero}>{formatarSeries(series)}</Text>
          </View>
        ))}
      </View>

      {trabalhados.length > 0 && faltando.length === 0 && (
        <View style={styles.aviso}>
          <Ionicons name="checkmark-circle" size={18} color={CORES.verde} />
          <Text style={[styles.textoAviso, styles.textoOk]}>As partes dos músculos trabalhados estão equilibradas.</Text>
        </View>
      )}
      {faltando.map((f) => (
        <View key={f.regiao} style={styles.aviso}>
          <Ionicons name="alert-circle" size={18} color={CORES.vermelho} />
          <Text style={styles.textoAviso}>
            <Text style={styles.destaque}>
              {f.nome} {f.series === 0 ? 'fica de fora.' : 'recebe pouco.'}
            </Text>{' '}
            Experimente: {exerciciosParaRegiao(f.regiao).join(', ')}.
          </Text>
        </View>
      ))}
      {semGrupo > 0 && (
        <Text style={styles.dica}>
          {formatarSeries(semGrupo)} {semGrupo === 1 ? 'série de exercício sem grupo muscular' : 'séries de exercícios sem grupo muscular'}{' '}
          não {semGrupo === 1 ? 'entra' : 'entram'} na conta.
        </Text>
      )}
    </Cartao>
  );
}

const styles = StyleSheet.create({
  cartao: { gap: 10 },
  titulo: { color: CORES.texto, fontSize: 18, fontWeight: '700' },
  dica: { color: CORES.textoSuave, fontSize: 14 },
  etiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  etiqueta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  textoEtiqueta: { color: CORES.texto, fontSize: 14, fontWeight: '600' },
  numero: { color: CORES.dourado, fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  aviso: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  textoAviso: { color: CORES.textoSuave, fontSize: 14, flex: 1 },
  textoOk: { color: CORES.verde, fontWeight: '700' },
  destaque: { color: CORES.texto, fontWeight: '700' },
});
