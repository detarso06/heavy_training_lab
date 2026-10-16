import { router, useIsFocused, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { repo, type Sessao } from '@/db';
import {
  lerPausaSessao,
  lerPosicaoCartao,
  salvarPosicaoCartao,
  type PosicaoCartao,
} from '@/lib/preferencias-sessao';
import { formatarCronometro } from '@/lib/sessao';
import { CORES } from '@/lib/tema';

/** Altura do cabeçalho de navegação (sem a área segura), igual à padrão do React Navigation. */
const ALTURA_CABECALHO = Platform.OS === 'ios' ? 44 : 64;
const MARGEM = 8;
const MOLA = { damping: 18, stiffness: 180 };

// Posição compartilhada entre as telas (cada tela do menu tem o seu cartão montado).
let posicaoAtual = lerPosicaoCartao();
const ouvintes = new Map<number, (p: PosicaoCartao) => void>();
let proximoId = 1;

/** `origem`: o cartão que foi movido (ele mesmo está animando e não precisa do aviso). */
function guardarPosicao(p: PosicaoCartao, origem: number) {
  posicaoAtual = p;
  salvarPosicaoCartao(p);
  ouvintes.forEach((f, id) => {
    if (id !== origem) f(p);
  });
}

function voltarAoTreino(id: number) {
  router.push({ pathname: '/treinos/sessao/[id]', params: { id: String(id) } });
}

/**
 * Cartãozinho flutuante com o tempo do treino em andamento. Tocar volta para a sessão;
 * segurar e arrastar muda o lugar; ao soltar, encosta na lateral mais próxima (lembrado no
 * aparelho). Some na própria sessão e no resumo.
 *
 * `abaixoDoCabecalho`: a tela já tem o cabeçalho do menu acima deste componente; senão, a
 * área do componente começa no topo da janela (a tela desenha o próprio cabeçalho).
 */
export function TreinoEmAndamento({ abaixoDoCabecalho }: { abaixoDoCabecalho: boolean }) {
  const pathname = usePathname();
  // As telas do menu continuam montadas por baixo; só a visível desenha o cartão.
  const focada = useIsFocused();
  const insets = useSafeAreaInsets();
  const janela = useWindowDimensions();
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [id] = useState(() => proximoId++);
  const [tamanho, setTamanho] = useState({ largura: 170, altura: 70 });
  const naSessao = pathname.startsWith('/treinos/sessao') || pathname.startsWith('/treinos/resumo');

  // A posição é guardada em coordenadas da janela; aqui é convertida para dentro desta área.
  const deslocamento = abaixoDoCabecalho ? insets.top + ALTURA_CABECALHO : 0;
  const limites = {
    direitaMin: MARGEM,
    direitaMax: Math.max(MARGEM, janela.width - tamanho.largura - MARGEM),
    topoMin: Math.max(insets.top, deslocamento) + MARGEM,
    topoMax: Math.max(insets.top + MARGEM, janela.height - insets.bottom - tamanho.altura - MARGEM),
  };
  const padrao = { direita: 12, topo: insets.top + ALTURA_CABECALHO + MARGEM };

  const direita = useSharedValue((posicaoAtual ?? padrao).direita);
  const topo = useSharedValue((posicaoAtual ?? padrao).topo);
  const arrastando = useSharedValue(0);
  const inicio = useSharedValue({ direita: 0, topo: 0 });

  // Iniciar, finalizar ou descartar um treino sempre troca de tela: basta conferir a cada navegação.
  useEffect(() => {
    let ativo = true;
    repo.obterSessaoAtiva().then((s) => {
      if (ativo) setSessao(s);
    });
    return () => {
      ativo = false;
    };
  }, [pathname]);

  // Quando o cartão é movido em outra tela, esta acompanha.
  useEffect(() => {
    const ouvir = (p: PosicaoCartao) => {
      direita.set(p.direita);
      topo.set(p.topo);
    };
    ouvintes.set(id, ouvir);
    return () => {
      ouvintes.delete(id);
    };
  }, [id, direita, topo]);

  const limitar = (v: number, min: number, max: number) => {
    'worklet';
    return Math.min(max, Math.max(min, v));
  };

  const arrastar = Gesture.Pan()
    .minDistance(6)
    .onStart(() => {
      inicio.set({
        direita: limitar(direita.get(), limites.direitaMin, limites.direitaMax),
        topo: limitar(topo.get(), limites.topoMin, limites.topoMax),
      });
      arrastando.set(withSpring(1));
    })
    .onUpdate((e) => {
      direita.set(limitar(inicio.get().direita - e.translationX, limites.direitaMin, limites.direitaMax));
      topo.set(limitar(inicio.get().topo + e.translationY, limites.topoMin, limites.topoMax));
    })
    .onEnd(() => {
      // Ao soltar, encosta na lateral mais próxima (esquerda ou direita) e fica na mesma altura.
      const d = direita.get();
      const alvo = {
        direita: d < (limites.direitaMin + limites.direitaMax) / 2 ? limites.direitaMin : limites.direitaMax,
        topo: topo.get(),
      };
      direita.set(withSpring(alvo.direita, MOLA));
      scheduleOnRN(guardarPosicao, alvo, id);
    })
    .onFinalize(() => {
      arrastando.set(withSpring(0));
    });
  const sessaoId = sessao?.id ?? 0;
  const tocar = Gesture.Tap().onEnd(() => {
    scheduleOnRN(voltarAoTreino, sessaoId);
  });
  const gesto = Gesture.Exclusive(arrastar, tocar);

  const estilo = useAnimatedStyle(() => ({
    transform: [
      { translateX: -limitar(direita.get(), limites.direitaMin, limites.direitaMax) },
      { translateY: limitar(topo.get(), limites.topoMin, limites.topoMax) - deslocamento },
      { scale: 1 + arrastando.get() * 0.06 },
    ],
  }));

  if (!sessao || naSessao || !focada) return null;
  // Dia de cardio pausado: o tempo fica parado (lido a cada navegação, quando o cartão reaparece).
  const pausadoDesde = lerPausaSessao(sessao.id);

  return (
    <GestureDetector gesture={gesto}>
      <Animated.View
        accessible
        accessibilityRole="button"
        accessibilityLabel="Voltar para o treino em andamento"
        accessibilityHint="Segure e arraste para mudar o cartão de lugar"
        onAccessibilityTap={() => voltarAoTreino(sessao.id)}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (width !== tamanho.largura || height !== tamanho.altura) setTamanho({ largura: width, altura: height });
        }}
        style={[styles.cartao, estilo]}>
        <Text style={styles.titulo}>{pausadoDesde === null ? 'Treino em andamento' : 'Treino pausado'}</Text>
        <View style={styles.linha}>
          <View style={[styles.ponto, pausadoDesde !== null && styles.pontoPausado]} />
          {pausadoDesde === null ? (
            <Tempo inicio={sessao.inicio} />
          ) : (
            <Text style={styles.tempo}>{formatarCronometro(pausadoDesde - sessao.inicio)}</Text>
          )}
        </View>
        <Text style={styles.dica}>Toque para voltar ›</Text>
      </Animated.View>
    </GestureDetector>
  );
}

/** Separado para só o número redesenhar a cada segundo. */
function Tempo({ inicio }: { inicio: number }) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <Text style={styles.tempo}>{formatarCronometro(agora - inicio)}</Text>;
}

const styles = StyleSheet.create({
  cartao: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: CORES.cartao,
    borderWidth: 1.5,
    borderColor: CORES.dourado,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 2,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ponto: { width: 8, height: 8, borderRadius: 4, backgroundColor: CORES.vermelho },
  pontoPausado: { backgroundColor: CORES.textoSuave },
  tempo: { color: CORES.dourado, fontSize: 18, fontWeight: '900', fontVariant: ['tabular-nums'] },
  titulo: { color: CORES.textoSuave, fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  dica: { color: CORES.dourado, fontSize: 11, fontWeight: '700' },
});
