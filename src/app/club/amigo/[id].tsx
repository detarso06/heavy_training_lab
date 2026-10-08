import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AvatarClub, CartaoCheckin } from '@/components/cartao-checkin';
import { useConfirmacao } from '@/components/dialogo-confirmacao';
import { Botao, Cartao } from '@/components/ui';
import { mensagemDeErro } from '@/lib/avisos';
import {
  aceitarPedido,
  contarComentarios,
  desfazerVinculo,
  enviarPedidoPara,
  listarCheckins,
  listarPrs,
  obterPerfil,
  obterPerfilBasico,
  sequenciaVigente,
  urlsDasFotos,
  type Checkin,
  type PerfilBasico,
  type PerfilClub,
  type PrPublico,
} from '@/lib/club';
import { atualizarNovidades } from '@/lib/novidades';
import { formatarKg } from '@/lib/sessao';
import { nivelDaSequencia } from '@/lib/sequencia';
import { CORES } from '@/lib/tema';

interface Dados {
  perfil: PerfilClub;
  prs: PrPublico[];
  checkins: Checkin[];
  fotos: Map<string, string>;
  comentarios: Map<string, number>;
}

export default function TelaAmigo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [dados, setDados] = useState<Dados | null>(null);
  /** Ainda não é amigo (ex.: veio de um comentário bloqueado): só o perfil básico. */
  const [naoAmigo, setNaoAmigo] = useState<PerfilBasico | null>(null);
  /** Muda para recarregar quando a amizade é aceita. */
  const [versao, setVersao] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const { confirmar, dialogo } = useConfirmacao();

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        // Sem a função do banco (supabase/010 ainda não aplicado), segue como antes: perfil de amigo.
        const basico = await obterPerfilBasico(id).catch(() => null);
        if (basico && basico.vinculo !== 'amigos') {
          if (ativo) setNaoAmigo(basico);
          return;
        }
        const [perfil, prs, checkins] = await Promise.all([obterPerfil(id), listarPrs(id), listarCheckins({ usuario: id })]);
        const [fotos, comentarios] = await Promise.all([
          urlsDasFotos(checkins.flatMap((c) => (c.foto ? [c.foto] : []))),
          contarComentarios(checkins.map((c) => c.id)).catch(() => new Map<string, number>()),
        ]);
        if (!ativo) return;
        setNaoAmigo(null);
        setDados({ perfil, prs, checkins, fotos, comentarios });
      } catch (e) {
        if (ativo) setErro(mensagemDeErro(e));
      }
    })();
    return () => {
      ativo = false;
    };
  }, [id, versao]);

  if (naoAmigo) {
    return <PerfilNaoAmigo perfil={naoAmigo} onAmizade={() => setVersao((v) => v + 1)} onMudou={setNaoAmigo} />;
  }
  if (erro) return <Text style={styles.erro}>{erro}</Text>;
  if (!dados) return <ActivityIndicator style={styles.carregando} />;

  const { perfil, prs, checkins, fotos, comentarios } = dados;
  const sequencia = sequenciaVigente(perfil);
  const nivel = sequencia !== null ? nivelDaSequencia(sequencia) : null;
  const desde = new Date(perfil.criadoEm).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const desfazer = async () => {
    const ok = await confirmar({
      titulo: 'Desfazer amizade?',
      destaque: perfil.nome,
      mensagem: 'Vocês deixam de ver os treinos um do outro. Dá para adicionar de novo pelo código.',
      textoConfirmar: 'Desfazer',
      icone: 'person-remove-outline',
    });
    if (!ok) return;
    try {
      await desfazerVinculo(perfil.id);
      router.back();
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.conteudo}>
      <Stack.Screen options={{ title: perfil.nome }} />
      {dialogo}

      <View style={styles.topo}>
        <AvatarClub avatar={perfil.avatar} tamanho={96} />
        <Text style={styles.nome}>{perfil.nome}</Text>
        <Text style={styles.suave}>No Heavy desde {desde}</Text>
      </View>

      <View style={styles.grade}>
        {sequencia !== null && nivel && (
          <Cartao style={styles.numero}>
            <Text style={styles.icone}>{nivel.icones.join('')}</Text>
            <Text style={styles.valor}>
              {sequencia} {sequencia === 1 ? 'dia' : 'dias'}
            </Text>
            <Text style={styles.rotulo}>Sequência · {nivel.titulo}</Text>
          </Cartao>
        )}
        {perfil.rotinaAtual && (
          <Cartao style={styles.numero}>
            <Text style={styles.icone}>🏋️</Text>
            <Text style={styles.valor} numberOfLines={2}>
              {perfil.rotinaAtual}
            </Text>
            <Text style={styles.rotulo}>Rotina atual</Text>
          </Cartao>
        )}
      </View>

      {prs.length > 0 && (
        <>
          <Text style={styles.secao}>PRs</Text>
          <Cartao style={styles.lista}>
            {prs.map((p) => (
              <View key={p.exercicio} style={styles.linhaPr}>
                <Text style={[styles.textoPr, styles.flex]}>{p.exercicio}</Text>
                <Text style={styles.cargaPr}>
                  {formatarKg(p.carga)} × {p.repeticoes}
                </Text>
              </View>
            ))}
          </Cartao>
        </>
      )}

      <Text style={styles.secao}>Check-ins</Text>
      {checkins.length === 0 && <Text style={styles.suave}>Nenhum check-in para mostrar.</Text>}
      {checkins.map((c) => (
        <CartaoCheckin
          key={c.id}
          checkin={c}
          urlFoto={c.foto ? fotos.get(c.foto) : undefined}
          comentarios={comentarios.get(c.id) ?? 0}
        />
      ))}

      <Botao titulo="Desfazer amizade" variante="perigo" icone="person-remove-outline" onPress={desfazer} style={styles.desfazer} />
    </ScrollView>
  );
}

