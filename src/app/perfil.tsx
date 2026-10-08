import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { AvatarClub, CartaoCheckin } from '@/components/cartao-checkin';
import { CartaoSequencia } from '@/components/cartao-sequencia';
import { useConfirmacao } from '@/components/dialogo-confirmacao';
import { Botao, Cartao } from '@/components/ui';
import { repo } from '@/db';
import { mensagemDeErro } from '@/lib/avisos';
import {
  apagarCheckin,
  atualizarMeuPerfil,
  clubConfigurado,
  listarCheckins,
  obterPerfil,
  publicarRetrato,
  urlsDasFotos,
  useUsuarioClub,
  type Checkin,
  type PerfilClub,
} from '@/lib/club';
import { calcularRecordes, carregarHistoricoCompleto, type Recorde } from '@/lib/prs';
import { calcularSequencia, type Sequencia } from '@/lib/sequencia';
import { formatarKg } from '@/lib/sessao';
import { CORES } from '@/lib/tema';

interface Dados {
  perfil: PerfilClub;
  sequencia: Sequencia;
  rotina: string | null;
  recordes: Recorde[];
  checkins: Checkin[];
  fotos: Map<string, string>;
}

/** Meu perfil no Heavy Training Club: sequência, PRs escolhidos (editáveis) e meus check-ins. */
export default function TelaPerfil() {
  const usuario = useUsuarioClub();

  if (!clubConfigurado) {
    return <Text style={styles.aviso}>O Heavy Training Club ainda não foi configurado neste app.</Text>;
  }
  if (usuario === undefined) return <ActivityIndicator style={styles.carregando} />;
  if (usuario === null) {
    return (
      <View style={styles.centro}>
        <Text style={styles.suave}>Seu perfil fica no Heavy Training Club. Entre ou crie sua conta para montar o seu.</Text>
        <Botao titulo="Entrar no Club" icone="people-outline" onPress={() => router.navigate('/club')} />
      </View>
    );
  }
  return <MeuPerfil key={usuario} usuario={usuario} />;
}

