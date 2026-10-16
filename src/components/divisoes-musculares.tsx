// Divisões do relatório: quanto cada parte do músculo recebeu no período (ex.: peito superior, médio e
// inferior), qual foi mais focada e qual precisa de foco, com exercícios do catálogo para equilibrar.
// Sem área escolhida mostra só o resumo do que precisa de foco; com área, os cartões dela.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Cartao } from '@/components/ui';
import {
  AREAS,
  AREA_DO_MUSCULO,
  NOME_MUSCULO,
  exerciciosParaRegiao,
  type Area,
  type Familia,
  type Musculo,
  type Regiao,
} from '@/lib/musculos';
import { analisarDivisoes, formatarSeries, type AnaliseDivisao } from '@/lib/relatorio';
import { CORES } from '@/lib/tema';

export function DivisoesMusculares({
  porRegiao,
  familias,
  seriesPorMusculo,
  musculosPrecisamFoco,
  esperado,
  area,
  onEscolherArea,
}: {
  porRegiao: Map<Regiao, number>;
  /** Em "Hoje", os movimentos treinados no dia: só cobra partes desses movimentos. */
  familias: Set<Familia>;
  seriesPorMusculo: Map<Musculo, number>;
  /** Músculos inteiros abaixo da referência do período (ver `Relatorio.precisamFoco`). */
  musculosPrecisamFoco: Musculo[];
  /** Séries esperadas por músculo no período; nula em "Hoje" (aí o quadro mostra só o que faltou). */
  esperado: number | null;
  /** Nula = todas as áreas (só o resumo). */
  area: Area | null;
  onEscolherArea: (area: Area) => void;
}) {
  const analises = analisarDivisoes(porRegiao, esperado === null ? familias : undefined);

  if (area === null) {
    const foco = analises
      .filter((a) => a.total > 0)
      .flatMap((a) =>
        a.precisamFoco.map((regiao) => ({
          regiao,
          area: AREA_DO_MUSCULO[a.musculo],
          nome: a.regioes.find((r) => r.regiao === regiao)!.completo,
        }))
      );
    if (foco.length === 0 && musculosPrecisamFoco.length === 0) return null;
    const etiqueta = (chave: string, nome: string, alvo: Area) => (
      <Pressable
        key={chave}
        accessibilityRole="button"
        onPress={() => onEscolherArea(alvo)}
        style={({ pressed }) => [styles.etiqueta, { opacity: pressed ? 0.6 : 1 }]}>
        <Text style={styles.textoEtiqueta}>{nome}</Text>
      </Pressable>
    );
    return (
      <Cartao style={styles.cartao}>
        <View style={styles.aviso}>
          <Ionicons name="alert-circle" size={18} color={CORES.vermelho} />
          <Text style={styles.destaque}>{esperado === null ? 'Faltou hoje' : 'Precisam de foco'}</Text>
        </View>
        {musculosPrecisamFoco.length > 0 && (
          <>
            <Text style={styles.rotulo}>Músculos · menos de {formatarSeries((esperado ?? 0) / 2)} séries</Text>
            <View style={styles.etiquetas}>
              {musculosPrecisamFoco.map((m) =>
                etiqueta(m, `${NOME_MUSCULO[m]} · ${formatarSeries(seriesPorMusculo.get(m) ?? 0)}`, AREA_DO_MUSCULO[m])
              )}
            </View>
          </>
        )}
        {foco.length > 0 && (
          <>
            <Text style={styles.rotulo}>Partes</Text>
            <View style={styles.etiquetas}>{foco.map((f) => etiqueta(f.regiao, f.nome, f.area))}</View>
          </>
        )}
        <Text style={styles.dica}>Toque para ver a área e sugestões de exercícios.</Text>
      </Cartao>
    );
  }

  const daArea = analises.filter((a) => AREAS.find((x) => x.area === area)!.musculos.includes(a.musculo));
  if (daArea.length === 0) return null;
  return (
    <View style={styles.conteudo}>
      <Text style={styles.titulo}>Divisões</Text>
      <Text style={styles.dica}>
        Precisa de foco = menos da metade das séries da parte mais treinada.
      </Text>
      {daArea.map((a) =>
        a.total > 0 ? (
          <Divisao key={a.musculo} analise={a} doMusculo={seriesPorMusculo.get(a.musculo) ?? 0} />
        ) : (
          <Text key={a.musculo} style={styles.dica}>
            {NOME_MUSCULO[a.musculo]}: sem séries no período.
          </Text>
        )
      )}
    </View>
  );
}

