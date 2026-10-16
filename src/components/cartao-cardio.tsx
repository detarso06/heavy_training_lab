import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';

import { Campo, Cartao } from '@/components/ui';
import type { CardioFeito, FichaExercicioDetalhe, Id } from '@/db';
import { agendarAvisoDescanso, cancelarAvisoDescanso } from '@/lib/aviso-descanso';
import { formatarMinutos } from '@/lib/metas';
import { lerCronometrosCardio, salvarCronometroCardio, type CronometroCardio } from '@/lib/preferencias-sessao';
import { formatarCronometro } from '@/lib/sessao';
import { CORES } from '@/lib/tema';

interface Props {
  sessaoId: Id;
  fe: FichaExercicioDetalhe;
  /** Já concluído nesta sessão. */
  feito: CardioFeito | undefined;
  /** Vibrar e notificar ao bater o tempo planejado (mesma opção do aviso de descanso). */
  aviso: boolean;
  pulado: boolean;
  onConcluir: (minutos: number) => void;
  /** Tocar no ✓ do cardio concluído (a tela pede confirmação antes de desfazer). */
  onDesfazer: () => void;
  onAlterarMinutos: (minutos: number) => void;
  /** Rodapé do cartão (pular/retomar, "Próximo: …"). */
  children?: ReactNode;
}

const PARADO: CronometroCardio = { acumuladoMs: 0, rodandoDesde: null };

/**
 * Cardio dentro do treino, na sessão: cronômetro com meta (iniciar, pausar, concluir). Ao bater a meta
 * só avisa; o cronômetro segue contando até o usuário concluir. O cronômetro fica
 * salvo no aparelho, então continua contando se o usuário sair da tela. Concluir só aparece depois de
 * iniciar e grava os minutos do cronômetro, que podem ser corrigidos depois.
 */
export function CartaoCardio({
  sessaoId,
  fe,
  feito,
  aviso,
  pulado,
  onConcluir,
  onDesfazer,
  onAlterarMinutos,
  children,
}: Props) {
  const metaMs = (fe.cardioMin ?? 0) * 60000;
  const [cronometro, setCronometro] = useState<CronometroCardio>(
    () => lerCronometrosCardio(sessaoId)[fe.exercicioId] ?? PARADO
  );
  const [agora, setAgora] = useState(() => Date.now());
  /** Texto do campo de minutos enquanto o usuário edita; nulo = mostra o valor salvo. */
  const [rascunho, setRascunho] = useState<string | null>(null);
  const rodando = cronometro.rodandoDesde !== null;
  const decorrido = cronometro.acumuladoMs + (rodando ? agora - cronometro.rodandoDesde! : 0);
  const bateu = metaMs > 0 && decorrido >= metaMs;
  const vibrou = useRef(bateu);

  useEffect(() => {
    if (!rodando) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [rodando]);

  // Notificação para quando bater o tempo planejado (tela bloqueada); cancelada ao pausar ou concluir.
  useEffect(() => {
    if (!aviso || cronometro.rodandoDesde === null) return;
    const faltam = metaMs - cronometro.acumuladoMs - (Date.now() - cronometro.rodandoDesde);
    if (faltam <= 0) return;
    const agendado = agendarAvisoDescanso(faltam, {
      titulo: 'Cardio concluído!',
      corpo: `${formatarMinutos(fe.cardioMin ?? 0)} de ${fe.exercicio.nome}. Bora pro próximo 💪`,
    });
    return () => {
      agendado.then((id) => {
        if (id) cancelarAvisoDescanso(id);
      });
    };
  }, [aviso, cronometro, metaMs, fe.cardioMin, fe.exercicio.nome]);

  useEffect(() => {
    if (bateu && rodando && !vibrou.current) {
      vibrou.current = true;
      if (aviso && Platform.OS !== 'web') Vibration.vibrate([0, 400, 200, 400]);
    }
  }, [bateu, rodando, aviso]);

  const guardar = (novo: CronometroCardio | null) => {
    setCronometro(novo ?? PARADO);
    setAgora(Date.now());
    salvarCronometroCardio(sessaoId, fe.exercicioId, novo);
  };

  const iniciar = () => guardar({ ...cronometro, rodandoDesde: Date.now() });
  const pausar = () => guardar({ acumuladoMs: decorrido, rodandoDesde: null });

  const concluir = () => {
    const minutos = Math.max(1, Math.round(decorrido / 60000));
    guardar(null);
    onConcluir(minutos);
  };

  const salvarMinutos = () => {
    if (!feito || rascunho === null) return;
    const n = Number.parseInt(rascunho, 10);
    setRascunho(null);
    if (Number.isFinite(n) && n > 0 && n !== feito.minutos) onAlterarMinutos(n);
  };

  const pct = metaMs > 0 ? Math.min(100, (decorrido / metaMs) * 100) : 0;

  return (
    <Cartao style={[styles.cartao, feito && { borderColor: CORES.dourado }, pulado && styles.pulado]}>
      <View style={styles.cabecalho}>
        <Ionicons name="pulse-outline" size={24} color={CORES.dourado} />
        <View style={styles.flex}>
          <Text style={styles.nome}>{fe.exercicio.nome}</Text>
          <Text style={styles.detalhe}>
            {feito ? '1/1' : '0/1'} · Cardio · meta {formatarMinutos(fe.cardioMin ?? 0)}
          </Text>
        </View>
      </View>

      {feito ? (
        // Mesmo visual de uma série confirmada: linha com fundo dourado suave e ✓ dourado cheio.
        <View style={styles.linhaFeito}>
          <View style={styles.colRotulo}>
            <Text style={styles.rotuloFeito}>Feito</Text>
            <Text style={styles.alvo}>alvo {formatarMinutos(fe.cardioMin ?? 0)}</Text>
          </View>
          <Campo
            style={styles.campo}
            value={rascunho ?? String(feito.minutos)}
            onChangeText={setRascunho}
            onBlur={salvarMinutos}
            onSubmitEditing={salvarMinutos}
            keyboardType="number-pad"
            selectTextOnFocus
            accessibilityLabel={`Minutos de ${fe.exercicio.nome}`}
          />
          <Text style={styles.min}>min</Text>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: true }}
            accessibilityLabel={`Desfazer ${fe.exercicio.nome}`}
            onPress={onDesfazer}
            style={({ pressed }) => [styles.check, styles.checkFeito, { opacity: pressed ? 0.6 : 1 }]}>
            <Ionicons name="checkmark" size={22} color={CORES.sobreDestaque} />
          </Pressable>
        </View>
      ) : (
        !pulado && (
          <View style={styles.cronometro}>
            <Text style={[styles.tempo, bateu && { color: CORES.dourado }]}>{formatarCronometro(decorrido)}</Text>
            <View style={styles.trilho}>
              <View style={[styles.preenchido, { width: `${pct}%` }, bateu && { backgroundColor: CORES.dourado }]} />
            </View>
            <Text style={[styles.restante, bateu && { color: CORES.dourado }]}>
              {bateu
                ? `Meta batida! +${formatarCronometro(decorrido - metaMs)} a mais 🔥`
                : decorrido > 0
                  ? `Faltam ${formatarCronometro(metaMs - decorrido + 999)}`
                  : 'Toque em Iniciar quando começar'}
            </Text>
            {/* Antes de começar, só "Iniciar"; depois, pausar/retomar e concluir. */}
            <View style={styles.botoes}>
              {!rodando && decorrido === 0 ? (
                <BotaoCardio icone="play" titulo="Iniciar" onPress={iniciar} />
              ) : (
                <>
                  <BotaoCardio
                    icone={rodando ? 'pause' : 'play'}
                    titulo={rodando ? 'Pausar' : 'Retomar'}
                    onPress={rodando ? pausar : iniciar}
                  />
                  <BotaoCardio icone="checkmark" titulo="Concluir" onPress={concluir} />
                </>
              )}
            </View>
          </View>
        )
      )}
      {children}
    </Cartao>
  );
}

