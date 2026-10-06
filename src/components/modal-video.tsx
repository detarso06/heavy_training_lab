import { useEvent } from 'expo';
import { useTheme } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlayerYoutube } from '@/components/player-youtube';
import { Botao, BotaoIcone, Campo } from '@/components/ui';
import { CORES } from '@/lib/tema';
import { buscaNoYoutube, idDoYoutube, normalizarUrl } from '@/lib/video';

function PlayerArquivo({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
    p.play();
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  if (status === 'error') {
    return (
      <View style={styles.erro}>
        <Text style={styles.textoErro}>
          Não foi possível reproduzir este vídeo aqui (o formato pode não ser suportado neste aparelho).
        </Text>
        <Pressable accessibilityRole="link" onPress={() => Linking.openURL(url)}>
          <Text style={{ color: CORES.dourado }}>Abrir no navegador</Text>
        </Pressable>
      </View>
    );
  }
  return <VideoView style={styles.flex} player={player} nativeControls contentFit="contain" />;
}

interface Props {
  visivel: boolean;
  nomeExercicio: string;
  videoUrl: string | null;
  onFechar: () => void;
  onSalvar: (videoUrl: string | null) => void;
}

/** Pop-up que toca o vídeo de execução do exercício e permite trocar o link. */
export function ModalVideo({ visivel, nomeExercicio, videoUrl, onFechar, onSalvar }: Props) {
  const { colors } = useTheme();
  const [editando, setEditando] = useState(false);
  const [link, setLink] = useState('');

  const fechar = () => {
    setEditando(false);
    onFechar();
  };

  const salvar = () => {
    const limpo = link.trim();
    onSalvar(limpo ? normalizarUrl(limpo) : null);
    setEditando(false);
  };

  const youtube = videoUrl ? idDoYoutube(videoUrl) : null;
  const mostrarCampo = editando || !videoUrl;

  return (
    <Modal visible={visivel} animationType="slide" presentationStyle="pageSheet" onRequestClose={fechar}>
      <SafeAreaView style={[styles.tela, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={[styles.cabecalho, { borderColor: colors.border }]}>
          <Text style={[styles.titulo, { color: colors.text }]} numberOfLines={2}>
            {nomeExercicio}
          </Text>
          <BotaoIcone icone="close" rotulo="Fechar" onPress={fechar} />
        </View>

        <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
          {videoUrl && (
            <View style={styles.player}>
              {youtube ? <PlayerYoutube id={youtube} /> : <PlayerArquivo key={videoUrl} url={videoUrl} />}
            </View>
          )}

          {!videoUrl && (
            <Text style={[styles.aviso, { color: colors.text }]}>
              Este exercício ainda não tem vídeo. Cole um link do YouTube (ou de um arquivo de vídeo) para ver a
              execução aqui.
            </Text>
          )}

          {mostrarCampo ? (
            <View style={styles.form}>
              <Campo
                autoFocus={editando}
                placeholder="Link do vídeo (ex.: youtube.com/watch?v=...)"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                value={link}
                onChangeText={setLink}
                onSubmitEditing={salvar}
              />
              <View style={styles.linhaBotoes}>
                {editando && (
                  <Botao titulo="Cancelar" variante="secundario" onPress={() => setEditando(false)} style={styles.flex} />
                )}
                <Botao titulo="Salvar vídeo" onPress={salvar} desabilitado={!link.trim()} style={styles.flex} />
              </View>
              <Botao
                titulo="Procurar no YouTube"
                variante="secundario"
                icone="logo-youtube"
                onPress={() => Linking.openURL(buscaNoYoutube(nomeExercicio))}
              />
            </View>
          ) : (
            <View style={styles.linhaBotoes}>
              <Botao
                titulo="Trocar vídeo"
                variante="secundario"
                icone="swap-horizontal"
                onPress={() => {
                  setLink(videoUrl ?? '');
                  setEditando(true);
                }}
                style={styles.flex}
              />
              <Botao
                titulo="Remover"
                variante="perigo"
                icone="trash-outline"
                onPress={() => onSalvar(null)}
                style={styles.flex}
              />
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1 },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titulo: { flex: 1, fontSize: 18, fontWeight: '700' },
  conteudo: { padding: 16, gap: 16 },
  player: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', borderRadius: 12, overflow: 'hidden' },
  flex: { flex: 1 },
  erro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 16 },
  textoErro: { textAlign: 'center', color: CORES.texto },
  aviso: { fontSize: 15, opacity: 0.7 },
  form: { gap: 10 },
  linhaBotoes: { flexDirection: 'row', gap: 10 },
});
