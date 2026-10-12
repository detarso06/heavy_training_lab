import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CartaoMeta } from '@/components/cartao-meta';
import { CartaoSequencia } from '@/components/cartao-sequencia';
import { FeedClub } from '@/components/feed-club';
import { SeletorTreino } from '@/components/seletor-treino';
import { useConfirmacao } from '@/components/dialogo-confirmacao';
import { repo, type Ficha, type Perfil, type Rotina, type Sessao } from '@/db';
import { formatarLitros, formatarMinutos, periodoDaAgua, periodoDoCardio } from '@/lib/metas';
import { calcularTreinoDoDia, descansoDeHoje, inicioDaSemana, treinoDeHoje, type TreinoDoDia } from '@/lib/rodizio';
import { calcularSequencia, type Sequencia } from '@/lib/sequencia';
import { CORES } from '@/lib/tema';

interface Dados {
  rotina: Rotina | null;
  fichas: Ficha[];
  treino: TreinoDoDia;
  perfil: Perfil;
  sequencia: Sequencia;
  /** Treino iniciado e ainda não finalizado. */
  sessaoAtiva: Sessao | null;
  /** "Descansei hoje" já marcado. */
  descansoHoje: Sessao | null;
  /** Treino concluído hoje (o mais recente). */
  treinoHoje: Sessao | null;
}