/** Mesmo padrão do "Finalizar treino" ainda pendente: contorno e texto dourados. */
function BotaoCardio({
  icone,
  titulo,
  onPress,
}: {
  icone: 'play' | 'pause' | 'checkmark';
  titulo: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.botao, { opacity: pressed ? 0.7 : 1 }]}>
      <Ionicons name={icone} size={20} color={CORES.dourado} />
      <Text style={styles.textoBotao}>{titulo}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cartao: { gap: 10 },
  pulado: { borderStyle: 'dashed', borderColor: CORES.textoSuave },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  nome: { color: CORES.texto, fontSize: 17, fontWeight: '700' },
  detalhe: { color: CORES.textoSuave, fontSize: 13 },
  cronometro: { alignItems: 'center', gap: 10 },
  tempo: { color: CORES.texto, fontSize: 44, fontWeight: '900', fontVariant: ['tabular-nums'] },
  trilho: { alignSelf: 'stretch', height: 6, borderRadius: 3, backgroundColor: CORES.borda, overflow: 'hidden' },
  preenchido: { height: '100%', backgroundColor: CORES.vermelho },
  restante: { color: CORES.textoSuave, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  botoes: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  botao: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: CORES.dourado,
    borderRadius: 12,
    paddingVertical: 12,
  },
  textoBotao: { color: CORES.dourado, fontSize: 16, fontWeight: '800' },
  linhaFeito: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 8,
    paddingVertical: 2,
    backgroundColor: 'rgba(242,179,61,0.08)',
  },
  colRotulo: { flex: 1, minWidth: 0, paddingLeft: 4 },
  rotuloFeito: { color: CORES.texto, fontSize: 15, fontWeight: '700' },
  alvo: { color: CORES.textoSuave, fontSize: 12 },
  min: { color: CORES.textoSuave, fontSize: 15, fontWeight: '700' },
  campo: { width: 72, textAlign: 'center', paddingVertical: 8 },
  check: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: CORES.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkFeito: { backgroundColor: CORES.dourado, borderColor: CORES.dourado },
});
