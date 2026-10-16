import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DivisoesMusculares } from '@/components/divisoes-musculares';
import { MapaCorpo, corDaIntensidade } from '@/components/mapa-corpo';
import { Cartao } from '@/components/ui';
import {
  AREAS,
  AREA_DO_MUSCULO,
  NOME_MUSCULO,
  exerciciosParaMusculo,
  type Area,
  type Musculo,
} from '@/lib/musculos';
import { NOME_PERIODO, carregarRelatorio, formatarSeries, type Periodo, type Relatorio } from '@/lib/relatorio';
import { formatarDuracao, formatarKg } from '@/lib/sessao';
import { CORES } from '@/lib/tema';

const PERIODOS: Periodo[] = ['hoje', 'semana', 'mes'];

function dicaDoPeriodo(periodo: Periodo, esperado: number | null) {
  if (periodo === 'hoje' || esperado === null) {
    return 'Treinos concluídos hoje. O músculo mais trabalhado fica vermelho cheio.';
  }
  const desde = periodo === 'semana' ? 'Desde segunda-feira' : 'Desde o dia 1º';
  return `${desde}. Vermelho cheio = ${formatarSeries(esperado)} séries, o esperado até hoje (10 por semana).`;
}

export function RelatorioMusculos() {
  const [periodo, setPeriodo] = useState<Periodo>('semana');
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [selecionado, setSelecionado] = useState<Musculo | null>(null);
  /** Nula = todas as áreas. */
  const [area, setArea] = useState<Area | null>(null);

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      carregarRelatorio(periodo).then((r) => {
        if (ativo) setRelatorio(r);
      });
      return () => {
        ativo = false;
      };
    }, [periodo])
  );

  const series = new Map(relatorio?.porMusculo.map((m) => [m.musculo, m.series]));
  // Mais treinados primeiro; empate mantém a ordem do corpo. Em "Tudo" só os treinados entram na lista
  // (os outros viram uma linha); numa área aparecem todos, porque zero ali é informação.
  const musculosDaArea = area && AREAS.find((a) => a.area === area)!.musculos;
  const lista = [...(relatorio?.porMusculo ?? [])]
    .filter((m) => (musculosDaArea ? musculosDaArea.includes(m.musculo) : m.series > 0))
    .sort((a, b) => b.series - a.series);
  // Em "Hoje" não faz sentido listar tudo o que não foi treinado no dia.
  const naoTreinados =
    area || periodo === 'hoje' ? [] : (relatorio?.porMusculo ?? []).filter((m) => m.series === 0);
  const alternar = (m: Musculo) => setSelecionado((atual) => (atual === m ? null : m));
  const tocarNoMapa = (m: Musculo) => {
    alternar(m);
    setArea(AREA_DO_MUSCULO[m]);
  };

  return (
    <View style={styles.conteudo}>
      <View style={styles.periodos}>
        {PERIODOS.map((p) => {
          const ativo = p === periodo;
          return (
            <Pressable
              key={p}
              accessibilityRole="radio"
              accessibilityState={{ selected: ativo }}
              onPress={() => setPeriodo(p)}
              style={[styles.chip, ativo && styles.chipAtivo]}>
              <Text style={styles.textoChip}>{NOME_PERIODO[p]}</Text>
            </Pressable>
          );
        })}
      </View>

      {!relatorio ? (
        <ActivityIndicator style={styles.carregando} />
      ) : (
        <>
          <View style={styles.grade}>
            <Numero icone="barbell-outline" rotulo="Treinos" valor={String(relatorio.treinos)} />
            <Numero icone="layers-outline" rotulo="Séries válidas" valor={String(relatorio.validas)} />
            <Numero icone="trending-up-outline" rotulo="Peso total" valor={formatarKg(relatorio.volume)} />
            <Numero
              icone="stopwatch-outline"
              rotulo="Tempo treinando"
              valor={relatorio.tempoMs > 0 ? formatarDuracao(relatorio.tempoMs) : '0min'}
            />
          </View>

          <Cartao style={styles.cartaoMapa}>
            <Text style={styles.titulo}>Músculos trabalhados</Text>
            <Text style={styles.dica}>{dicaDoPeriodo(periodo, relatorio.esperado)}</Text>
            <MapaCorpo
              seriesPorMusculo={series}
              escala={relatorio.escala}
              selecionado={selecionado}
              onSelecionar={tocarNoMapa}
            />
            <Text style={styles.detalheSelecionado}>
              {selecionado
                ? `${NOME_MUSCULO[selecionado]}: ${formatarSeries(series.get(selecionado) ?? 0)} ${series.get(selecionado) === 1 ? 'série válida' : 'séries válidas'}`
                : 'Toque em um músculo para ver as séries.'}
            </Text>
          </Cartao>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.areas}>
            {[{ area: null, nome: 'Todas' }, ...AREAS].map((a) => {
              const ativa = a.area === area;
              return (
                <Pressable
                  key={a.nome}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: ativa }}
                  onPress={() => {
                    setArea(a.area);
                    setSelecionado(null);
                  }}
                  style={[styles.chipArea, ativa && styles.chipAreaAtivo]}>
                  <Text style={[styles.textoChipArea, ativa && styles.textoChipAreaAtivo]}>{a.nome}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Cartao style={styles.lista}>
            {lista.length === 0 && <Text style={styles.dica}>Nenhuma série válida no período.</Text>}
            {lista.map(({ musculo, series: n }) => (
              <Pressable key={musculo} accessibilityRole="button" onPress={() => alternar(musculo)} style={styles.linha}>
                <Text style={[styles.nomeGrupo, musculo === selecionado && styles.nomeSelecionado]}>
                  {NOME_MUSCULO[musculo]}
                </Text>
                <View style={styles.trilho}>
                  <View
                    style={[
                      styles.barra,
                      {
                        width: `${Math.min(100, (n / relatorio.escala) * 100)}%`,
                        backgroundColor: corDaIntensidade(n / relatorio.escala),
                      },
                    ]}
                  />
                </View>
                <Text numberOfLines={1} style={[styles.contagem, relatorio.precisamFoco.includes(musculo) && styles.contagemFoco]}>
                  {formatarSeries(n)}
                </Text>
              </Pressable>
            ))}
            {lista
              .filter((m) => area !== null && relatorio.precisamFoco.includes(m.musculo))
              .map(({ musculo }) => (
                <View key={musculo} style={styles.aviso}>
                  <Ionicons name="alert-circle" size={18} color={CORES.vermelho} />
                  <Text style={styles.textoAviso}>
                    <Text style={styles.destaque}>{NOME_MUSCULO[musculo]} precisa de foco.</Text> Experimente:{' '}
                    {exerciciosParaMusculo(musculo).join(', ')}.
                  </Text>
                </View>
              ))}
            {naoTreinados.length > 0 && (
              <Text style={styles.dica}>Sem séries: {naoTreinados.map((m) => NOME_MUSCULO[m.musculo]).join(', ')}.</Text>
            )}
            {area === null && (
              <Text style={styles.dica}>Músculos auxiliares contam meia série (ex.: supino = peito 1, tríceps 0,5).</Text>
            )}
            {area === null && relatorio.semGrupo > 0 && (
              <Text style={styles.dica}>
                {formatarSeries(relatorio.semGrupo)}{' '}
                {relatorio.semGrupo === 1 ? 'série de exercício sem grupo muscular ficou' : 'séries de exercícios sem grupo muscular ficaram'}{' '}
                fora do mapa.
              </Text>
            )}
          </Cartao>

          <DivisoesMusculares
            porRegiao={relatorio.porRegiao}
            familias={relatorio.familias}
            seriesPorMusculo={series}
            musculosPrecisamFoco={relatorio.precisamFoco}
            esperado={relatorio.esperado}
            area={area}
            onEscolherArea={setArea}
          />
        </>
      )}
    </View>
  );
}

