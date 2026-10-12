import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useConfirmacao } from '@/components/dialogo-confirmacao';
import { Botao, Cartao } from '@/components/ui';
import { repo, type CardioPlanejado, type Sessao } from '@/db';
import { agendarAvisoDescanso, cancelarAvisoDescanso } from '@/lib/aviso-descanso';
import { somarCardioNaMeta } from '@/lib/cardio';
import { formatarMinutos } from '@/lib/metas';
import { voltarAoInicio } from '@/lib/navegacao';
import { lerAvisoDescanso, lerPausaSessao, salvarPausaSessao } from '@/lib/preferencias-sessao';
import { formatarCronometro } from '@/lib/sessao';
import { CORES } from '@/lib/tema';

/**
 * Sessão do dia de cardio: só cronômetro, com a meta de tempo planejada. Dá para pausar: enquanto
 * pausado, o "desde quando" fica no aparelho; ao retomar (ou finalizar pausado), o início da sessão é
 * empurrado pelo tempo parado, então a pausa não conta na duração, no resumo nem na meta da semana.
 */
export function SessaoCardio({ sessao, plano }: { sessao: Sessao; plano: CardioPlanejado }) {
  const insets = useSafeAreaInsets();
  const { confirmar, dialogo } = useConfirmacao();
  const [agora, setAgora] = useState(() => Date.now());
  const [inicio, setInicio] = useState(sessao.inicio);
  const [pausadoDesde, setPausadoDesde] = useState(() => lerPausaSessao(sessao.id));
  const pausado = pausadoDesde !== null;
  const metaMs = plano.minutos * 60000;
  const decorrido = (pausadoDesde ?? agora) - inicio;
  const bateu = decorrido >= metaMs;
  const vibrou = useRef(bateu);

  useEffect(() => {
    if (pausado) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [pausado]);

  // Avisa quando o tempo planejado é atingido: vibra com o app aberto e agenda uma notificação
  // para quando estiver com a tela bloqueada (mesma opção do aviso de descanso). Pausado, não agenda.
  useEffect(() => {
    const fimDaMeta = inicio + metaMs;
    if (pausado || !lerAvisoDescanso() || Date.now() >= fimDaMeta) return;
    const agendado = agendarAvisoDescanso(fimDaMeta - Date.now(), {
      titulo: 'Meta de cardio batida!',
      corpo: `${formatarMinutos(plano.minutos)} de ${plano.atividade}. Pode finalizar 💪`,
    });
    return () => {
      agendado.then((id) => {
        if (id) cancelarAvisoDescanso(id);
      });
    };
  }, [inicio, metaMs, pausado, plano.atividade, plano.minutos]);

  useEffect(() => {
    if (bateu && !vibrou.current) {
      vibrou.current = true;
      if (lerAvisoDescanso() && Platform.OS !== 'web') Vibration.vibrate([0, 400, 200, 400]);
    }
  }, [bateu]);

  const pausar = () => {
    const agoraMesmo = Date.now();
    salvarPausaSessao(sessao.id, agoraMesmo);
    setPausadoDesde(agoraMesmo);
  };

  /** Desconta o tempo parado do início da sessão e volta a contar. */
  const retomar = async () => {
    if (pausadoDesde === null) return;
    const agoraMesmo = Date.now();
    const novoInicio = inicio + (agoraMesmo - pausadoDesde);
    await repo.atualizarInicioSessao(sessao.id, novoInicio);
    salvarPausaSessao(sessao.id, null);
    setInicio(novoInicio);
    setPausadoDesde(null);
    setAgora(agoraMesmo);
  };

  const finalizar = async () => {
    const minutos = Math.floor(decorrido / 60000);
    if (minutos < plano.minutos) {
      const ok = await confirmar({
        titulo: 'Finalizar treino?',
        destaque: `${formatarMinutos(minutos)} de ${formatarMinutos(plano.minutos)}`,
        mensagem:
          minutos === 0
            ? 'Menos de 1 minuto não soma na meta da semana, mas o dia conta no rodízio e na sequência.'
            : 'Ainda não deu o tempo planejado. O que você fez soma na meta da semana.',
        textoConfirmar: 'Finalizar',
        icone: 'flag',
      });
      if (!ok) return;
    }
    await retomar();
    await repo.encerrarSessao(sessao.id);
    const encerrada = await repo.obterSessao(sessao.id);
    if (encerrada) await somarCardioNaMeta(encerrada);
    router.replace({ pathname: '/treinos/resumo/[id]', params: { id: String(sessao.id) } });
  };

  const descartar = async () => {
    const ok = await confirmar({
      titulo: 'Descartar treino?',
      mensagem: 'Este cardio não conta no rodízio, na sequência nem na meta da semana.',
      textoConfirmar: 'Descartar',
    });
    if (!ok) return;
    await repo.removerSessao(sessao.id);
    salvarPausaSessao(sessao.id, null);
    voltarAoInicio();
  };

  const pct = Math.min(100, (decorrido / metaMs) * 100);
  let situacao = `Faltam ${formatarCronometro(metaMs - decorrido + 999)}`;
  if (bateu) situacao = `Meta batida! +${formatarCronometro(decorrido - metaMs)} a mais 🔥`;
  if (pausado) situacao = `Pausado · ${situacao}`;

  return (
    <ScrollView contentContainerStyle={[styles.conteudo, { paddingBottom: 24 + insets.bottom }]}>
      <Stack.Screen options={{ title: sessao.nome }} />
      {dialogo}

      <View style={styles.topo}>
        <Ionicons name="pulse-outline" size={40} color={CORES.dourado} />
        <Text style={styles.atividade}>{plano.atividade}</Text>
        <Text style={styles.meta}>Meta de hoje: {formatarMinutos(plano.minutos)}</Text>
      </View>

      <Cartao style={styles.cartao}>
        <Text
          style={[styles.tempo, pausado && styles.tempoPausado]}
          accessibilityLabel={`Tempo de cardio: ${formatarCronometro(decorrido)}${pausado ? ', pausado' : ''}`}>
          {formatarCronometro(decorrido)}
        </Text>
        <View style={styles.trilho}>
          <View style={[styles.preenchido, { width: `${pct}%` }, bateu && { backgroundColor: CORES.dourado }]} />
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={pausado ? retomar : pausar}
          style={({ pressed }) => [styles.botaoPausa, { opacity: pressed ? 0.7 : 1 }]}>
          <Ionicons name={pausado ? 'play' : 'pause'} size={20} color={CORES.dourado} />
          <Text style={styles.textoPausa}>{pausado ? 'Retomar' : 'Pausar'}</Text>
        </Pressable>
        <Text style={[styles.restante, bateu && { color: CORES.dourado }]}>{situacao}</Text>
      </Cartao>

      {/* Ações no pé da tela. */}
      <View style={styles.rodape}>
        <Botao
          titulo="Finalizar treino"
          icone="flag"
          variante={bateu ? 'primario' : 'secundario'}
          onPress={finalizar}
          style={styles.finalizar}
        />
        <Text style={styles.dica}>O tempo feito soma na meta de cardio da semana.</Text>
        <Botao titulo="Descartar treino" variante="perigo" icone="trash-outline" onPress={descartar} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteudo: { flexGrow: 1, padding: 16, gap: 12 },
  topo: { alignItems: 'center', gap: 4, marginTop: 8 },
  atividade: { color: CORES.texto, fontSize: 28, fontWeight: '900' },
  meta: { color: CORES.textoSuave, fontSize: 15 },
  cartao: { alignItems: 'center', gap: 14, paddingVertical: 28 },
  tempo: { color: CORES.texto, fontSize: 64, fontWeight: '900', fontVariant: ['tabular-nums'] },
  tempoPausado: { opacity: 0.5 },
  trilho: { alignSelf: 'stretch', height: 8, borderRadius: 4, backgroundColor: CORES.borda, overflow: 'hidden' },
  preenchido: { height: '100%', backgroundColor: CORES.vermelho },
  restante: { color: CORES.textoSuave, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  botaoPausa: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: CORES.dourado,
    borderRadius: 12,
    paddingVertical: 12,
  },
  textoPausa: { color: CORES.dourado, fontSize: 16, fontWeight: '800' },
  // marginTop 'auto' empurra as ações para o fim da tela.
  rodape: { marginTop: 'auto', gap: 12, paddingTop: 12 },
  finalizar: { paddingVertical: 16 },
  dica: { color: CORES.textoSuave, fontSize: 13, textAlign: 'center' },
});
