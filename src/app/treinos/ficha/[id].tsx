import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useFocusEffect, useLocalSearchParams, useTheme } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useConfirmacao } from '@/components/dialogo-confirmacao';
import { ModalCardio } from '@/components/modal-cardio';
import { ModalVideo } from '@/components/modal-video';
import { MusculosDoTreino } from '@/components/musculos-do-treino';
import { Botao, BotaoIcone, Campo, Cartao, Contador } from '@/components/ui';
import { repo, type Ficha, type FichaExercicioDetalhe, type PlanoSeries, type TipoSerie } from '@/db';
import { adicionarCardioNaFicha } from '@/lib/cardio';
import { formatarMinutos } from '@/lib/metas';
import { CORES } from '@/lib/tema';

/** `padrao` preenche as repetições quando o tipo sai de 0 séries com o campo vazio. */
const TIPOS: { tipo: TipoSerie; nome: string; padrao: string }[] = [
  { tipo: 'aquecimento', nome: 'Aquecimento', padrao: '15' },
  { tipo: 'preparatoria', nome: 'Preparatória', padrao: '5' },
  { tipo: 'validas', nome: 'Válidas', padrao: '8-12' },
];

function formatarDescanso(seg: number) {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function TelaFicha() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const fichaId = Number(id);
  const { colors } = useTheme();
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [nome, setNome] = useState('');
  const [itens, setItens] = useState<FichaExercicioDetalhe[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [videoDe, setVideoDe] = useState<FichaExercicioDetalhe | null>(null);
  const [salvo, setSalvo] = useState(false);
  /** Janela "Adicionar cardio": `n` remonta a janela a cada abertura (começa limpa). */
  const [cardioNovo, setCardioNovo] = useState<{ n: number; atividade: string } | null>(null);
  const { confirmar, dialogo } = useConfirmacao();

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      Promise.all([repo.obterFicha(fichaId), repo.listarExerciciosDaFicha(fichaId)]).then(([f, lista]) => {
        if (!ativo) return;
        setFicha(f);
        setNome(f?.nome ?? '');
        setItens(lista);
        setCarregado(true);
      });
      return () => {
        ativo = false;
      };
    }, [fichaId])
  );

  if (!carregado) return <ActivityIndicator style={styles.carregando} />;
  if (!ficha) return <Text style={[styles.vazio, { color: colors.text }]}>Treino não encontrado.</Text>;

  const salvarNome = async () => {
    const limpo = nome.trim();
    if (!limpo) {
      setNome(ficha.nome);
      return;
    }
    if (limpo === ficha.nome) return;
    await repo.atualizarFicha(ficha.id, { nome: limpo });
    setFicha({ ...ficha, nome: limpo });
  };

  /** Atualiza só na tela (enquanto digita). */
  const alterarLocal = (itemId: number, mudar: (i: FichaExercicioDetalhe) => FichaExercicioDetalhe) =>
    setItens((atual) => atual.map((i) => (i.id === itemId ? mudar(i) : i)));

  const alterarPlano = (item: FichaExercicioDetalhe, tipo: TipoSerie, plano: PlanoSeries, salvar: boolean) => {
    alterarLocal(item.id, (i) => ({ ...i, [tipo]: plano }));
    if (salvar) repo.atualizarExercicioDaFicha(item.id, { [tipo]: plano });
  };

  const alterarDescanso = (item: FichaExercicioDetalhe, descansoSeg: number) => {
    alterarLocal(item.id, (i) => ({ ...i, descansoSeg }));
    repo.atualizarExercicioDaFicha(item.id, { descansoSeg });
  };

  /** O vídeo pertence ao exercício, então vale para todos os treinos que o usam. */
  const salvarVideo = (exercicioId: number, videoUrl: string | null) => {
    repo.atualizarExercicio(exercicioId, { videoUrl });
    setItens((atual) =>
      atual.map((i) => (i.exercicioId === exercicioId ? { ...i, exercicio: { ...i.exercicio, videoUrl } } : i))
    );
    setVideoDe((atual) => atual && { ...atual, exercicio: { ...atual.exercicio, videoUrl } });
  };

  const mover = async (indice: number, delta: -1 | 1) => {
    const nova = [...itens];
    const [item] = nova.splice(indice, 1);
    nova.splice(indice + delta, 0, item);
    setItens(nova);
    await repo.reordenarFicha(ficha.id, nova.map((i) => i.id));
  };

  const abrirCardio = async () => {
    const perfil = await repo.obterPerfil();
    setCardioNovo({ n: Date.now(), atividade: perfil.cardioAtividade?.trim() || 'Esteira' });
  };

  const adicionarCardio = async (atividade: string, minutos: number) => {
    setCardioNovo(null);
    await adicionarCardioNaFicha(ficha.id, atividade, minutos);
    setItens(await repo.listarExerciciosDaFicha(ficha.id));
  };

  const alterarCardio = (item: FichaExercicioDetalhe, cardioMin: number) => {
    alterarLocal(item.id, (i) => ({ ...i, cardioMin }));
    repo.atualizarExercicioDaFicha(item.id, { cardioMin });
  };

  const remover = async (item: FichaExercicioDetalhe) => {
    const cardio = item.cardioMin !== null;
    const ok = await confirmar({
      titulo: cardio ? 'Remover cardio?' : 'Remover exercício?',
      destaque: item.exercicio.nome,
      mensagem: 'Ele sai deste treino. O histórico de treinos já feitos continua salvo.',
      textoConfirmar: 'Remover',
    });
    if (!ok) return;
    await repo.removerExercicioDaFicha(item.id);
    setItens((atual) => atual.filter((i) => i.id !== item.id));
  };

  /** As alterações já são gravadas na hora; aqui gravamos tudo de novo (inclusive campo ainda em edição) e voltamos. */
  const salvarTreino = async () => {
    await salvarNome();
    await Promise.all(
      itens.map(({ id: itemId, aquecimento, preparatoria, validas, descansoSeg, cardioMin }) =>
        repo.atualizarExercicioDaFicha(itemId, { aquecimento, preparatoria, validas, descansoSeg, cardioMin })
      )
    );
    setSalvo(true);
    setTimeout(() => router.back(), 700);
  };

  const apagarTreino = async () => {
    const ok = await confirmar({
      titulo: 'Apagar treino?',
      destaque: ficha.nome,
      mensagem: 'O treino e seus exercícios serão apagados. O histórico de sessões já feitas continua salvo.',
    });
    if (!ok) return;
    await repo.removerFicha(ficha.id);
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: ficha.nome }} />
      {dialogo}

      <Text style={[styles.rotulo, { color: colors.text }]}>Nome do treino</Text>
      <Campo value={nome} onChangeText={setNome} onBlur={salvarNome} />

      <Text style={[styles.secao, { color: colors.text }]}>Exercícios</Text>
      {itens.length === 0 && (
        <Text style={[styles.detalhe, { color: colors.text }]}>
          Nenhum exercício ainda. Toque em &quot;Adicionar exercícios&quot; para escolher no catálogo.
        </Text>
      )}

      {itens.map((item, i) => (
        <Cartao key={item.id} style={styles.cartao}>
          <View style={styles.cabecalho}>
            <Text style={[styles.posicao, { color: CORES.dourado }]}>{i + 1}</Text>
            {item.cardioMin !== null && <Ionicons name="pulse-outline" size={22} color={CORES.dourado} />}
            <View style={styles.flex}>
              <Text style={[styles.nome, { color: colors.text }]}>{item.exercicio.nome}</Text>
              {item.exercicio.grupoMuscular && (
                <Text style={[styles.detalhe, { color: colors.text }]}>{item.exercicio.grupoMuscular}</Text>
              )}
            </View>
            <BotaoIcone icone="chevron-up" rotulo="Subir" desabilitado={i === 0} onPress={() => mover(i, -1)} />
            <BotaoIcone
              icone="chevron-down"
              rotulo="Descer"
              desabilitado={i === itens.length - 1}
              onPress={() => mover(i, 1)}
            />
            <BotaoIcone
              icone="trash-outline"
              rotulo={item.cardioMin !== null ? 'Remover cardio' : 'Remover exercício'}
              cor={colors.notification}
              onPress={() => remover(item)}
            />
          </View>

          {item.cardioMin !== null ? (
            <View style={styles.linhaSerie}>
              <Text style={[styles.colTipo, { color: colors.text }]}>Tempo</Text>
              <View style={styles.colQtd}>
                <Contador
                  rotulo={`minutos de ${item.exercicio.nome}`}
                  valor={item.cardioMin}
                  min={5}
                  max={180}
                  passo={5}
                  formatar={formatarMinutos}
                  onChange={(v) => alterarCardio(item, v)}
                />
              </View>
            </View>
          ) : (
            <>
              <View style={styles.tabelaCabecalho}>
                <Text style={[styles.colTipo, styles.legenda, { color: colors.text }]}>Séries</Text>
                <Text style={[styles.colQtd, styles.legenda, { color: colors.text }]}>Qtd.</Text>
                <Text style={[styles.colReps, styles.legenda, { color: colors.text }]}>Reps</Text>
              </View>
              {TIPOS.map(({ tipo, nome: nomeTipo, padrao }) => {
                const plano = item[tipo];
                return (
                  <View key={tipo} style={styles.linhaSerie}>
                    <Text style={[styles.colTipo, { color: colors.text }]}>{nomeTipo}</Text>
                    <View style={styles.colQtd}>
                      <Contador
                        rotulo={`séries de ${nomeTipo.toLowerCase()}`}
                        valor={plano.series}
                        max={20}
                        onChange={(series) =>
                          alterarPlano(
                            item,
                            tipo,
                            { series, repeticoes: series > 0 && !plano.repeticoes.trim() ? padrao : plano.repeticoes },
                            true
                          )
                        }
                      />
                    </View>
                    <View style={styles.colReps}>
                      <Campo
                        style={[styles.campoReps, plano.series === 0 && styles.inativo]}
                        value={plano.repeticoes}
                        placeholder={plano.series > 0 ? padrao : '–'}
                        editable={plano.series > 0}
                        onChangeText={(repeticoes) => alterarPlano(item, tipo, { ...plano, repeticoes }, false)}
                        onBlur={() => alterarPlano(item, tipo, plano, true)}
                      />
                    </View>
                  </View>
                );
              })}

              <View style={styles.linhaSerie}>
                <Text style={[styles.colTipo, { color: colors.text }]}>Descanso</Text>
                <View style={styles.colQtd}>
                  <Contador
                    rotulo="descanso"
                    valor={item.descansoSeg}
                    passo={15}
                    max={600}
                    formatar={formatarDescanso}
                    onChange={(v) => alterarDescanso(item, v)}
                  />
                </View>
              </View>

              <Botao
                titulo={item.exercicio.videoUrl ? 'Ver execução' : 'Adicionar vídeo de execução'}
                icone={item.exercicio.videoUrl ? 'play-circle' : 'videocam-outline'}
                variante="secundario"
                onPress={() => setVideoDe(item)}
                style={styles.botaoVideo}
              />
            </>
          )}
        </Cartao>
      ))}

      <ModalVideo
        key={videoDe?.id}
        visivel={videoDe !== null}
        nomeExercicio={videoDe?.exercicio.nome ?? ''}
        videoUrl={videoDe?.exercicio.videoUrl ?? null}
        onFechar={() => setVideoDe(null)}
        onSalvar={(url) => videoDe && salvarVideo(videoDe.exercicioId, url)}
      />

      <Botao
        titulo="Adicionar exercícios"
        icone="add"
        variante="secundario"
        onPress={() =>
          router.push({ pathname: '/treinos/adicionar-exercicio', params: { fichaId: String(ficha.id) } })
        }
      />
      <Botao titulo="Adicionar cardio" icone="pulse-outline" variante="secundario" onPress={abrirCardio} />
      {cardioNovo && (
        <ModalCardio
          key={cardioNovo.n}
          visivel
          atividadeInicial={cardioNovo.atividade}
          onAdicionar={adicionarCardio}
          onFechar={() => setCardioNovo(null)}
        />
      )}

      <MusculosDoTreino itens={itens} />

      <Botao
        titulo={salvo ? 'Treino salvo!' : 'Salvar treino'}
        icone={salvo ? 'checkmark-done-circle' : 'checkmark-circle-outline'}
        onPress={salvo ? () => {} : salvarTreino}
        style={styles.salvar}
      />

      <Botao titulo="Apagar treino" variante="perigo" icone="trash-outline" onPress={apagarTreino} style={styles.apagar} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  carregando: { marginTop: 40 },
  vazio: { padding: 24, textAlign: 'center' },
  conteudo: { padding: 16, gap: 12, paddingBottom: 40 },
  rotulo: { fontSize: 14, fontWeight: '600', opacity: 0.7 },
  secao: { fontSize: 20, fontWeight: '700', marginTop: 12 },
  cartao: { gap: 8 },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  posicao: { fontSize: 18, fontWeight: '700', width: 22, textAlign: 'center' },
  flex: { flex: 1 },
  nome: { fontSize: 17, fontWeight: '600' },
  detalhe: { fontSize: 14, opacity: 0.6 },
  tabelaCabecalho: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  legenda: { fontSize: 12, opacity: 0.5, textTransform: 'uppercase' },
  linhaSerie: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  colTipo: { width: 88, flexShrink: 0, fontSize: 14 },
  colQtd: { width: 100, flexShrink: 0, alignItems: 'center' },
  colReps: { flex: 1, minWidth: 0, textAlign: 'center' },
  campoReps: { width: '100%', paddingVertical: 6, paddingHorizontal: 4, textAlign: 'center' },
  inativo: { opacity: 0.4 },
  botaoVideo: { marginTop: 4, paddingVertical: 8 },
  salvar: { marginTop: 12, paddingVertical: 16 },
  apagar: { marginTop: 24 },
});
