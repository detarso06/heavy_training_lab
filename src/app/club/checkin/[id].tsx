import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AvatarClub, CartaoCheckin, quandoFoi } from '@/components/cartao-checkin';
import { useConfirmacao } from '@/components/dialogo-confirmacao';
import { BotaoIcone, Campo } from '@/components/ui';
import { mensagemDeErro } from '@/lib/avisos';
import {
  apagarComentario,
  comentar,
  LIMITE_COMENTARIO,
  listarComentarios,
  obterCheckin,
  urlsDasFotos,
  useUsuarioClub,
  type Checkin,
  type Comentario,
} from '@/lib/club';
import { CORES } from '@/lib/tema';

/** Post (check-in) aberto: o treino completo e os comentários, com campo para comentar. */
export default function TelaCheckin() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const eu = useUsuarioClub();
  const insets = useSafeAreaInsets();
  const { confirmar, dialogo } = useConfirmacao();
  const rolagem = useRef<ScrollView>(null);
  const [post, setPost] = useState<{ checkin: Checkin; urlFoto?: string } | 'sumiu' | null>(null);
  const [comentarios, setComentarios] = useState<Comentario[] | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregarComentarios = useCallback(async () => {
    const lista = await listarComentarios(id);
    setComentarios(lista);
    return lista;
  }, [id]);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const checkin = await obterCheckin(id);
        if (!checkin) {
          if (ativo) setPost('sumiu');
          return;
        }
        const fotos = await urlsDasFotos(checkin.foto ? [checkin.foto] : []);
        if (!ativo) return;
        setPost({ checkin, urlFoto: checkin.foto ? fotos.get(checkin.foto) : undefined });
        await carregarComentarios();
      } catch (e) {
        if (ativo) setErro(mensagemDeErro(e));
      }
    })();
    return () => {
      ativo = false;
    };
  }, [id, carregarComentarios]);

  if (post === 'sumiu') {
    return (
      <View style={styles.centro}>
        <Text style={styles.suave}>Esse treino foi apagado ou não está mais visível para você.</Text>
      </View>
    );
  }
  if (!post) {
    return erro ? <Text style={styles.erro}>{erro}</Text> : <ActivityIndicator style={styles.carregando} />;
  }

  const { checkin, urlFoto } = post;
  const meuPost = checkin.usuario === eu;

  const enviar = async () => {
    if (!texto.trim() || enviando) return;
    setEnviando(true);
    try {
      await comentar(checkin.id, texto);
      setTexto('');
      setErro(null);
      await carregarComentarios();
      setTimeout(() => rolagem.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  };

  const verPerfil = (usuario: string) => router.push({ pathname: '/club/amigo/[id]', params: { id: usuario } });

  const apagar = async (c: Comentario) => {
    const texto = c.texto ?? '';
    const ok = await confirmar({
      titulo: 'Apagar comentário?',
      destaque: texto.length > 60 ? `${texto.slice(0, 60)}…` : texto || undefined,
      textoConfirmar: 'Apagar',
    });
    if (!ok) return;
    try {
      await apagarComentario(c.id);
      setComentarios((lista) => lista?.filter((x) => x.id !== c.id) ?? null);
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.tela}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      // Altura do cabeçalho da pilha (barra de status + título).
      keyboardVerticalOffset={insets.top + 44}>
      {dialogo}
      <ScrollView ref={rolagem} contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ver o perfil de ${checkin.autor.nome}`}
          disabled={meuPost}
          onPress={() => verPerfil(checkin.usuario)}>
          <CartaoCheckin checkin={checkin} urlFoto={urlFoto} />
        </Pressable>

        <Text style={styles.secao}>Comentários</Text>
        {comentarios === null && <ActivityIndicator />}
        {comentarios?.length === 0 && <Text style={styles.suave}>Ninguém comentou ainda. Seja o primeiro!</Text>}
        {comentarios?.map((c) => {
          const meu = c.usuario === eu;
          return (
            <View key={c.id} style={styles.comentario}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Ver o perfil de ${c.autor.nome}`}
                disabled={meu}
                hitSlop={4}
                onPress={() => verPerfil(c.usuario)}>
                <AvatarClub avatar={c.autor.avatar} tamanho={34} />
              </Pressable>
              {c.bloqueado ? (
                // Quem escreveu não é seu amigo: o texto nem chega no aparelho.
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Comentário bloqueado de ${c.autor.nome}. Ver perfil`}
                  onPress={() => verPerfil(c.usuario)}
                  style={({ pressed }) => [styles.balao, styles.balaoBloqueado, { opacity: pressed ? 0.7 : 1 }]}>
                  <Text style={styles.autor}>
                    {c.autor.nome} <Text style={styles.quando}>· {quandoFoi(c.criadoEm)}</Text>
                  </Text>
                  <View style={styles.bloqueado}>
                    <Ionicons name="lock-closed" size={14} color={CORES.textoSuave} />
                    <Text style={styles.textoBloqueado}>Adicione {c.autor.nome} para ver o comentário</Text>
                  </View>
                  <Text style={styles.verPerfil}>Ver perfil ›</Text>
                </Pressable>
              ) : (
                <View style={styles.balao}>
                  <Text style={styles.autor}>
                    {meu ? 'Você' : c.autor.nome} <Text style={styles.quando}>· {quandoFoi(c.criadoEm)}</Text>
                  </Text>
                  <Text style={styles.texto}>{c.texto}</Text>
                </View>
              )}
              {(meu || meuPost) && (
                <BotaoIcone icone="trash-outline" rotulo="Apagar comentário" cor={CORES.textoSuave} onPress={() => apagar(c)} />
              )}
            </View>
          );
        })}
        {erro && <Text style={styles.erro}>{erro}</Text>}
      </ScrollView>

      <View style={[styles.barra, { paddingBottom: 10 + insets.bottom }]}>
        <Campo
          style={styles.campo}
          value={texto}
          onChangeText={setTexto}
          placeholder="Escreva um comentário…"
          maxLength={LIMITE_COMENTARIO}
          multiline
          accessibilityLabel="Comentário"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enviar comentário"
          disabled={!texto.trim() || enviando}
          onPress={enviar}
          style={({ pressed }) => [
            styles.enviar,
            { opacity: !texto.trim() || enviando ? 0.35 : pressed ? 0.6 : 1 },
          ]}>
          {enviando ? (
            <ActivityIndicator color={CORES.texto} />
          ) : (
            <Ionicons name="send" size={20} color={CORES.texto} />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: CORES.fundo },
  carregando: { marginTop: 40 },
  centro: { flex: 1, padding: 24, justifyContent: 'center' },
  conteudo: { padding: 16, gap: 12, paddingBottom: 24 },
  secao: { color: CORES.texto, fontSize: 20, fontWeight: '700', marginTop: 8 },
  suave: { color: CORES.textoSuave, fontSize: 14, textAlign: 'center' },
  erro: { color: CORES.vermelho, fontSize: 15, fontWeight: '600', textAlign: 'center', padding: 8 },
  comentario: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  balao: {
    flex: 1,
    backgroundColor: CORES.cartao,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CORES.borda,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
  },
  autor: { color: CORES.texto, fontSize: 14, fontWeight: '700' },
  quando: { color: CORES.textoSuave, fontWeight: '400' },
  texto: { color: CORES.texto, fontSize: 15 },
  balaoBloqueado: { borderStyle: 'dashed', borderColor: CORES.textoSuave },
  bloqueado: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  textoBloqueado: { color: CORES.textoSuave, fontSize: 14, fontStyle: 'italic', flexShrink: 1 },
  verPerfil: { color: CORES.dourado, fontSize: 14, fontWeight: '700', marginTop: 2 },
  barra: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: CORES.cartao,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: CORES.borda,
  },
  campo: { flex: 1, maxHeight: 120 },
  enviar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CORES.vermelho,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
