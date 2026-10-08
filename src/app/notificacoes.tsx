import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AvatarClub, quandoFoi } from '@/components/cartao-checkin';
import { Botao, Cartao } from '@/components/ui';
import { mensagemDeErro } from '@/lib/avisos';
import {
  aceitarPedido,
  desfazerVinculo,
  listarNotificacoes,
  marcarNotificacoesVistas,
  urlsDasFotos,
  useUsuarioClub,
  type Notificacoes,
  type Pedido,
} from '@/lib/club';
import { atualizarNovidades } from '@/lib/novidades';
import { CORES } from '@/lib/tema';

/** Sininho: pedidos de amizade (responde aqui mesmo) e check-ins dos amigos (os novos com bolinha). */
export default function TelaNotificacoes() {
  const usuario = useUsuarioClub();

  if (usuario === undefined) return <ActivityIndicator style={styles.carregando} />;
  if (usuario === null) {
    return (
      <View style={styles.centro}>
        <Ionicons name="notifications-outline" size={48} color={CORES.dourado} style={styles.icone} />
        <Text style={styles.suave}>
          As notificações chegam pelo Heavy Training Club: pedidos de amizade e treinos dos seus amigos.
        </Text>
        <Botao titulo="Entrar no Club" icone="people-outline" onPress={() => router.navigate('/club')} />
      </View>
    );
  }
  return <Lista key={usuario} />;
}

function Lista() {
  const [dados, setDados] = useState<Notificacoes | null>(null);
  const [fotos, setFotos] = useState<Map<string, string>>(new Map());
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (aindaAtivo: () => boolean = () => true) => {
    try {
      const n = await listarNotificacoes();
      const urls = await urlsDasFotos(n.checkins.flatMap((c) => (c.foto ? [c.foto] : [])));
      if (!aindaAtivo()) return;
      setDados(n);
      setFotos(urls);
      setErro(null);
      return n;
    } catch (e) {
      if (aindaAtivo()) setErro(mensagemDeErro(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      // Mostra os novos destacados e marca tudo como visto (a bolinha do sininho zera; pedidos seguem até responder).
      carregar(() => ativo).then((n) => {
        if (n) marcarNotificacoesVistas().then(atualizarNovidades).catch(() => {});
      });
      return () => {
        ativo = false;
      };
    }, [carregar])
  );

  if (erro && !dados) {
    return (
      <View style={styles.centro}>
        <Text style={styles.erro}>{erro}</Text>
        <Botao titulo="Tentar de novo" variante="secundario" onPress={() => carregar()} />
      </View>
    );
  }
  if (!dados) return <ActivityIndicator style={styles.carregando} />;

  const responder = async (p: Pedido, aceitar: boolean) => {
    try {
      if (aceitar) await aceitarPedido(p.outro);
      else await desfazerVinculo(p.outro);
      setDados({ ...dados, pedidos: dados.pedidos.filter((x) => x.outro !== p.outro) });
      atualizarNovidades();
      if (aceitar) carregar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  };

  const vazio = dados.pedidos.length === 0 && dados.checkins.length === 0;

  return (
    <ScrollView contentContainerStyle={styles.conteudo}>
      {vazio && (
        <View style={styles.centro}>
          <Ionicons name="notifications-off-outline" size={48} color={CORES.textoSuave} style={styles.icone} />
          <Text style={styles.suave}>Nada por aqui ainda. Adicione amigos no Heavy Club pelo código de amizade.</Text>
        </View>
      )}

      {dados.pedidos.length > 0 && <Text style={styles.secao}>Pedidos de amizade</Text>}
      {dados.pedidos.map((p) => (
        <Cartao key={p.outro} style={[styles.item, styles.novo]}>
          <AvatarClub avatar={p.avatar} />
          <Text style={[styles.texto, styles.flex]}>
            <Text style={styles.nome}>{p.nome}</Text> quer ser seu amigo
          </Text>
          <Botao titulo="Aceitar" onPress={() => responder(p, true)} />
          <Pressable accessibilityRole="button" accessibilityLabel="Recusar" hitSlop={8} onPress={() => responder(p, false)}>
            <Ionicons name="close" size={24} color={CORES.textoSuave} />
          </Pressable>
        </Cartao>
      ))}

      {dados.checkins.length > 0 && <Text style={styles.secao}>Treinos dos amigos</Text>}
      {dados.checkins.map((c) => {
        const novo = c.criadoEm > dados.vistasEm;
        const url = c.foto ? fotos.get(c.foto) : undefined;
        return (
          <Pressable
            key={c.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/club/amigo/[id]', params: { id: c.usuario } })}>
            {({ pressed }) => (
              <Cartao style={[styles.item, novo && styles.novo, { opacity: pressed ? 0.7 : 1 }]}>
                <AvatarClub avatar={c.autor.avatar} />
                <View style={styles.flex}>
                  <Text style={styles.texto}>
                    <Text style={styles.nome}>{c.autor.nome}</Text> treinou {c.treino}
                    {c.prs.length > 0 && ` e bateu ${c.prs.length === 1 ? '1 PR' : `${c.prs.length} PRs`} 🏆`}
                  </Text>
                  <Text style={styles.quando}>{quandoFoi(c.criadoEm)}</Text>
                </View>
                {url && <Image source={{ uri: url }} style={styles.miniatura} contentFit="cover" />}
                {novo && <View style={styles.bolinha} />}
              </Cartao>
            )}
          </Pressable>
        );
      })}

      {erro && <Text style={styles.erro}>{erro}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  carregando: { marginTop: 40 },
  centro: { flexGrow: 1, padding: 24, justifyContent: 'center', gap: 16 },
  icone: { alignSelf: 'center' },
  conteudo: { flexGrow: 1, padding: 16, gap: 10, paddingBottom: 40 },
  secao: { color: CORES.texto, fontSize: 18, fontWeight: '700', marginTop: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  novo: { borderColor: CORES.dourado },
  flex: { flex: 1 },
  texto: { color: CORES.textoSuave, fontSize: 15 },
  nome: { color: CORES.texto, fontWeight: '700' },
  quando: { color: CORES.textoSuave, fontSize: 13, marginTop: 2 },
  miniatura: { width: 48, height: 60, borderRadius: 6 },
  bolinha: { width: 10, height: 10, borderRadius: 5, backgroundColor: CORES.vermelho },
  suave: { color: CORES.textoSuave, fontSize: 15, textAlign: 'center' },
  erro: { color: CORES.vermelho, fontSize: 15, fontWeight: '600', textAlign: 'center' },
});
