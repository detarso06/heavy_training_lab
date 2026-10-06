import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useConfirmacao } from '@/components/dialogo-confirmacao';
import { TimerDescanso } from '@/components/timer-descanso';
import { Botao, Campo, Cartao } from '@/components/ui';
import { repo, type FichaExercicioDetalhe, type Serie, type Sessao } from '@/db';
import { lerNumero } from '@/lib/metas';
import { voltarAoInicio } from '@/lib/navegacao';
import { formatarCronometro, linhasDoExercicio, sugestaoParaLinha, type LinhaPlanejada } from '@/lib/sessao';
import { CORES } from '@/lib/tema';

const chave = (exercicioId: number, numero: number) => `${exercicioId}:${numero}`;

const ROTULO_CURTO = { aquecimento: 'Aquec.', preparatoria: 'Prep.', validas: 'Válida' } as const;

interface Valores {
  carga: string;
  reps: string;
}

const textoNumero = (n: number | null) => (n === null ? '' : String(n).replace('.', ','));

function lerReps(texto: string) {
  const n = Number.parseInt(texto, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function TelaSessao() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessaoId = Number(id);
  const insets = useSafeAreaInsets();
  const { confirmar, dialogo } = useConfirmacao();
  const [dados, setDados] = useState<{ sessao: Sessao; itens: FichaExercicioDetalhe[] } | 'sem-treino' | null>(
    null
  );
  const [feitas, setFeitas] = useState<Record<string, Serie>>({});
  const [valores, setValores] = useState<Record<string, Valores>>({});
  const [invalidas, setInvalidas] = useState<Record<string, boolean>>({});
  /** `n` muda a cada descanso novo, para o timer recomeçar. */
  const [descanso, setDescanso] = useState<{ segundos: number; n: number } | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  /** Exercício mostrado na tela (um por vez). */
  const [atual, setAtual] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const sessao = await repo.obterSessao(sessaoId);
      if (sessao?.fim) {
        router.replace({ pathname: '/treinos/resumo/[id]', params: { id: String(sessaoId) } });
        return;
      }
      if (!sessao || sessao.fichaId === null) {
        if (ativo) setDados('sem-treino');
        return;
      }
      const [itens, registradas] = await Promise.all([
        repo.listarExerciciosDaFicha(sessao.fichaId),
        repo.listarSeriesDaSessao(sessaoId),
      ]);
      const anteriores = await Promise.all(itens.map((i) => repo.ultimasSeriesDoExercicio(i.exercicioId, sessaoId)));

      const f: Record<string, Serie> = {};
      for (const s of registradas) f[chave(s.exercicioId, s.numero)] = s;
      const v: Record<string, Valores> = {};
      itens.forEach((fe, i) => {
        for (const linha of linhasDoExercicio(fe)) {
          const k = chave(fe.exercicioId, linha.numero);
          const sugestao = sugestaoParaLinha(linha, anteriores[i]);
          v[k] = {
            carga: textoNumero(f[k]?.carga ?? sugestao.carga),
            reps: textoNumero(f[k]?.repeticoes ?? sugestao.repeticoes),
          };
        }
      });
      if (!ativo) return;
      setDados({ sessao, itens });
      const pendente = itens.findIndex((fe) => linhasDoExercicio(fe).some((l) => !f[chave(fe.exercicioId, l.numero)]));
      setAtual(Math.max(0, pendente));
      setFeitas(f);
      setValores(v);
    })();
    return () => {
      ativo = false;
    };
  }, [sessaoId]);

  const descartar = async () => {
    const ok = await confirmar({
      titulo: 'Descartar treino?',
      mensagem: 'As séries confirmadas neste treino serão apagadas e ele não conta para a sequência.',
      textoConfirmar: 'Descartar',
    });
    if (!ok) return;
    await repo.removerSessao(sessaoId);
    voltarAoInicio();
  };

  if (dados === null) return <ActivityIndicator style={styles.carregando} />;
  if (dados === 'sem-treino') {
    return (
      <View style={styles.vazio}>
        {dialogo}
        <Text style={styles.textoVazio}>O treino desta sessão foi apagado.</Text>
        <Botao titulo="Descartar sessão" variante="perigo" onPress={descartar} />
      </View>
    );
  }

  const { sessao, itens } = dados;
  const totalSeries = itens.reduce((t, fe) => t + linhasDoExercicio(fe).length, 0);
  const totalFeitas = Object.keys(feitas).length;
  const tudoFeito = totalSeries > 0 && totalFeitas >= totalSeries;

  const alterarValor = (k: string, campo: keyof Valores, texto: string) => {
    setValores((a) => ({ ...a, [k]: { ...a[k], [campo]: texto } }));
    if (campo === 'reps') setInvalidas((a) => ({ ...a, [k]: false }));
  };

  const confirmarSerie = async (fe: FichaExercicioDetalhe, linha: LinhaPlanejada) => {
    const k = chave(fe.exercicioId, linha.numero);
    const reps = lerReps(valores[k]?.reps ?? '');
    if (reps === null) {
      setInvalidas((a) => ({ ...a, [k]: true }));
      return;
    }
    const serie = await repo.registrarSerie({
      sessaoId,
      exercicioId: fe.exercicioId,
      numero: linha.numero,
      tipo: linha.tipo,
      carga: lerNumero(valores[k]?.carga ?? '') ?? 0,
      repeticoes: reps,
    });
    setFeitas((a) => ({ ...a, [k]: serie }));
    if (fe.descansoSeg > 0) setDescanso((d) => ({ segundos: fe.descansoSeg, n: (d?.n ?? 0) + 1 }));
  };

  const desfazer = async (k: string) => {
    const serie = feitas[k];
    if (!serie) return;
    await repo.removerSerie(serie.id);
    setFeitas((a) => {
      const { [k]: _removida, ...resto } = a;
      return resto;
    });
  };

  /** Série já confirmada e editada depois: grava a correção. */
  const salvarEdicao = (k: string) => {
    const serie = feitas[k];
    if (!serie) return;
    const reps = lerReps(valores[k].reps);
    const carga = lerNumero(valores[k].carga) ?? 0;
    if (reps === null) {
      setInvalidas((a) => ({ ...a, [k]: true }));
      return;
    }
    if (reps === serie.repeticoes && carga === serie.carga) return;
    repo.atualizarSerie(serie.id, { carga, repeticoes: reps });
    setFeitas((a) => ({ ...a, [k]: { ...serie, carga, repeticoes: reps } }));
  };

  const irPara = (i: number) => setAtual(Math.min(itens.length - 1, Math.max(0, i)));

  const finalizar = async () => {
    // Exercícios com alguma série ainda não confirmada.
    const pendentes = itens.filter((fe) =>
      linhasDoExercicio(fe).some((l) => !feitas[chave(fe.exercicioId, l.numero)])
    ).length;
    if (pendentes > 0) {
      const ok = await confirmar({
        titulo: 'Finalizar treino?',
        destaque: pendentes === 1 ? 'Falta 1 exercício' : `Faltam ${pendentes} exercícios`,
        mensagem: 'O que não foi confirmado fica de fora do resumo.',
        textoConfirmar: 'Finalizar',
        icone: 'flag-outline',
      });
      if (!ok) return;
    }
    await repo.encerrarSessao(sessaoId);
    router.replace({ pathname: '/treinos/resumo/[id]', params: { id: String(sessaoId) } });
  };

  return (
    <View style={styles.tela}>
      <Stack.Screen options={{ title: sessao.nome }} />
      {dialogo}

      <View style={styles.topo}>
        <View style={styles.cronometro}>
          <Ionicons name="stopwatch-outline" size={22} color={CORES.dourado} />
          <Text style={styles.tempo}>{formatarCronometro(agora - sessao.inicio)}</Text>
        </View>
      </View>
      <View style={styles.trilho}>
        <View style={[styles.preenchido, { width: `${totalSeries ? (totalFeitas / totalSeries) * 100 : 0}%` }]} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.conteudo, { paddingBottom: (descanso ? 150 : 40) + insets.bottom }]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.navegacao}>
          <BotaoSeta icone="chevron-back" rotulo="Exercício anterior" desabilitado={atual === 0} onPress={() => irPara(atual - 1)} />
          <Text style={styles.indice}>
            Exercício {atual + 1} de {itens.length}
          </Text>
          <BotaoSeta
            icone="chevron-forward"
            rotulo="Próximo exercício"
            desabilitado={atual === itens.length - 1}
            onPress={() => irPara(atual + 1)}
          />
        </View>

        {[itens[atual]].filter(Boolean).map((fe) => {
          const i = atual;
          const linhas = linhasDoExercicio(fe);
          const feitasDoExercicio = linhas.filter((l) => feitas[chave(fe.exercicioId, l.numero)]).length;
          const completo = linhas.length > 0 && feitasDoExercicio === linhas.length;
          return (
            <Cartao key={fe.id} style={[styles.cartao, completo && { borderColor: CORES.dourado }]}>
              <View style={styles.cabecalho}>
                <View style={styles.flex}>
                  <Text style={styles.nome}>{fe.exercicio.nome}</Text>
                  <Text style={styles.detalhe}>
                    {feitasDoExercicio}/{linhas.length} séries
                    {fe.exercicio.grupoMuscular ? ` · ${fe.exercicio.grupoMuscular}` : ''}
                  </Text>
                </View>
                {fe.descansoSeg > 0 && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Iniciar descanso"
                    onPress={() => setDescanso((d) => ({ segundos: fe.descansoSeg, n: (d?.n ?? 0) + 1 }))}
                    style={({ pressed }) => [styles.botaoDescanso, { opacity: pressed ? 0.6 : 1 }]}>
                    <Ionicons name="timer-outline" size={18} color={CORES.dourado} />
                    <Text style={styles.textoDescanso}>{formatarCronometro(fe.descansoSeg * 1000)}</Text>
                  </Pressable>
                )}
              </View>

              <View style={styles.linha}>
                <Text style={[styles.colSerie, styles.legenda]}>Série</Text>
                <Text style={[styles.colNumero, styles.legenda]}>Kg</Text>
                <Text style={[styles.colNumero, styles.legenda]}>Reps</Text>
                <View style={styles.colCheck} />
              </View>

              {linhas.map((linha) => {
                const k = chave(fe.exercicioId, linha.numero);
                const feita = !!feitas[k];
                return (
                  <View key={k} style={[styles.linha, feita && styles.linhaFeita]}>
                    <View style={styles.colSerie}>
                      <Text style={[styles.rotuloSerie, linha.tipo === 'validas' && { color: CORES.texto }]}>
                        {ROTULO_CURTO[linha.tipo]} {linha.ordemNoTipo}
                      </Text>
                      {!!linha.repsAlvo && <Text style={styles.alvo}>alvo {linha.repsAlvo}</Text>}
                    </View>
                    <View style={styles.colNumero}>
                      <Campo
                        style={styles.campo}
                        value={valores[k]?.carga ?? ''}
                        onChangeText={(t) => alterarValor(k, 'carga', t)}
                        onBlur={() => salvarEdicao(k)}
                        keyboardType="decimal-pad"
                        placeholder="kg"
                        selectTextOnFocus
                        accessibilityLabel={`Peso da série ${linha.numero} de ${fe.exercicio.nome}`}
                      />
                    </View>
                    <View style={styles.colNumero}>
                      <Campo
                        style={[styles.campo, invalidas[k] && { borderColor: CORES.vermelho }]}
                        value={valores[k]?.reps ?? ''}
                        onChangeText={(t) => alterarValor(k, 'reps', t)}
                        onBlur={() => salvarEdicao(k)}
                        keyboardType="number-pad"
                        placeholder="reps"
                        selectTextOnFocus
                        accessibilityLabel={`Repetições da série ${linha.numero} de ${fe.exercicio.nome}`}
                      />
                    </View>
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: feita }}
                      accessibilityLabel={`Confirmar série ${linha.numero} de ${fe.exercicio.nome}`}
                      onPress={() => (feita ? desfazer(k) : confirmarSerie(fe, linha))}
                      style={({ pressed }) => [
                        styles.colCheck,
                        styles.check,
                        feita && { backgroundColor: CORES.dourado, borderColor: CORES.dourado },
                        { opacity: pressed ? 0.6 : 1 },
                      ]}>
                      <Ionicons name="checkmark" size={22} color={feita ? CORES.sobreDestaque : CORES.textoSuave} />
                    </Pressable>
                  </View>
                );
              })}
              {linhas.some((l) => invalidas[chave(fe.exercicioId, l.numero)]) && (
                <Text style={styles.aviso}>Informe quantas repetições você fez.</Text>
              )}
              {completo && i < itens.length - 1 && (
                <Botao
                  titulo={`Próximo: ${itens[i + 1].exercicio.nome}`}
                  icone="arrow-forward"
                  onPress={() => irPara(i + 1)}
                  style={styles.proximo}
                />
              )}
            </Cartao>
          );
        })}

        <Botao
          titulo="Finalizar treino"
          icone="flag"
          variante={tudoFeito ? 'primario' : 'secundario'}
          desabilitado={totalFeitas === 0}
          onPress={finalizar}
          style={styles.finalizar}
        />
        {totalFeitas === 0 && <Text style={styles.dica}>Confirme pelo menos uma série para finalizar.</Text>}
        <Botao titulo="Descartar treino" variante="perigo" icone="trash-outline" onPress={descartar} />
      </ScrollView>

      {descanso && (
        <TimerDescanso
          key={descanso.n}
          segundos={descanso.segundos}
          margemInferior={insets.bottom}
          onFechar={() => setDescanso(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: CORES.fundo },
  carregando: { marginTop: 40 },
  vazio: { flex: 1, padding: 24, gap: 16, justifyContent: 'center' },
  textoVazio: { color: CORES.texto, fontSize: 16, textAlign: 'center' },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: CORES.cartao,
  },
  cronometro: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tempo: { color: CORES.texto, fontSize: 28, fontWeight: '900', fontVariant: ['tabular-nums'] },
  trilho: { height: 4, backgroundColor: CORES.borda },
  preenchido: { height: '100%', backgroundColor: CORES.vermelho },
  conteudo: { padding: 16, gap: 12 },
  cartao: { gap: 8 },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  nome: { color: CORES.texto, fontSize: 17, fontWeight: '700' },
  detalhe: { color: CORES.textoSuave, fontSize: 13 },
  botaoDescanso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: CORES.dourado,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  textoDescanso: { color: CORES.dourado, fontSize: 13, fontWeight: '700' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 8, paddingVertical: 2 },
  linhaFeita: { backgroundColor: 'rgba(242,179,61,0.08)' },
  legenda: { color: CORES.textoSuave, fontSize: 12, textTransform: 'uppercase', textAlign: 'center' },
  colSerie: { flex: 1.3, minWidth: 0, paddingLeft: 4 },
  colNumero: { flex: 1, minWidth: 0 },
  colCheck: { width: 44 },
  rotuloSerie: { color: CORES.textoSuave, fontSize: 15, fontWeight: '700' },
  alvo: { color: CORES.textoSuave, fontSize: 12 },
  campo: { width: '100%', textAlign: 'center', paddingVertical: 8, paddingHorizontal: 4 },
  check: {
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: CORES.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aviso: { color: CORES.vermelho, fontSize: 13 },
  finalizar: { marginTop: 8, paddingVertical: 16 },
  navegacao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  indice: { color: CORES.textoSuave, fontSize: 14, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  seta: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: CORES.dourado,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proximo: { marginTop: 8 },
  dica: { color: CORES.textoSuave, fontSize: 13, textAlign: 'center' },
});

function BotaoSeta({
  icone,
  rotulo,
  desabilitado,
  onPress,
}: {
  icone: 'chevron-back' | 'chevron-forward';
  rotulo: string;
  desabilitado: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      disabled={desabilitado}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.seta, { opacity: desabilitado ? 0.25 : pressed ? 0.6 : 1 }]}>
      <Ionicons name={icone} size={28} color={CORES.dourado} />
    </Pressable>
  );
}
