import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useFocusEffect, useLocalSearchParams, useTheme } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useConfirmacao } from '@/components/dialogo-confirmacao';
import { Botao, BotaoIcone, Campo, Cartao, CriarComNome, Selo } from '@/components/ui';
import { repo, type Ficha, type Rotina } from '@/db';
import { CORES } from '@/lib/tema';

type FichaComTotal = Ficha & { totalExercicios: number };

export default function TelaRotina() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const rotinaId = Number(id);
  const { colors } = useTheme();
  const [rotina, setRotina] = useState<Rotina | null>(null);
  const [nome, setNome] = useState('');
  const [fichas, setFichas] = useState<FichaComTotal[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [reordenando, setReordenando] = useState(false);
  const { confirmar, dialogo } = useConfirmacao();

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      (async () => {
        const [r, lista] = await Promise.all([repo.obterRotina(rotinaId), repo.listarFichas(rotinaId)]);
        const comTotal = await Promise.all(
          lista.map(async (f) => ({
            ...f,
            totalExercicios: (await repo.listarExerciciosDaFicha(f.id)).length,
          }))
        );
        if (!ativo) return;
        setRotina(r);
        setNome(r?.nome ?? '');
        setFichas(comTotal);
        setCarregado(true);
      })();
      return () => {
        ativo = false;
      };
    }, [rotinaId])
  );

  if (!carregado) return <ActivityIndicator style={styles.carregando} />;
  if (!rotina) {
    return <Text style={[styles.vazio, { color: colors.text }]}>Rotina não encontrada.</Text>;
  }

  const salvarNome = async () => {
    const limpo = nome.trim();
    if (!limpo) {
      setNome(rotina.nome);
      return;
    }
    if (limpo === rotina.nome) return;
    await repo.atualizarRotina(rotina.id, { nome: limpo });
    setRotina({ ...rotina, nome: limpo });
  };

  const ativar = async () => {
    await repo.ativarRotina(rotina.id);
    setRotina({ ...rotina, ativa: true });
  };

  const mover = async (indice: number, delta: -1 | 1) => {
    const nova = [...fichas];
    const [item] = nova.splice(indice, 1);
    nova.splice(indice + delta, 0, item);
    setFichas(nova);
    await repo.reordenarFichas(nova.map((f) => f.id));
  };

  const criarTreino = async (nomeTreino: string) => {
    const ficha = await repo.criarFicha({ rotinaId: rotina.id, nome: nomeTreino, descricao: null });
    router.push({ pathname: '/treinos/ficha/[id]', params: { id: String(ficha.id) } });
  };

  const apagar = async () => {
    const ok = await confirmar({
      titulo: 'Apagar rotina?',
      destaque: rotina.nome,
      mensagem: 'A rotina e os treinos dela serão apagados. O histórico de sessões já feitas continua salvo.',
    });
    if (!ok) return;
    await repo.removerRotina(rotina.id);
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: rotina.nome }} />
      {dialogo}

      <Text style={[styles.rotulo, { color: colors.text }]}>Nome da rotina</Text>
      <Campo value={nome} onChangeText={setNome} onBlur={salvarNome} />

      {rotina.ativa ? (
        <View style={styles.linhaAtiva}>
          <Selo texto="Rotina ativa" />
          <Text style={[styles.detalhe, { color: colors.text }]}>O treino do dia segue esta rotina.</Text>
        </View>
      ) : (
        <Botao titulo="Usar esta rotina" variante="secundario" icone="checkmark-circle-outline" onPress={ativar} />
      )}

      <View style={styles.cabecalhoSecao}>
        <Text style={[styles.secao, { color: colors.text }]}>Treinos</Text>
        {fichas.length > 1 && (
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setReordenando(!reordenando)}
            style={({ pressed }) => [
              styles.botaoReordenar,
              { borderColor: CORES.dourado, opacity: pressed ? 0.6 : 1 },
              reordenando && { backgroundColor: CORES.dourado },
            ]}>
            <Ionicons
              name={reordenando ? 'checkmark' : 'swap-vertical'}
              size={16}
              color={reordenando ? CORES.sobreDestaque : CORES.dourado}
            />
            <Text style={[styles.textoReordenar, { color: reordenando ? CORES.sobreDestaque : CORES.dourado }]}>
              {reordenando ? 'Concluir' : 'Reordenar'}
            </Text>
          </Pressable>
        )}
      </View>
      {reordenando && (
        <Text style={[styles.detalhe, { color: colors.text }]}>
          Esta é a ordem do rodízio da semana. Use as setas para subir ou descer cada treino.
        </Text>
      )}

      {fichas.map((f, i) => {
        const conteudo = (
          <View style={styles.linhaTreino}>
            <Text style={[styles.posicao, { color: CORES.dourado }]}>{i + 1}</Text>
            <View style={styles.flex}>
              <Text style={[styles.nome, { color: colors.text }]}>{f.nome}</Text>
              <Text style={[styles.detalhe, { color: colors.text }]}>
                {f.totalExercicios === 1 ? '1 exercício' : `${f.totalExercicios} exercícios`}
              </Text>
            </View>
          </View>
        );

        if (reordenando) {
          return (
            <Cartao key={f.id} style={[styles.item, { borderColor: CORES.dourado }]}>
              <View style={styles.flex}>{conteudo}</View>
              <View style={styles.setas}>
                <BotaoIcone icone="chevron-up" rotulo="Subir" desabilitado={i === 0} onPress={() => mover(i, -1)} />
                <BotaoIcone
                  icone="chevron-down"
                  rotulo="Descer"
                  desabilitado={i === fichas.length - 1}
                  onPress={() => mover(i, 1)}
                />
              </View>
            </Cartao>
          );
        }

        return (
          <Pressable
            key={f.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/treinos/ficha/[id]', params: { id: String(f.id) } })}>
            {({ pressed }) => (
              <Cartao style={[styles.item, { opacity: pressed ? 0.7 : 1 }]}>
                <View style={styles.flex}>{conteudo}</View>
                <Ionicons name="chevron-forward" size={22} color={colors.text} />
              </Cartao>
            )}
          </Pressable>
        );
      })}

      {/* marginTop 'auto' empurra o rodapé para o fim da tela quando a lista é curta. */}
      <View style={styles.rodape}>
        {!reordenando && (
          <CriarComNome titulo="Criar novo treino" placeholder='Nome do treino (ex.: "Treino A - Peito")' onCriar={criarTreino} />
        )}
        <Botao titulo="Apagar rotina" variante="perigo" icone="trash-outline" onPress={apagar} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  carregando: { marginTop: 40 },
  vazio: { padding: 24, textAlign: 'center' },
  conteudo: { flexGrow: 1, padding: 16, gap: 12, paddingBottom: 32 },
  rotulo: { fontSize: 14, fontWeight: '600', opacity: 0.7 },
  linhaAtiva: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cabecalhoSecao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  secao: { fontSize: 20, fontWeight: '700' },
  botaoReordenar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  textoReordenar: { fontSize: 14, fontWeight: '700' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 76 },
  linhaTreino: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  posicao: { fontSize: 20, fontWeight: '700', width: 22, textAlign: 'center' },
  flex: { flex: 1 },
  nome: { fontSize: 17, fontWeight: '600' },
  detalhe: { fontSize: 14, opacity: 0.6 },
  setas: { gap: 2 },
  rodape: { marginTop: 'auto', paddingTop: 24, gap: 12 },
});