function MeuPerfil({ usuario }: { usuario: string }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const { confirmar, dialogo } = useConfirmacao();
  // Publica o retrato só depois que o usuário para de mexer nos PRs (evita uma chamada por toque).
  const publicacao = useRef<ReturnType<typeof setTimeout> | null>(null);

  const carregar = useCallback(
    async (aindaAtivo: () => boolean = () => true) => {
      try {
        const [perfil, { sessoes, series, nomes }, rotina, checkins] = await Promise.all([
          obterPerfil(usuario),
          carregarHistoricoCompleto(),
          repo.obterRotinaAtiva(),
          listarCheckins({ usuario }),
        ]);
        const fotos = await urlsDasFotos(checkins.flatMap((c) => (c.foto ? [c.foto] : [])));
        if (!aindaAtivo()) return;
        setDados({
          perfil,
          sequencia: calcularSequencia(sessoes, new Date()),
          rotina: rotina?.nome ?? null,
          recordes: calcularRecordes(sessoes, series, nomes),
          checkins,
          fotos,
        });
        setErro(null);
      } catch (e) {
        if (aindaAtivo()) setErro(mensagemDeErro(e));
      }
    },
    [usuario]
  );

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      carregar(() => ativo);
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

  const { perfil, sequencia, rotina, recordes, checkins, fotos } = dados;
  const desde = new Date(perfil.criadoEm).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const visiveis = recordes.filter((r) => perfil.prsVisiveis.includes(r.exercicio));

  const alternarPr = async (exercicio: string, visivel: boolean) => {
    const prsVisiveis = visivel
      ? [...perfil.prsVisiveis, exercicio]
      : perfil.prsVisiveis.filter((e) => e !== exercicio);
    setDados({ ...dados, perfil: { ...perfil, prsVisiveis } });
    try {
      await atualizarMeuPerfil({ prsVisiveis });
      if (publicacao.current) clearTimeout(publicacao.current);
      publicacao.current = setTimeout(() => publicarRetrato().catch(() => {}), 800);
    } catch (e) {
      setDados({ ...dados, perfil });
      setErro(mensagemDeErro(e));
    }
  };

  const apagar = async (c: Checkin) => {
    const ok = await confirmar({
      titulo: 'Apagar check-in?',
      destaque: c.treino,
      mensagem: 'O post e a foto somem do feed dos seus amigos. O treino continua salvo no seu histórico.',
    });
    if (!ok) return;
    try {
      await apagarCheckin(c);
      await carregar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.conteudo}>
      {dialogo}

      <View style={styles.topo}>
        <AvatarClub avatar={perfil.avatar} tamanho={104} />
        <Text style={styles.nome}>{perfil.nome}</Text>
        <Text style={styles.suave}>No Heavy desde {desde}</Text>
        <View style={styles.codigo}>
          <Ionicons name="people-outline" size={16} color={CORES.dourado} />
          <Text style={styles.textoCodigo}>Código {perfil.codigo}</Text>
        </View>
      </View>

      <CartaoSequencia sequencia={sequencia} />
      {rotina && (
        <Cartao style={styles.rotina}>
          <Ionicons name="barbell-outline" size={22} color={CORES.dourado} />
          <View style={styles.flex}>
            <Text style={styles.rotulo}>Rotina atual</Text>
            <Text style={styles.valorRotina}>{rotina}</Text>
          </View>
        </Cartao>
      )}

      <View style={styles.cabecalhoSecao}>
        <Text style={styles.secao}>Meus PRs</Text>
        {recordes.length > 0 && (
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setEditando(!editando)}
            style={({ pressed }) => [
              styles.botaoEditar,
              editando && { backgroundColor: CORES.dourado },
              { opacity: pressed ? 0.6 : 1 },
            ]}>
            <Ionicons
              name={editando ? 'checkmark' : 'create-outline'}
              size={16}
              color={editando ? CORES.sobreDestaque : CORES.dourado}
            />
            <Text style={[styles.textoEditar, editando && { color: CORES.sobreDestaque }]}>
              {editando ? 'Concluir' : 'Editar'}
            </Text>
          </Pressable>
        )}
      </View>

      {recordes.length === 0 && <Text style={styles.suave}>Conclua treinos para ter seus primeiros PRs.</Text>}

      {editando ? (
        <>
          <Text style={styles.dica}>Ligue os PRs que seus amigos podem ver no seu perfil.</Text>
          <Cartao style={styles.lista}>
            {recordes.map((r) => (
              <View key={r.exercicioId} style={styles.linhaPr}>
                <View style={styles.flex}>
                  <Text style={styles.exercicio}>{r.exercicio}</Text>
                  <Text style={styles.dica}>
                    {formatarKg(r.carga)} × {r.repeticoes}
                  </Text>
                </View>
                <Switch
                  value={perfil.prsVisiveis.includes(r.exercicio)}
                  onValueChange={(v) => alternarPr(r.exercicio, v)}
                  trackColor={{ false: CORES.borda, true: CORES.dourado }}
                  thumbColor={CORES.texto}
                  accessibilityLabel={`Mostrar PR de ${r.exercicio}`}
                />
              </View>
            ))}
          </Cartao>
        </>
      ) : (
        recordes.length > 0 &&
        (visiveis.length === 0 ? (
          <Text style={styles.suave}>Nenhum PR no perfil ainda. Toque em Editar para escolher quais mostrar.</Text>
        ) : (
          <Cartao style={styles.lista}>
            {visiveis.map((r) => (
              <View key={r.exercicioId} style={styles.linhaPr}>
                <Ionicons name="trophy" size={18} color={CORES.dourado} />
                <Text style={[styles.exercicio, styles.flex]}>{r.exercicio}</Text>
                <Text style={styles.carga}>
                  {formatarKg(r.carga)} × {r.repeticoes}
                </Text>
              </View>
            ))}
          </Cartao>
        ))
      )}

      <Text style={styles.secao}>Meus check-ins</Text>
      {checkins.length === 0 && (
        <Text style={styles.suave}>Ao finalizar um treino, toque em “Postar no Heavy Training Club” no resumo.</Text>
      )}
      {checkins.map((c) => (
        <CartaoCheckin
          key={c.id}
          checkin={c}
          urlFoto={c.foto ? fotos.get(c.foto) : undefined}
          onApagar={() => apagar(c)}
        />
      ))}

      {erro && <Text style={styles.erro}>{erro}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  carregando: { marginTop: 40 },
  aviso: { color: CORES.textoSuave, padding: 24, textAlign: 'center' },
  centro: { flex: 1, padding: 24, justifyContent: 'center', gap: 16 },
  conteudo: { padding: 16, gap: 12, paddingBottom: 40 },
  topo: { alignItems: 'center', gap: 6, marginVertical: 8 },
  nome: { color: CORES.texto, fontSize: 26, fontWeight: '800' },
  suave: { color: CORES.textoSuave, fontSize: 14, textAlign: 'center' },
  codigo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  textoCodigo: { color: CORES.dourado, fontSize: 15, fontWeight: '800', letterSpacing: 1 },
  rotina: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  rotulo: { color: CORES.textoSuave, fontSize: 13, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  valorRotina: { color: CORES.texto, fontSize: 18, fontWeight: '800' },
  cabecalhoSecao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  secao: { color: CORES.texto, fontSize: 20, fontWeight: '700', marginTop: 12 },
  botaoEditar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: CORES.dourado,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginTop: 12,
  },
  textoEditar: { color: CORES.dourado, fontSize: 14, fontWeight: '700' },
  dica: { color: CORES.textoSuave, fontSize: 13 },
  lista: { gap: 14 },
  linhaPr: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exercicio: { color: CORES.texto, fontSize: 15, fontWeight: '600' },
  carga: { color: CORES.dourado, fontSize: 15, fontWeight: '800' },
  erro: { color: CORES.vermelho, fontSize: 15, fontWeight: '600', textAlign: 'center' },
});
