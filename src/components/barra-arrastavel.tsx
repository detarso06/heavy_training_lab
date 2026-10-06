import { useRef } from 'react';
import { StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';

import { CORES } from '@/lib/tema';

interface Props {
  valor: number;
  max: number;
  passo: number;
  /** Chamado enquanto arrasta (só para a tela acompanhar). */
  onChange: (valor: number) => void;
  /** Chamado ao soltar: hora de salvar. */
  onSoltar: (valor: number) => void;
  rotulo: string;
  formatar: (valor: number) => string;
}

const BOLINHA = 28;

/** Barra que o usuário arrasta (ou toca) de 0 até `max`, em passos de `passo`. */
export function BarraArrastavel({ valor, max, passo, onChange, onSoltar, rotulo, formatar }: Props) {
  // Estado do gesto em andamento; só é lido dentro dos eventos de toque.
  const gesto = useRef({ largura: 0, inicioX: 0, inicioPagina: 0, ultimo: 0 });

  const calcular = (x: number) => {
    const { largura } = gesto.current;
    if (largura <= 0) return 0;
    const bruto = (Math.min(Math.max(x, 0), largura) / largura) * max;
    return Math.min(max, Math.round(bruto / passo) * passo);
  };

  const mover = (pageX: number) => {
    const g = gesto.current;
    const v = calcular(g.inicioX + (pageX - g.inicioPagina));
    if (v !== g.ultimo) {
      g.ultimo = v;
      onChange(v);
    }
  };

  const tocar = (e: GestureResponderEvent) => {
    const g = gesto.current;
    g.inicioX = e.nativeEvent.locationX;
    g.inicioPagina = e.nativeEvent.pageX;
    g.ultimo = valor;
    mover(e.nativeEvent.pageX);
  };

  const soltar = () => onSoltar(gesto.current.ultimo);

  const aoMedir = (e: LayoutChangeEvent) => {
    gesto.current.largura = e.nativeEvent.layout.width;
  };

  const pct = max > 0 ? Math.min(100, (valor / max) * 100) : 0;
  const ajustar = (delta: number) => {
    const v = Math.min(max, Math.max(0, valor + delta));
    onChange(v);
    onSoltar(v);
  };

  return (
    <View
      style={styles.area}
      onLayout={aoMedir}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={rotulo}
      accessibilityValue={{ text: formatar(valor) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => ajustar(e.nativeEvent.actionName === 'increment' ? passo : -passo)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      // Não deixa a rolagem da tela "roubar" o gesto no meio do arraste.
      onResponderTerminationRequest={() => false}
      onResponderGrant={tocar}
      onResponderMove={(e) => mover(e.nativeEvent.pageX)}
      onResponderRelease={soltar}
      onResponderTerminate={soltar}>
      {/* Filhos sem toque: assim locationX é sempre relativo à barra inteira. */}
      <View pointerEvents="none" style={styles.trilho}>
        <View style={[styles.preenchido, { width: `${pct}%` }]} />
      </View>
      <View pointerEvents="none" style={[styles.bolinha, { left: `${pct}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  // touchAction: no navegador, impede que arrastar para o lado vire rolagem ou "voltar página".
  area: { height: 44, justifyContent: 'center', marginHorizontal: BOLINHA / 2, touchAction: 'none' },
  trilho: { height: 12, borderRadius: 6, backgroundColor: CORES.borda, overflow: 'hidden' },
  preenchido: { height: '100%', backgroundColor: CORES.vermelho },
  bolinha: {
    position: 'absolute',
    width: BOLINHA,
    height: BOLINHA,
    borderRadius: BOLINHA / 2,
    marginLeft: -BOLINHA / 2,
    backgroundColor: CORES.dourado,
    borderWidth: 3,
    borderColor: CORES.fundo,
  },
});
