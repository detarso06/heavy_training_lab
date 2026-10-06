import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CartaoMeta } from '@/components/cartao-meta';
import { CartaoSequencia } from '@/components/cartao-sequencia';
import { SeletorTreino } from '@/components/seletor-treino';
import { useConfirmacao } from '@/components/dialogo-confirmacao';
import { repo, type Ficha, type Perfil, type Rotina, type Sessao } from '@/db';
import { formatarLitros, formatarMinutos, periodoDaAgua, periodoDoCardio } from '@/lib/metas';
import { calcularTreinoDoDia, inicioDaSemana, type TreinoDoDia } from '@/lib/rodizio';
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

  // Recarrega sempre que a tela volta ao foco (ex.: depois de criar treino ou mudar metas).
  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      (async () => {
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
        if (!ativo) return;
        const daSemana = todasSessoes.filter((s) => s.inicio >= inicioDaSemana(hoje));
        setDados({
          rotina,
          fichas,
          treino: calcularTreinoDoDia(fichas, daSemana),
          perfil,
          sequencia: calcularSequencia(todasSessoes, hoje),
          sessaoAtiva,
        });
        setPeriodos(p);
        setCardio(feitoCardio);
        setAgua(feitoAgua);
      })();
      return () => {
        ativo = false;
      };
    }, [])
  );

  if (!dados) return <ActivityIndicator style={styles.carregando} />;

  const { rotina, fichas, treino, perfil, sequencia, sessaoAtiva } = dados;
  const semFichas = fichas.length === 0;

  const fichaEscolhida = fichas.find((f) => f.id === escolhida) ?? null;
  /** Treino que o botão vai iniciar. Semana concluída: oferece o primeiro do rodízio como extra. */
  const fichaDoDia = fichaEscolhida ?? treino.ficha ?? fichas[0];
  const trocou = fichaEscolhida !== null && fichaEscolhida.id !== treino.ficha?.id;

  let destaque = fichaDoDia?.nome;
  if (sessaoAtiva) destaque = sessaoAtiva.nome;
  else if (semFichas) destaque = 'Nenhum treino cadastrado';
  else if (treino.semanaCompleta && !fichaEscolhida) destaque = 'Semana concluída!';

  const abrirSessao = (id: number) =>
    router.push({ pathname: '/treinos/sessao/[id]', params: { id: String(id) } });

  const aoTocarBotao = async () => {
    if (sessaoAtiva) return abrirSessao(sessaoAtiva.id);
    if (semFichas) return router.navigate('/treinos');
    const ficha = fichaDoDia;
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
  else if (semFichas) textoBotao = 'Montar meu treino';

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
        <Text style={styles.titulo}>{sessaoAtiva ? 'Treino em andamento' : 'Treino do dia'}</Text>
        <Text style={styles.destaque}>{destaque}</Text>

        {rotina && (
          <Text style={styles.rotina}>
            Rotina: <Text style={styles.nomeRotina}>{rotina.nome}</Text>
          </Text>
        )}
        {trocou && treino.ficha && (
          <Text style={styles.rotina}>
            Sugestão do rodízio: <Text style={styles.nomeRotina}>{treino.ficha.nome}</Text>
          </Text>
        )}
        {!sessaoAtiva && fichas.length > 1 && (
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
          fichas={fichas}
          atual={fichaDoDia?.id ?? null}
          sugerida={treino.ficha?.id ?? null}
          feitasNaSemana={treino.feitasNaSemana}
          onEscolher={(id) => {
            setEscolhida(id === treino.ficha?.id ? null : id);
            setTrocando(false);
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

      <View style={styles.club}>
        <View style={styles.seloDev}>
          <Text style={styles.textoSeloDev}>EM DESENVOLVIMENTO</Text>
        </View>
        <Text style={styles.clubHeavy}>HEAVY</Text>
        <Text style={styles.clubNome}>TRAINING CLUB</Text>
        <Image
          source={require('@/../assets/images/heavy-club.png')}
          style={styles.clubImagem}
          contentFit="contain"
          accessibilityLabel="Heavy Guy cansado no banco da academia"
        />
      </View>
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
  rotina: { color: CORES.textoSuave, fontSize: 15 },
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
  club: { alignItems: 'center', marginTop: 28, gap: 2 },
  seloDev: { borderWidth: 1.5, borderColor: CORES.dourado, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12, marginBottom: 10 },
  textoSeloDev: { color: CORES.dourado, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  clubHeavy: { color: CORES.vermelho, fontSize: 36, fontWeight: '900', letterSpacing: 4, lineHeight: 40 },
  clubNome: { color: CORES.texto, fontSize: 15, fontWeight: '800', letterSpacing: 6 },
  clubImagem: { width: '100%', maxWidth: 360, aspectRatio: 774 / 716, marginTop: 12 },
  secao: { color: CORES.texto, fontSize: 20, fontWeight: '700', marginTop: 8 },
});
