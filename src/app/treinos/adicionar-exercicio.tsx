import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams, useTheme } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao, Campo } from '@/components/ui';
import { repo, type Exercicio } from '@/db';
import { avisar, mensagemDeErro } from '@/lib/avisos';
import { GRUPO_CARDIO } from '@/lib/cardio';
import { CATALOGO, GRUPOS, NOMES_DO_CATALOGO, combina, normalizar, obterOuCriarExercicio } from '@/lib/catalogo';
import { CORES } from '@/lib/tema';

/** Uma linha da lista: exercício do catálogo ou criado pelo usuário (já salvo). */
interface Opcao {
  chave: string;
  nome: string;
  grupo: string | null;
  /** Presente quando já existe no app (exercícios criados pelo usuário). */
  exercicio?: Exercicio;
}

const TODOS = 'Todos';
const FILTROS = [TODOS, ...GRUPOS];

const DO_CATALOGO: Opcao[] = CATALOGO.flatMap((g) =>
  g.exercicios.map((nome) => ({ chave: `c:${g.nome}:${nome}`, nome, grupo: g.nome }))
);

const PLANO_PADRAO = {
  aquecimento: { series: 1, repeticoes: '15' },
  preparatoria: { series: 0, repeticoes: '5' },
  validas: { series: 3, repeticoes: '8-12' },
  descansoSeg: 90,
};

export default function AdicionarExercicio() {
  const { fichaId } = useLocalSearchParams<{ fichaId: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const busca = useRef<TextInput>(null);
  const [meus, setMeus] = useState<Exercicio[]>([]);
  const [termo, setTermo] = useState('');
  const [grupo, setGrupo] = useState(TODOS);
  const [selecionados, setSelecionados] = useState<Opcao[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    repo.listarExercicios().then(setMeus);
  }, []);

  const opcoes = useMemo<Opcao[]>(() => {
    const doGrupo = (g: string | null) => grupo === TODOS || g === grupo;
    const proprios: Opcao[] = meus
      .filter((e) => !NOMES_DO_CATALOGO.has(normalizar(e.nome)) && e.grupoMuscular !== GRUPO_CARDIO)
      .map((e) => ({ chave: `m:${e.id}`, nome: e.nome, grupo: e.grupoMuscular, exercicio: e }));
    return [...proprios, ...DO_CATALOGO].filter((o) => doGrupo(o.grupo) && combina(termo, o.nome));
  }, [meus, termo, grupo]);

  const alternar = (opcao: Opcao) =>
    setSelecionados((atual) =>
      atual.some((o) => o.chave === opcao.chave)
        ? atual.filter((o) => o.chave !== opcao.chave)
        : [...atual, opcao]
    );

  const criarPersonalizado = async () => {
    const nome = termo.trim();
    if (!nome) {
      busca.current?.focus();
      return;
    }
    const exercicio = await repo.criarExercicio({
      nome,
      grupoMuscular: grupo === TODOS ? null : grupo,
      videoUrl: null,
      observacoes: null,
    });
    setMeus((atual) => [...atual, exercicio]);
    setSelecionados((atual) => [
      ...atual,
      { chave: `m:${exercicio.id}`, nome: exercicio.nome, grupo: exercicio.grupoMuscular, exercicio },
    ]);
    setTermo('');
  };

  const adicionar = async () => {
    setSalvando(true);
    try {
      for (const opcao of selecionados) {
        const exercicio = opcao.exercicio ?? (await obterOuCriarExercicio(opcao.nome, opcao.grupo));
        await repo.adicionarExercicioNaFicha({
          fichaId: Number(fichaId),
          exercicioId: exercicio.id,
          ...structuredClone(PLANO_PADRAO),
        });
      }
      router.back();
    } catch (e) {
      avisar('Não foi possível adicionar', mensagemDeErro(e));
      setSalvando(false);
    }
  };

  const limpo = termo.trim();
  const nomeExiste = opcoes.some((o) => normalizar(o.nome) === normalizar(limpo));

  const cabecalhoLista =
    limpo && nomeExiste ? null : (
      <Pressable accessibilityRole="button" onPress={criarPersonalizado} style={styles.personalizado}>
        <Ionicons name="add-circle-outline" size={22} color={CORES.dourado} />
        <View style={styles.flex}>
          <Text style={styles.textoPersonalizado}>
            {limpo ? `Criar exercício "${limpo}"` : 'Não achou? Crie com o seu nome'}
          </Text>
          {!limpo && <Text style={styles.detalhe}>Digite o nome na busca acima</Text>}
          {!!limpo && grupo !== TODOS && <Text style={styles.detalhe}>Grupo: {grupo}</Text>}
        </View>
      </Pressable>
    );

  return (
    <View style={[styles.tela, { backgroundColor: colors.background }]}>
      <View style={styles.topo}>
        <Campo
          ref={busca}
          autoFocus
          placeholder="Buscar exercício (ex.: supino, remada)"
          value={termo}
          onChangeText={setTermo}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtros}>
          {FILTROS.map((f) => {
            const ativo = f === grupo;
            return (
              <Pressable
                key={f}
                accessibilityRole="button"
                onPress={() => setGrupo(f)}
                style={[
                  styles.chip,
                  { borderColor: ativo ? CORES.vermelho : CORES.borda },
                  ativo && { backgroundColor: CORES.vermelho },
                ]}>
                <Text style={styles.textoChip}>{f}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={opcoes}
        keyExtractor={(o) => o.chave}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={cabecalhoLista}
        ListEmptyComponent={<Text style={styles.vazio}>Nenhum exercício encontrado com esse nome.</Text>}
        renderItem={({ item: opcao }) => {
          const marcado = selecionados.some((o) => o.chave === opcao.chave);
          const detalhe = [opcao.grupo, opcao.exercicio && 'Personalizado'].filter(Boolean).join(' · ');
          return (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: marcado }}
              onPress={() => alternar(opcao)}
              style={({ pressed }) => [styles.linha, { opacity: pressed ? 0.6 : 1 }]}>
              <Ionicons
                name={marcado ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={marcado ? CORES.vermelho : CORES.borda}
              />
              <View style={styles.flex}>
                <Text style={styles.nome}>{opcao.nome}</Text>
                {!!detalhe && <Text style={styles.detalhe}>{detalhe}</Text>}
              </View>
            </Pressable>
          );
        }}
      />

      <View style={[styles.rodape, { paddingBottom: 12 + insets.bottom }]}>
        <Botao
          titulo={
            selecionados.length === 0
              ? 'Selecione exercícios'
              : `Adicionar ${selecionados.length} ${selecionados.length === 1 ? 'exercício' : 'exercícios'}`
          }
          desabilitado={selecionados.length === 0 || salvando}
          onPress={adicionar}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1 },
  topo: { padding: 12, gap: 10 },
  filtros: { gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  textoChip: { color: CORES.texto },
  personalizado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: CORES.borda,
  },
  textoPersonalizado: { color: CORES.dourado, fontSize: 16, fontWeight: '700' },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: CORES.borda,
  },
  flex: { flex: 1 },
  nome: { color: CORES.texto, fontSize: 16, fontWeight: '500' },
  detalhe: { color: CORES.textoSuave, fontSize: 13 },
  vazio: { color: CORES.textoSuave, padding: 24, textAlign: 'center' },
  rodape: { padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: CORES.borda },
});
