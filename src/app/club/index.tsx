import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { AvatarClub } from '@/components/cartao-checkin';
import { useConfirmacao } from '@/components/dialogo-confirmacao';
import { FormularioConta } from '@/components/formulario-conta';
import { Botao, Campo, Cartao } from '@/components/ui';
import { mensagemDeErro } from '@/lib/avisos';
import {
  aceitarPedido,
  clubConfigurado,
  desfazerVinculo,
  enviarPedido,
  listarAmigos,
  listarPedidos,
  obterPerfil,
  publicarRetrato,
  useUsuarioClub,
  type Pedido,
  type PerfilClub,
} from '@/lib/club';
import { CORES } from '@/lib/tema';

export default function TelaClub() {
  const usuario = useUsuarioClub();

  if (!clubConfigurado) {
    return (
      <View style={styles.centro}>
        <Text style={styles.textoSuave}>O Heavy Training Club ainda não foi configurado neste app.</Text>
      </View>
    );
  }
  if (usuario === undefined) return <ActivityIndicator style={styles.carregando} />;
  if (usuario === null) {
    return (
      <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
        <View style={styles.marca}>
          <Text style={styles.marcaHeavy}>HEAVY</Text>
          <Text style={styles.marcaClub}>TRAINING CLUB</Text>
          <Image
            source={require('@/../assets/images/heavy-club.png')}
            style={styles.imagemClub}
            contentFit="contain"
            accessibilityLabel="Heavy Guy exausto no banco da academia"
          />
          <Text style={styles.textoSuave}>
            Treine junto com seus amigos: veja os check-ins, as sequências e os PRs de quem você adicionar.
          </Text>
        </View>
        <FormularioConta />
      </ScrollView>
    );
  }
  return <MeuClub key={usuario} />;
}

interface Dados {
  perfil: PerfilClub;
  pedidos: Pedido[];
  amigos: PerfilClub[];
}

