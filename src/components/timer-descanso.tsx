import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Platform, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';

import { formatarCronometro } from '@/lib/sessao';
import { CORES } from '@/lib/tema';

interface Props {
  segundos: number;
  onFechar: () => void;
  /** Distância do rodapé (área segura do celular). */
  margemInferior: number;
}

/**
 * Contagem regressiva do descanso entre séries. Para recomeçar com outro tempo,
 * remonte o componente (mude a `key`).
 */
export function TimerDescanso({ segundos, onFechar, margemInferior }: Props) {
  const [total, setTotal] = useState(segundos * 1000);
  const [fimEm, setFimEm] = useState(() => Date.now() + segundos * 1000);
  /** Tempo que faltava quando pausou; nulo enquanto corre. */
  const [pausadoCom, setPausadoCom] = useState<number | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const avisou = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const restante = pausadoCom ?? Math.max(0, fimEm - agora);
  const acabou = restante === 0;

  useEffect(() => {
    if (acabou && !avisou.current) {
      avisou.current = true;
      if (Platform.OS !== 'web') Vibration.vibrate([0, 400, 200, 400]);
    }
  }, [acabou]);

  const alternarPausa = () => {
    if (pausadoCom === null) {
      setPausadoCom(restante);
    } else {
      setFimEm(Date.now() + pausadoCom);
      setPausadoCom(null);
    }
  };

  const reiniciar = () => {
    avisou.current = false;
    setFimEm(Date.now() + total);
    setAgora(Date.now());
    setPausadoCom(pausadoCom === null ? null : total);
  };

  const mais15 = () => {
    avisou.current = false;
    setTotal(total + 15000);
    if (pausadoCom !== null) setPausadoCom(pausadoCom + 15000);
    else setFimEm(Math.max(fimEm, Date.now()) + 15000);
  };

  const pct = total > 0 ? (restante / total) * 100 : 0;

  return (
    <View style={[styles.barra, { paddingBottom: 12 + margemInferior }, acabou && { borderColor: CORES.dourado }]}>
      <View style={styles.trilho}>
        <View style={[styles.preenchido, { width: `${pct}%` }]} />
      </View>
      <View style={styles.linha}>
        <View style={styles.flex}>
          <Text style={styles.rotulo}>{acabou ? 'Descanso acabou!' : pausadoCom !== null ? 'Pausado' : 'Descanso'}</Text>
          <Text style={[styles.tempo, acabou && { color: CORES.dourado }]}>
            {acabou ? 'Bora!' : formatarCronometro(restante + 999)}
          </Text>
        </View>
        {!acabou && (
          <BotaoTimer
            icone={pausadoCom === null ? 'pause' : 'play'}
            rotulo={pausadoCom === null ? 'Pausar descanso' : 'Retomar descanso'}
            onPress={alternarPausa}
          />
        )}
        <BotaoTimer icone="refresh" rotulo="Reiniciar descanso" onPress={reiniciar} />
        <BotaoTimer texto="+15s" rotulo="Mais 15 segundos" onPress={mais15} />
        <BotaoTimer icone="close" rotulo="Encerrar descanso" onPress={onFechar} />
      </View>
    </View>
  );
}

function BotaoTimer({
  icone,
  texto,
  rotulo,
  onPress,
}: {
  icone?: ComponentProps<typeof Ionicons>['name'];
  texto?: string;
  rotulo: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.botao, { opacity: pressed ? 0.6 : 1 }]}>
      {icone ? (
        <Ionicons name={icone} size={22} color={CORES.dourado} />
      ) : (
        <Text style={styles.textoBotao}>{texto}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  barra: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: CORES.cartao,
    borderTopWidth: 2,
    borderColor: CORES.vermelho,
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 10,
  },
  trilho: { height: 6, borderRadius: 3, backgroundColor: CORES.borda, overflow: 'hidden' },
  preenchido: { height: '100%', backgroundColor: CORES.vermelho },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  rotulo: { color: CORES.textoSuave, fontSize: 12, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  tempo: { color: CORES.texto, fontSize: 30, fontWeight: '900', fontVariant: ['tabular-nums'] },
  botao: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: CORES.dourado,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoBotao: { color: CORES.dourado, fontSize: 13, fontWeight: '800' },
});