/** Perfil de quem ainda não é amigo: nome, avatar e o pedido de amizade direto (sem código). */
function PerfilNaoAmigo({
  perfil,
  onAmizade,
  onMudou,
}: {
  perfil: PerfilBasico;
  onAmizade: () => void;
  onMudou: (p: PerfilBasico) => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const desde = new Date(perfil.criadoEm).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const agir = async (acao: () => Promise<void>) => {
    setOcupado(true);
    setErro(null);
    try {
      await acao();
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  };

  const adicionar = () =>
    agir(async () => {
      const r = await enviarPedidoPara(perfil.id);
      // Se a pessoa já tinha pedido, vira amizade na hora.
      if (r.status === 'aceita') onAmizade();
      else onMudou({ ...perfil, vinculo: 'enviado' });
    });
  const aceitar = () =>
    agir(async () => {
      await aceitarPedido(perfil.id);
      atualizarNovidades();
      onAmizade();
    });
  const desfazer = () =>
    agir(async () => {
      await desfazerVinculo(perfil.id);
      atualizarNovidades();
      onMudou({ ...perfil, vinculo: null });
    });

  return (
    <ScrollView contentContainerStyle={styles.conteudo}>
      <Stack.Screen options={{ title: perfil.nome }} />
      <View style={styles.topo}>
        <AvatarClub avatar={perfil.avatar} tamanho={96} />
        <Text style={styles.nome}>{perfil.nome}</Text>
        <Text style={styles.suave}>No Heavy desde {desde}</Text>
      </View>

      <Cartao style={styles.bloqueio}>
        <Ionicons name="lock-closed" size={28} color={CORES.dourado} />
        <Text style={styles.textoBloqueio}>
          {perfil.vinculo === 'enviado'
            ? `Pedido enviado. Quando ${perfil.nome} aceitar, vocês veem os treinos e os comentários um do outro.`
            : perfil.vinculo === 'recebido'
              ? `${perfil.nome} quer ser seu amigo.`
              : `Vocês ainda não são amigos. Adicione ${perfil.nome} para ver os treinos, a sequência, os PRs e os comentários.`}
        </Text>
      </Cartao>

      {perfil.vinculo === null && (
        <Botao titulo="Adicionar amigo" icone="person-add-outline" desabilitado={ocupado} onPress={adicionar} />
      )}
      {perfil.vinculo === 'recebido' && (
        <>
          <Botao titulo="Aceitar pedido" icone="checkmark" desabilitado={ocupado} onPress={aceitar} />
          <Botao titulo="Recusar" variante="secundario" desabilitado={ocupado} onPress={desfazer} />
        </>
      )}
      {perfil.vinculo === 'enviado' && (
        <Botao titulo="Cancelar pedido" variante="secundario" desabilitado={ocupado} onPress={desfazer} />
      )}
      {erro && <Text style={styles.erro}>{erro}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bloqueio: { alignItems: 'center', gap: 10, paddingVertical: 20 },
  textoBloqueio: { color: CORES.textoSuave, fontSize: 15, textAlign: 'center' },
  carregando: { marginTop: 40 },
  erro: { color: CORES.vermelho, fontSize: 15, fontWeight: '600', textAlign: 'center', padding: 24 },
  conteudo: { padding: 16, gap: 12, paddingBottom: 40 },
  topo: { alignItems: 'center', gap: 6, marginVertical: 8 },
  nome: { color: CORES.texto, fontSize: 26, fontWeight: '800' },
  suave: { color: CORES.textoSuave, fontSize: 14, textAlign: 'center' },
  grade: { flexDirection: 'row', gap: 10 },
  numero: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 16 },
  icone: { fontSize: 28 },
  valor: { color: CORES.texto, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  rotulo: { color: CORES.textoSuave, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  secao: { color: CORES.texto, fontSize: 20, fontWeight: '700', marginTop: 8 },
  lista: { gap: 10 },
  linhaPr: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  textoPr: { color: CORES.texto, fontSize: 15, fontWeight: '600' },
  cargaPr: { color: CORES.dourado, fontSize: 15, fontWeight: '800' },
  desfazer: { marginTop: 24 },
});
