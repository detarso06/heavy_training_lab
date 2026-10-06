import { useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { formatarData, ticksDoEixo, type PontoEvolucao } from '@/lib/evolucao';
import { CORES } from '@/lib/tema';

interface Props {
  pontos: PontoEvolucao[];
  selecionado: number;
  onSelecionar: (indice: number) => void;
  nomeExercicio: string;
}

// Topo alto para o balão caber acima até do ponto mais alto.
const ALTURA = 230;
const PAD = { esquerda: 40, direita: 20, topo: 56, base: 28 };
const BALAO = { largura: 92, altura: 44 };
// No navegador o texto do SVG cai numa fonte serifada; no celular já usa a do sistema.
const FONTE = Platform.OS === 'web' ? 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' : undefined;

/**
 * Linha da carga máxima das séries válidas em cada treino. Tocar ou arrastar o dedo
 * pelo gráfico seleciona o treino mais próximo e mostra um balão com o peso e a data.
 */
export function GraficoEvolucao({ pontos, selecionado, onSelecionar, nomeExercicio }: Props) {
  const [largura, setLargura] = useState(0);
  const aoMedir = (e: LayoutChangeEvent) => setLargura(e.nativeEvent.layout.width);

  const cargas = pontos.map((p) => p.cargaMax);
  const ticks = ticksDoEixo(Math.min(...cargas), Math.max(...cargas));
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const areaX = Math.max(0, largura - PAD.esquerda - PAD.direita);
  const areaY = ALTURA - PAD.topo - PAD.base;
  const ultimo = pontos.length - 1;

  const x = (i: number) =>
    pontos.length === 1 ? PAD.esquerda + areaX / 2 : PAD.esquerda + (i * areaX) / (pontos.length - 1);
  const y = (v: number) => PAD.topo + areaY - ((v - yMin) / (yMax - yMin || 1)) * areaY;

  /** Treino mais próximo da posição do dedo: o usuário mira a data, não o ponto. */
  const maisProximo = (px: number) => {
    if (pontos.length === 1 || areaX === 0) return 0;
    const i = Math.round(((px - PAD.esquerda) / areaX) * ultimo);
    return Math.min(ultimo, Math.max(0, i));
  };
  // Posição no início do toque; durante o arraste soma só o deslocamento do dedo
  // (o locationX dos eventos de movimento nem sempre é relativo ao gráfico).
  const inicioToque = useRef({ x: 0, pagina: 0 });
  const selecionar = (px: number) => {
    const i = maisProximo(px);
    if (i !== selecionado) onSelecionar(i);
  };
  const comecar = (e: GestureResponderEvent) => {
    inicioToque.current = { x: e.nativeEvent.locationX, pagina: e.nativeEvent.pageX };
    selecionar(e.nativeEvent.locationX);
  };
  const mover = (e: GestureResponderEvent) =>
    selecionar(inicioToque.current.x + e.nativeEvent.pageX - inicioToque.current.pagina);

  const ponto = pontos[selecionado];
  const bx = x(selecionado);
  const by = y(ponto.cargaMax);
  const balaoEsquerda = Math.min(Math.max(bx - BALAO.largura / 2, 0), Math.max(0, largura - BALAO.largura));

  return (
    <View style={styles.area} onLayout={aoMedir}>
      {largura > 0 && (
        <Svg width={largura} height={ALTURA} pointerEvents="none">
          {ticks.map((t) => (
            <Line key={`g${t}`} x1={PAD.esquerda} x2={largura - PAD.direita} y1={y(t)} y2={y(t)} stroke={CORES.borda} strokeWidth={1} />
          ))}
          {ticks.map((t) => (
            <SvgText
              key={`t${t}`}
              fontFamily={FONTE}
              x={PAD.esquerda - 8}
              y={y(t) + 4}
              fontSize={11}
              fill={CORES.textoSuave}
              textAnchor="end">
              {t.toLocaleString('pt-BR')}
            </SvgText>
          ))}

          {/* Linha vertical do treino selecionado, do balão até o eixo. */}
          <Line x1={bx} x2={bx} y1={by - 6} y2={PAD.topo + areaY} stroke={CORES.textoSuave} strokeWidth={1} />

          {pontos.length > 1 && (
            <Polyline
              points={pontos.map((p, i) => `${x(i)},${y(p.cargaMax)}`).join(' ')}
              fill="none"
              stroke={CORES.vermelho}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {pontos.map((p, i) => (
            <Circle
              key={p.sessaoId}
              cx={x(i)}
              cy={y(p.cargaMax)}
              r={i === selecionado ? 7 : 4}
              fill={CORES.vermelho}
              stroke={i === selecionado ? CORES.texto : CORES.cartao}
              strokeWidth={2}
            />
          ))}

          <SvgText
            fontFamily={FONTE}
            x={x(0)}
            y={ALTURA - 8}
            fontSize={11}
            fill={CORES.textoSuave}
            textAnchor={pontos.length === 1 ? 'middle' : 'start'}>
            {formatarData(pontos[0].data)}
          </SvgText>
          {pontos.length > 1 && (
            <SvgText fontFamily={FONTE} x={x(ultimo)} y={ALTURA - 8} fontSize={11} fill={CORES.textoSuave} textAnchor="end">
              {formatarData(pontos[ultimo].data)}
            </SvgText>
          )}
        </Svg>
      )}

      {largura > 0 && (
        <View
          pointerEvents="none"
          style={[styles.balao, { left: balaoEsquerda, top: Math.max(0, by - BALAO.altura - 12) }]}>
          <Text style={styles.valorBalao}>{ponto.cargaMax.toLocaleString('pt-BR')} kg</Text>
          <Text style={styles.dataBalao}>{formatarData(ponto.data)}</Text>
        </View>
      )}

      {/* Camada de toque: tocar ou arrastar escolhe o treino mais próximo. */}
      <View
        style={styles.toque}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`Evolução de ${nomeExercicio}`}
        accessibilityValue={{ text: `${formatarData(ponto.data)}: ${ponto.cargaMax} kg` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) =>
          onSelecionar(
            Math.min(ultimo, Math.max(0, selecionado + (e.nativeEvent.actionName === 'increment' ? 1 : -1)))
          )
        }
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={comecar}
        onResponderMove={mover}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  area: { height: ALTURA, width: '100%' },
  // pan-y: no navegador, arrastar na vertical continua rolando a página.
  toque: { ...StyleSheet.absoluteFill, touchAction: 'pan-y', userSelect: 'none' },
  balao: {
    position: 'absolute',
    width: BALAO.largura,
    height: BALAO.altura,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CORES.borda,
    backgroundColor: CORES.fundo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valorBalao: { color: CORES.texto, fontSize: 15, fontWeight: '800' },
  dataBalao: { color: CORES.textoSuave, fontSize: 12 },
});
