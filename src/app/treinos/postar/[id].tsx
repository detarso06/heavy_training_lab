import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Botao, Campo, Cartao } from '@/components/ui';
import { repo, type Sessao } from '@/db';
import { mensagemDeErro } from '@/lib/avisos';
import { postarCheckin, useUsuarioClub } from '@/lib/club';
import { carregarHistoricoCompleto, prsDaSessao, type Recorde } from '@/lib/prs';
import { formatarDuracao, formatarKg, resumirSeries } from '@/lib/sessao';
import { CORES } from '@/lib/tema';

interface Dados {
  sessao: Sessao;
  prs: Recorde[];
  total: ReturnType<typeof resumirSeries>;
}

/** Post do treino concluído no Heavy Training Club: foto opcional, legenda, números e PRs do dia. */
export default function TelaPostar() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const usuario = useUsuarioClub();
  const [dados, setDados] = useState<Dados | null>(null);
  const [foto, setFoto] = useState<{ uri: string; largura: number } | null>(null);
  const [legenda, setLegenda] = useState('');
  const [postando, setPostando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const sessao = await repo.obterSessao(Number(id));
      if (!sessao) return;
      const [{ sessoes, series, nomes }, daSessao] = await Promise.all([
        carregarHistoricoCompleto(),
        repo.listarSeriesDaSessao(sessao.id),
      ]);
      if (ativo) setDados({ sessao, prs: prsDaSessao(sessao, sessoes, series, nomes), total: resumirSeries(daSessao) });
    })();
    return () => {
      ativo = false;
    };
  }, [id]);

  if (usuario === undefined || !dados) return <ActivityIndicator style={styles.carregando} />;

  if (usuario === null) {
    return (
      <View style={styles.centro}>
        <Text style={styles.suave}>Entre no Heavy Training Club para postar seus treinos para os amigos.</Text>
        <Botao titulo="Ir para o Club" icone="people-outline" onPress={() => router.navigate('/club')} />
      </View>
    );
  }

  const { sessao, prs, total } = dados;

  const escolherFoto = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 5],
      quality: 1,
    });
    if (!r.canceled) setFoto({ uri: r.assets[0].uri, largura: r.assets[0].width });
  };

  const postar = async () => {
    setPostando(true);
    setErro(null);
    try {
      await postarCheckin({ sessao, prs, foto, legenda });
      router.back();
    } catch (e) {
      setErro(mensagemDeErro(e));
      setPostando(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
      <Pressable accessibilityRole="button" onPress={escolherFoto} style={styles.moldura}>
        {foto ? (
          <Image source={{ uri: foto.uri }} style={styles.foto} contentFit="cover" accessibilityLabel="Foto escolhida" />
        ) : (
          <View style={[styles.foto, styles.semFoto]}>
            <Ionicons name="camera-outline" size={40} color={CORES.dourado} />
            <Text style={styles.textoFoto}>Adicionar foto do treino</Text>
            <Text style={styles.suave}>Opcional</Text>
          </View>
        )}
      </Pressable>
      {foto && (
        <View style={styles.linhaBotoes}>
          <Botao titulo="Trocar foto" variante="secundario" icone="images-outline" onPress={escolherFoto} style={styles.flex} />
          <Botao titulo="Remover foto" variante="secundario" icone="close" onPress={() => setFoto(null)} style={styles.flex} />
        </View>
      )}

      <Campo
        placeholder="Legenda (opcional)"
        value={legenda}
        onChangeText={setLegenda}
        multiline
        maxLength={280}
        style={styles.legenda}
      />

      <Cartao style={styles.resumo}>
        <Text style={styles.treino}>{sessao.nome}</Text>
        <Text style={styles.suave}>
          {formatarDuracao((sessao.fim ?? sessao.inicio) - sessao.inicio)} · {total.series} séries · {total.repeticoes} reps ·{' '}
          {formatarKg(total.volume)}
        </Text>
        {prs.map((pr) => (
          <View key={pr.exercicioId} style={styles.pr}>
            <Ionicons name="trophy" size={16} color={CORES.dourado} />
            <Text style={styles.textoPr}>
              PR em {pr.exercicio}: {formatarKg(pr.carga)} × {pr.repeticoes}
            </Text>
          </View>
        ))}
      </Cartao>

      {erro && <Text style={styles.erro}>{erro}</Text>}
      <Botao
        titulo={postando ? 'Postando…' : 'Postar no Club'}
        icone="send-outline"
        onPress={postar}
        desabilitado={postando}
        style={styles.postar}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  carregando: { marginTop: 40 },
  centro: { flex: 1, padding: 24, justifyContent: 'center', gap: 16 },
  conteudo: { padding: 16, gap: 12, paddingBottom: 40 },
  moldura: { borderRadius: 12, overflow: 'hidden', borderWidth: 1.5, borderColor: CORES.borda, borderStyle: 'dashed' },
  foto: { width: '100%', aspectRatio: 4 / 5 },
  semFoto: { alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: CORES.cartao },
  textoFoto: { color: CORES.texto, fontSize: 17, fontWeight: '700' },
  suave: { color: CORES.textoSuave, fontSize: 14, textAlign: 'center' },
  linhaBotoes: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  legenda: { minHeight: 80, textAlignVertical: 'top' },
  resumo: { gap: 6 },
  treino: { color: CORES.texto, fontSize: 18, fontWeight: '800' },
  pr: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  textoPr: { color: CORES.dourado, fontSize: 14, fontWeight: '700', flexShrink: 1 },
  erro: { color: CORES.vermelho, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  postar: { paddingVertical: 16 },
});