function Numero({
  icone,
  rotulo,
  valor,
}: {
  icone: ComponentProps<typeof Ionicons>['name'];
  rotulo: string;
  valor: string;
}) {
  return (
    <Cartao style={styles.numero}>
      <Ionicons name={icone} size={20} color={CORES.dourado} />
      <Text style={styles.valorNumero} numberOfLines={1} adjustsFontSizeToFit>
        {valor}
      </Text>
      <Text style={styles.rotuloNumero}>{rotulo}</Text>
    </Cartao>
  );
}

const styles = StyleSheet.create({
  conteudo: { gap: 12 },
  carregando: { marginTop: 40 },
  periodos: { flexDirection: 'row', gap: 8 },
  chip: { borderWidth: 1.5, borderColor: CORES.borda, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  chipAtivo: { backgroundColor: CORES.vermelho, borderColor: CORES.vermelho },
  textoChip: { color: CORES.texto, fontSize: 15, fontWeight: '600' },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  numero: { width: '48%', flexGrow: 1, alignItems: 'center', gap: 4, paddingVertical: 16 },
  valorNumero: { color: CORES.texto, fontSize: 24, fontWeight: '900' },
  rotuloNumero: { color: CORES.textoSuave, fontSize: 13, fontWeight: '600' },
  cartaoMapa: { gap: 8 },
  titulo: { color: CORES.texto, fontSize: 20, fontWeight: '700' },
  dica: { color: CORES.textoSuave, fontSize: 14 },
  detalheSelecionado: { color: CORES.dourado, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  areas: { gap: 8 },
  chipArea: { borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14, backgroundColor: CORES.cartao },
  chipAreaAtivo: { backgroundColor: CORES.dourado },
  textoChipArea: { color: CORES.textoSuave, fontSize: 14, fontWeight: '700' },
  textoChipAreaAtivo: { color: CORES.sobreDestaque },
  lista: { gap: 10 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 28 },
  nomeGrupo: { color: CORES.texto, fontSize: 15, fontWeight: '600', width: 140 },
  nomeSelecionado: { color: CORES.dourado },
  trilho: { flex: 1, height: 8, borderRadius: 4, backgroundColor: CORES.fundo, overflow: 'hidden' },
  barra: { height: '100%', borderRadius: 4 },
  contagemFoco: { color: CORES.vermelho },
  aviso: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  textoAviso: { color: CORES.textoSuave, fontSize: 14, flex: 1 },
  destaque: { color: CORES.texto, fontWeight: '700' },
  contagem: { color: CORES.texto, fontSize: 15, fontWeight: '700', minWidth: 48, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