function Divisao({ analise, doMusculo }: { analise: AnaliseDivisao; doMusculo: number }) {
  const { musculo, total, regioes, maisFocada, precisamFoco } = analise;
  /** Séries de exercícios personalizados: contam para o músculo, mas não dá para saber a parte. */
  const semParte = doMusculo - total;
  const maior = Math.max(...regioes.map((r) => r.series));
  const nomeCompleto = (regiao: Regiao) => regioes.find((r) => r.regiao === regiao)!.completo;

  return (
    <Cartao style={styles.cartao}>
      <View style={styles.cabecalho}>
        <Text style={styles.musculo}>{NOME_MUSCULO[musculo]}</Text>
        <Text style={styles.total}>
          {formatarSeries(total)} {total === 1 ? 'série' : 'séries'}
        </Text>
      </View>

      {regioes.map((r) => {
        const foco = precisamFoco.includes(r.regiao);
        return (
          <View key={r.regiao} style={styles.linha}>
            <Text style={styles.nomeRegiao}>{r.nome}</Text>
            <View style={styles.trilho}>
              <View
                style={[
                  styles.barra,
                  {
                    width: `${maior > 0 ? (r.series / maior) * 100 : 0}%`,
                    backgroundColor: foco ? CORES.borda : r.regiao === maisFocada ? CORES.vermelho : CORES.textoSuave,
                  },
                ]}
              />
            </View>
            <Text numberOfLines={1} style={[styles.valor, foco && styles.valorFoco]}>{formatarSeries(r.series)}</Text>
          </View>
        );
      })}

      {semParte > 0.01 && (
        <Text style={styles.dica}>
          + {formatarSeries(semParte)} {semParte === 1 ? 'série' : 'séries'} de exercícios personalizados, sem parte
          definida.
        </Text>
      )}

      {precisamFoco.length === 0 ? (
        <View style={styles.aviso}>
          <Ionicons name="checkmark-circle" size={18} color={CORES.verde} />
          <Text style={[styles.textoAviso, styles.textoOk]}>Equilibrado.</Text>
        </View>
      ) : (
        precisamFoco.map((regiao) => (
          <View key={regiao} style={styles.aviso}>
            <Ionicons name="alert-circle" size={18} color={CORES.vermelho} />
            <Text style={styles.textoAviso}>
              <Text style={styles.destaque}>{nomeCompleto(regiao)} precisa de foco.</Text>{' '}
              Experimente: {exerciciosParaRegiao(regiao).join(', ')}.
            </Text>
          </View>
        ))
      )}
    </Cartao>
  );
}

const styles = StyleSheet.create({
  conteudo: { gap: 12 },
  titulo: { color: CORES.texto, fontSize: 20, fontWeight: '700', marginTop: 8 },
  dica: { color: CORES.textoSuave, fontSize: 14 },
  cartao: { gap: 10 },
  cabecalho: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  musculo: { color: CORES.texto, fontSize: 17, fontWeight: '700' },
  total: { color: CORES.textoSuave, fontSize: 14, fontWeight: '600' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 24 },
  nomeRegiao: { color: CORES.texto, fontSize: 15, width: 130 },
  trilho: { flex: 1, height: 8, borderRadius: 4, backgroundColor: CORES.fundo, overflow: 'hidden' },
  barra: { height: '100%', borderRadius: 4 },
  valor: { color: CORES.texto, fontSize: 15, fontWeight: '700', minWidth: 48, textAlign: 'right', fontVariant: ['tabular-nums'] },
  valorFoco: { color: CORES.vermelho },
  aviso: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  textoAviso: { color: CORES.textoSuave, fontSize: 14, flex: 1 },
  textoOk: { color: CORES.verde, fontWeight: '700' },
  destaque: { color: CORES.texto, fontWeight: '700' },
  rotulo: { color: CORES.textoSuave, fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  etiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  etiqueta: { borderWidth: 1.5, borderColor: CORES.vermelho, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  textoEtiqueta: { color: CORES.texto, fontSize: 14, fontWeight: '600' },
});