export default function Inicio() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [cardio, setCardio] = useState(0);
  const [agua, setAgua] = useState(0);
  // Períodos fixados ao carregar, para não "pular" de dia no meio do arraste.
  const [periodos, setPeriodos] = useState({ cardio: '', agua: '' });
  const { confirmar, dialogo } = useConfirmacao();
  /** Treino escolhido no lugar da sugestão do rodízio (nulo = segue a sugestão). */
  const [escolhida, setEscolhida] = useState<number | null>(null);
  const [trocando, setTrocando] = useState(false);

  /** `aindaAtivo` evita gravar estado depois que a tela perdeu o foco. */
  const carregar = useCallback(async (aindaAtivo: () => boolean = () => true) => {
    const hoje = new Date();
    const p = { cardio: periodoDoCardio(hoje), agua: periodoDaAgua(hoje) };
    const rotina = await repo.obterRotinaAtiva();
    const [fichas, todasSessoes, perfil, feitoCardio, feitoAgua, sessaoAtiva] = await Promise.all([
      rotina ? repo.listarFichas(rotina.id) : Promise.resolve([]),
      repo.listarSessoes(),
      repo.obterPerfil(),
      repo.obterProgresso('cardio', p.cardio),
      repo.obterProgresso('agua', p.agua),
      repo.obterSessaoAtiva(),
    ]);
    if (!aindaAtivo()) return;
    const daSemana = todasSessoes.filter((s) => s.inicio >= inicioDaSemana(hoje));
    setDados({
      rotina,
      fichas,
      treino: calcularTreinoDoDia(fichas, daSemana),
      perfil,
      sequencia: calcularSequencia(todasSessoes, hoje),
      sessaoAtiva,
      descansoHoje: descansoDeHoje(fichas, todasSessoes, hoje),
      treinoHoje: treinoDeHoje(fichas, todasSessoes, hoje),
    });
    setPeriodos(p);
    setCardio(feitoCardio);
    setAgua(feitoAgua);
  }, []);

  // Recarrega sempre que a tela volta ao foco (ex.: depois de criar treino ou mudar metas).
  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      carregar(() => ativo);
      return () => {
        ativo = false;
      };
    }, [carregar])
  );

  if (!dados) return <ActivityIndicator style={styles.carregando} />;

  const { rotina, fichas, treino, perfil, sequencia, sessaoAtiva, descansoHoje, treinoHoje } = dados;
  const semFichas = fichas.length === 0;
  const treinos = fichas.filter((f) => !f.descanso);
  /** Próximo treino de verdade (pula descansos); semana concluída: o primeiro, como extra. */
  const proximoTreino = treinos.find((f) => !treino.feitasNaSemana.has(f.id)) ?? treinos[0] ?? null;

  const fichaEscolhida = fichas.find((f) => f.id === escolhida) ?? null;
  /** Já descansou hoje e não escolheu outro: o botão oferece treinar mesmo assim. */
  const descansando = descansoHoje !== null && !fichaEscolhida && !sessaoAtiva;
  /** Já treinou hoje (e não escolheu outro): mostra "Treino do dia feito" e oferece o próximo. */
  const treinou = treinoHoje !== null && !descansando && !fichaEscolhida && !sessaoAtiva;
  /** Item do rodízio que o botão vai iniciar (ou marcar, se for descanso). */
  const fichaDoDia =
    descansando || treinou ? proximoTreino : (fichaEscolhida ?? treino.ficha ?? proximoTreino ?? fichas[0]);
  const ehDescanso = !sessaoAtiva && !treinou && !!fichaDoDia?.descanso;
  const cardioDoDia = !sessaoAtiva && !treinou ? (fichaDoDia?.cardio ?? null) : null;
  /** O que foi feito hoje era o dia de cardio. */
  const fezCardio = treinou && !!fichas.find((f) => f.id === treinoHoje?.fichaId)?.cardio;

  let destaque = fichaDoDia?.nome;
  if (sessaoAtiva) destaque = sessaoAtiva.nome;
  else if (semFichas) destaque = 'Nenhum treino cadastrado';
  else if (descansando) destaque = 'Descanso feito';
  else if (treinou) destaque = fezCardio ? 'Cardio feito!' : 'Treino do dia feito!';
  else if (ehDescanso) destaque = 'Dia de descanso';
  else if (cardioDoDia) destaque = 'Dia de cardio';
  else if (treino.semanaCompleta && !fichaEscolhida) destaque = 'Semana concluída!';

  // Heavy Guy do painel: se preparando enquanto o treino de hoje não foi feito; dormindo depois do treino ou no descanso.
  let ilustracao: { imagem: number; proporcao: number; descricao: string } | null = null;
  if (ehDescanso || descansando) {
    ilustracao = {
      imagem: require('@/../assets/images/descanso.png'),
      proporcao: 800 / 723,
      descricao: 'Heavy Guy dormindo e sonhando com o agachamento',
    };
  } else if (treinou) {
    ilustracao = {
      imagem: require('@/../assets/images/descanso.png'),
      proporcao: 800 / 723,
      descricao: 'Heavy Guy dormindo depois do treino, sonhando com o agachamento',
    };
  } else if (!sequencia.treinouHoje) {
    ilustracao = {
      imagem: require('@/../assets/images/treino-pendente.png'),
      proporcao: 800 / 733,
      descricao: 'Heavy Guy no vestiário enfaixando o punho, pronto para treinar',
    };
  }

  // No "Trocar treino" os descansos aparecem uma vez só (o próximo pendente), e nenhum se já descansou hoje.
  const descansoOpcao = descansoHoje
    ? null
    : treino.ficha?.descanso
      ? treino.ficha
      : fichas.find((f) => f.descanso && !treino.feitasNaSemana.has(f.id));
  const opcoesTroca = fichas.filter((f) => !f.descanso || f.id === descansoOpcao?.id);

  const abrirSessao = (id: number) =>
    router.push({ pathname: '/treinos/sessao/[id]', params: { id: String(id) } });

  const marcarDescanso = async (id: number) => {
    const ok = await confirmar({
      titulo: 'Dia de descanso',
      destaque: 'Descansei hoje',
      mensagem: 'Conta na sua sequência, e o rodízio passa para o próximo treino.',
      textoConfirmar: 'Marcar',
      icone: 'bed-outline',
    });
    if (!ok) return;
    const agora = Date.now();
    await repo.importarSessao({ fichaId: id, nome: 'Descanso', inicio: agora, fim: agora, series: [] });
    setEscolhida(null);
    await carregar();
  };

  const desfazerDescanso = async () => {
    if (!descansoHoje) return;
    const ok = await confirmar({
      titulo: 'Desfazer descanso?',
      destaque: 'Descanso de hoje',
      mensagem: 'O dia de descanso volta a ficar pendente no rodízio.',
      textoConfirmar: 'Desfazer',
      icone: 'arrow-undo-outline',
    });
    if (!ok) return;
    await repo.removerSessao(descansoHoje.id);
    await carregar();
  };

  const aoTocarBotao = async () => {
    if (sessaoAtiva) return abrirSessao(sessaoAtiva.id);
    // Já treinou hoje: escolhe qual treino fazer agora (no seletor) em vez de seguir o rodízio.
    if (treinou) return setTrocando(true);
    if (!fichaDoDia) return router.navigate('/treinos');
    if (fichaDoDia.descanso) return marcarDescanso(fichaDoDia.id);
    await iniciarTreino(fichaDoDia);
  };

  const iniciarCardio = async (ficha: Ficha) => {
    if (!ficha.cardio) return;
    const ok = await confirmar({
      titulo: 'Iniciar cardio?',
      destaque: `${ficha.cardio.atividade} · ${formatarMinutos(ficha.cardio.minutos)}`,
      mensagem: 'O cronômetro começa a contar assim que você confirmar. Ao finalizar, o tempo soma na meta da semana.',
      textoConfirmar: 'Bora!',
      icone: 'pulse-outline',
    });
    if (!ok) return;
    const sessao = await repo.iniciarSessao(ficha.id);
    setEscolhida(null);
    abrirSessao(sessao.id);
  };

  const iniciarTreino = async (ficha: Ficha) => {
    if (ficha.cardio) return iniciarCardio(ficha);
    const exercicios = await repo.listarExerciciosDaFicha(ficha.id);
    if (exercicios.length === 0) {
      const ok = await confirmar({
        titulo: 'Treino sem exercícios',
        destaque: ficha.nome,
        mensagem: 'Adicione os exercícios deste treino antes de começar.',
        textoConfirmar: 'Adicionar',
        icone: 'add-circle-outline',
      });
      if (ok) router.push({ pathname: '/treinos/ficha/[id]', params: { id: String(ficha.id) } });
      return;
    }
    const ok = await confirmar({
      titulo: 'Iniciar treino?',
      destaque: ficha.nome,
      mensagem: `${exercicios.length} ${exercicios.length === 1 ? 'exercício' : 'exercícios'}. O cronômetro começa a contar assim que você confirmar.`,
      textoConfirmar: 'Bora!',
      icone: 'barbell-outline',
    });
    if (!ok) return;
    const sessao = await repo.iniciarSessao(ficha.id);
    setEscolhida(null);
    abrirSessao(sessao.id);
  };

  let textoBotao = 'Iniciar sessão de treino';
  if (sessaoAtiva) textoBotao = 'Continuar treino';
  else if (semFichas || !fichaDoDia) textoBotao = 'Montar meu treino';
  else if (descansando) textoBotao = 'Treinar mesmo assim';
  else if (treinou) textoBotao = 'Fazer outro treino';
  else if (ehDescanso) textoBotao = 'Descansei hoje';
  else if (cardioDoDia) textoBotao = 'Iniciar cardio';

  return (
    <ScrollView contentContainerStyle={styles.conteudo}>
      {dialogo}
      <View style={styles.marca}>
        <Text style={styles.marcaHeavy}>HEAVY</Text>
        <Text style={styles.marcaLab}>TRAINING LAB</Text>
        {!!perfil.nome && <Text style={styles.saudacao}>Bora treinar, {perfil.nome}!</Text>}
      </View>

      <CartaoSequencia sequencia={sequencia} />

      <View style={styles.blocoTreino}>
        {ilustracao && (
          <Image
            source={ilustracao.imagem}
            style={[styles.ilustracao, { aspectRatio: ilustracao.proporcao }]}
            contentFit="contain"
            accessibilityLabel={ilustracao.descricao}
          />
        )}
        {!treinou && <Text style={styles.titulo}>{sessaoAtiva ? 'Treino em andamento' : 'Treino do dia'}</Text>}
        <Text style={styles.destaque}>{destaque}</Text>

        {rotina && (
          <Text style={styles.rotina}>
            Rotina: <Text style={styles.nomeRotina}>{rotina.nome}</Text>
          </Text>
        )}
        {ehDescanso && <Text style={styles.rotina}>Recupere as energias. O descanso conta na sequência.</Text>}
        {cardioDoDia && (
          <Text style={styles.rotina}>
            <Text style={styles.nomeRotina}>{cardioDoDia.atividade}</Text> · {formatarMinutos(cardioDoDia.minutos)}
          </Text>
        )}
        {(descansando || treinou) && fichaDoDia && (
          <Text style={styles.rotina}>
            Próximo treino: <Text style={styles.nomeRotina}>{fichaDoDia.nome}</Text>
          </Text>
        )}
        {descansando && (
          <Pressable
            accessibilityRole="button"
            onPress={desfazerDescanso}
            hitSlop={6}
            style={({ pressed }) => [styles.trocar, { opacity: pressed ? 0.6 : 1 }]}>
            <Ionicons name="arrow-undo-outline" size={18} color={CORES.dourado} />
            <Text style={styles.textoTrocar}>Desfazer descanso</Text>
          </Pressable>
        )}
        {!sessaoAtiva && !treinou && opcoesTroca.length > 1 && (
          <Pressable
            accessibilityRole="button"
            onPress={() => setTrocando(true)}
            hitSlop={6}
            style={({ pressed }) => [styles.trocar, { opacity: pressed ? 0.6 : 1 }]}>
            <Ionicons name="swap-horizontal" size={18} color={CORES.dourado} />
            <Text style={styles.textoTrocar}>Trocar treino</Text>
          </Pressable>
        )}
        <SeletorTreino
          visivel={trocando}
          fichas={treinou ? treinos : opcoesTroca}
          atual={treinou ? null : (fichaDoDia?.id ?? null)}
          sugerida={treinou ? (proximoTreino?.id ?? null) : (treino.ficha?.id ?? null)}
          feitasNaSemana={treino.feitasNaSemana}
          onEscolher={(id) => {
            setTrocando(false);
            const ficha = fichas.find((f) => f.id === id);
            if (treinou && ficha) iniciarTreino(ficha);
            else setEscolhida(id === treino.ficha?.id ? null : id);
          }}
          onFechar={() => setTrocando(false)}
        />

        <Pressable
          accessibilityRole="button"
          onPress={aoTocarBotao}
          style={({ pressed }) => [styles.botao, { opacity: pressed ? 0.8 : 1 }]}>
          <Text style={styles.textoBotao}>{textoBotao}</Text>
        </Pressable>
      </View>

      <Text style={styles.secao}>Metas</Text>
      <CartaoMeta
        titulo="Cardio da semana"
        subtitulo={perfil.cardioAtividade}
        icone="flame-outline"
        valor={cardio}
        meta={perfil.metaCardioMin}
        passo={5}
        formatar={formatarMinutos}
        onChange={setCardio}
        onSoltar={(v) => repo.salvarProgresso('cardio', periodos.cardio, v)}
        textoSemMeta="Defina sua meta de cardio semanal no seu perfil →"
      />
      <CartaoMeta
        titulo="Água de hoje"
        icone="water-outline"
        valor={agua}
        meta={perfil.metaAguaMl}
        passo={100}
        formatar={formatarLitros}
        onChange={setAgua}
        onSoltar={(v) => repo.salvarProgresso('agua', periodos.agua, v)}
        textoSemMeta="Defina sua meta diária de água no seu perfil →"
      />

      <FeedClub />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  carregando: { marginTop: 40 },
  conteudo: { padding: 16, gap: 12, paddingBottom: 40 },
  marca: { alignItems: 'center', marginTop: 8, marginBottom: 4 },
  marcaHeavy: { color: CORES.vermelho, fontSize: 44, fontWeight: '900', letterSpacing: 4, lineHeight: 48 },
  marcaLab: { color: CORES.texto, fontSize: 16, fontWeight: '800', letterSpacing: 6 },
  saudacao: { color: CORES.textoSuave, fontSize: 15, marginTop: 8 },
  blocoTreino: { alignItems: 'center', gap: 12, paddingVertical: 12 },
  titulo: { color: CORES.dourado, fontSize: 16, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  destaque: { color: CORES.texto, fontSize: 26, fontWeight: '800', textAlign: 'center' },
  rotina: { color: CORES.textoSuave, fontSize: 15, textAlign: 'center' },
  nomeRotina: { color: CORES.texto, fontWeight: '700' },
  trocar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  textoTrocar: { color: CORES.dourado, fontSize: 15, fontWeight: '700' },
  botao: {
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: CORES.vermelho,
    paddingVertical: 16,
    borderRadius: 12,
  },
  textoBotao: { color: CORES.texto, fontSize: 18, fontWeight: '700' },
  ilustracao: { width: '100%', maxWidth: 360 },
  secao: { color: CORES.texto, fontSize: 20, fontWeight: '700', marginTop: 8 },
});