function MeuClub() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [codigo, setCodigo] = useState('');
  const [aviso, setAviso] = useState<{ texto: string; tom: 'ok' | 'erro' } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const { confirmar, dialogo } = useConfirmacao();

  const carregar = useCallback(async (aindaAtivo: () => boolean = () => true) => {
    try {
      const [perfil, pedidos, amigos] = await Promise.all([obterPerfil(), listarPedidos(), listarAmigos()]);
      if (!aindaAtivo()) return;
      setDados({ perfil, pedidos, amigos });
      setErroCarga(null);
    } catch (e) {
      if (aindaAtivo()) setErroCarga(mensagemDeErro(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      carregar(() => ativo);
      // Pedidos e amigos novos aparecem sozinhos enquanto a tela está aberta.
      const intervalo = setInterval(() => carregar(() => ativo), 20000);
      // Deixa sequência, rotina e PRs do perfil em dia sempre que o Club é aberto.
      publicarRetrato().catch(() => {});
      return () => {
        ativo = false;
        clearInterval(intervalo);
      };
    }, [carregar])
  );

  if (erroCarga && !dados) {
    return (
      <View style={styles.centro}>
        <Text style={styles.erro}>{erroCarga}</Text>
        <Botao titulo="Tentar de novo" variante="secundario" onPress={() => carregar()} />
      </View>
    );
  }
  if (!dados) return <ActivityIndicator style={styles.carregando} />;

  const { perfil, pedidos, amigos } = dados;
  const recebidos = pedidos.filter((p) => p.recebido);
  const enviados = pedidos.filter((p) => !p.recebido);
  const desde = new Date(perfil.criadoEm).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const copiar = async () => {
    await Clipboard.setStringAsync(perfil.codigo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const compartilhar = () =>
    Share.share({
      message: `Bora treinar junto no Heavy Training Club! Meu código de amizade é ${perfil.codigo}`,
    }).catch(() => {});

  const adicionar = async () => {
    if (!codigo.trim()) return;
    setAviso(null);
    try {
      const r = await enviarPedido(codigo);
      setCodigo('');
      setAviso({
        texto: r.status === 'aceita' ? `Agora você e ${r.nome} são amigos!` : `Pedido enviado para ${r.nome}.`,
        tom: 'ok',
      });
      await carregar();
    } catch (e) {
      setAviso({ texto: mensagemDeErro(e), tom: 'erro' });
    }
  };

  const responder = async (p: Pedido, aceitar: boolean) => {
    if (!aceitar) {
      const ok = await confirmar({
        titulo: p.recebido ? 'Recusar pedido?' : 'Cancelar pedido?',
        destaque: p.nome,
        textoConfirmar: p.recebido ? 'Recusar' : 'Cancelar pedido',
        icone: 'close-circle-outline',
      });
      if (!ok) return;
    }
    try {
      if (aceitar) await aceitarPedido(p.outro);
      else await desfazerVinculo(p.outro);
      await carregar();
    } catch (e) {
      setAviso({ texto: mensagemDeErro(e), tom: 'erro' });
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
      {dialogo}

      <View style={styles.perfil}>
        <AvatarClub avatar={perfil.avatar} tamanho={72} />
        <View style={styles.flex}>
          <Text style={styles.nomePerfil}>{perfil.nome}</Text>
          <Text style={styles.desde}>No Heavy desde {desde}</Text>
        </View>
      </View>

      <Image
        source={require('@/../assets/images/club-amigos.png')}
        style={styles.imagemAmigos}
        contentFit="contain"
        accessibilityLabel="Amigo do Heavy Guy ajudando no supino"
      />

      <Cartao style={styles.cartaoCodigo}>
        <Text style={styles.rotulo}>Seu código de amizade</Text>
        <Text style={styles.codigo} selectable>
          {perfil.codigo}
        </Text>
        <Text style={styles.textoSuave}>Mande para um amigo: ele digita o código no Club dele e você aceita o pedido.</Text>
        <View style={styles.linhaBotoes}>
          <Botao
            titulo={copiado ? 'Copiado!' : 'Copiar'}
            variante="secundario"
            icone={copiado ? 'checkmark' : 'copy-outline'}
            onPress={copiar}
            style={styles.flex}
          />
          <Botao titulo="Compartilhar" variante="secundario" icone="share-social-outline" onPress={compartilhar} style={styles.flex} />
        </View>
      </Cartao>

      <Text style={styles.secao}>Adicionar amigo</Text>
      <View style={styles.linhaCodigo}>
        <Campo
          placeholder="Código do amigo (ex.: K7Q2XM)"
          value={codigo}
          onChangeText={(t) => setCodigo(t.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={8}
          onSubmitEditing={adicionar}
          style={styles.flex}
        />
        <Botao titulo="Enviar" icone="person-add-outline" onPress={adicionar} desabilitado={!codigo.trim()} />
      </View>
      {aviso && <Text style={aviso.tom === 'ok' ? styles.ok : styles.erro}>{aviso.texto}</Text>}

      {recebidos.length > 0 && (
        <>
          <Text style={styles.secao}>Pedidos recebidos</Text>
          {recebidos.map((p) => (
            <Cartao key={p.outro} style={styles.item}>
              <AvatarClub avatar={p.avatar} />
              <Text style={[styles.nome, styles.flex]}>{p.nome}</Text>
              <Botao titulo="Aceitar" onPress={() => responder(p, true)} />
              <Pressable accessibilityRole="button" accessibilityLabel="Recusar" hitSlop={8} onPress={() => responder(p, false)}>
                <Ionicons name="close" size={24} color={CORES.textoSuave} />
              </Pressable>
            </Cartao>
          ))}
        </>
      )}

      {enviados.length > 0 && (
        <>
          <Text style={styles.secao}>Aguardando resposta</Text>
          {enviados.map((p) => (
            <Cartao key={p.outro} style={styles.item}>
              <AvatarClub avatar={p.avatar} />
              <Text style={[styles.nome, styles.flex]}>{p.nome}</Text>
              <Pressable accessibilityRole="button" hitSlop={8} onPress={() => responder(p, false)}>
                <Text style={styles.link}>Cancelar</Text>
              </Pressable>
            </Cartao>
          ))}
        </>
      )}

      <Text style={styles.secao}>Amigos {amigos.length > 0 && `(${amigos.length})`}</Text>
      {amigos.length === 0 && (
        <Text style={styles.textoSuave}>Nenhum amigo ainda. Compartilhe seu código para começar!</Text>
      )}
      {amigos.map((a) => (
        <Pressable
          key={a.id}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/club/amigo/[id]', params: { id: a.id } })}>
          {({ pressed }) => (
            <Cartao style={[styles.item, { opacity: pressed ? 0.7 : 1 }]}>
              <AvatarClub avatar={a.avatar} />
              <Text style={[styles.nome, styles.flex]}>{a.nome}</Text>
              <Ionicons name="chevron-forward" size={20} color={CORES.texto} />
            </Cartao>
          )}
        </Pressable>
      ))}

      <View style={styles.rodape}>
        <Botao
          titulo="Privacidade: o que meus amigos veem"
          variante="secundario"
          icone="eye-outline"
          onPress={() => router.push('/club/privacidade')}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  carregando: { marginTop: 40 },
  centro: { flex: 1, padding: 24, justifyContent: 'center', gap: 16 },
  conteudo: { padding: 16, gap: 12, paddingBottom: 40 },
  marca: { alignItems: 'center', gap: 2, marginBottom: 8 },
  marcaHeavy: { color: CORES.vermelho, fontSize: 40, fontWeight: '900', letterSpacing: 4, lineHeight: 44 },
  marcaClub: { color: CORES.texto, fontSize: 15, fontWeight: '800', letterSpacing: 6 },
  imagemClub: { width: '100%', maxWidth: 300, aspectRatio: 774 / 716, marginVertical: 12 },
  secao: { color: CORES.texto, fontSize: 20, fontWeight: '700', marginTop: 12 },
  rotulo: { color: CORES.textoSuave, fontSize: 13, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  textoSuave: { color: CORES.textoSuave, fontSize: 14, textAlign: 'center' },
  erro: { color: CORES.vermelho, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  ok: { color: CORES.dourado, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  link: { color: CORES.dourado, fontSize: 15, fontWeight: '700' },
  perfil: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  nomePerfil: { color: CORES.texto, fontSize: 24, fontWeight: '800' },
  desde: { color: CORES.textoSuave, fontSize: 14 },
  flex: { flex: 1 },
  imagemAmigos: { width: '100%', maxWidth: 340, aspectRatio: 800 / 731, alignSelf: 'center' },
  cartaoCodigo: { alignItems: 'center', gap: 8, borderColor: CORES.dourado },
  codigo: { color: CORES.dourado, fontSize: 40, fontWeight: '900', letterSpacing: 8 },
  linhaBotoes: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  linhaCodigo: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nome: { color: CORES.texto, fontSize: 17, fontWeight: '700' },
  rodape: { gap: 12, marginTop: 24 },
});
