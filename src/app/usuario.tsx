import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useConfirmacao } from '@/components/dialogo-confirmacao';
import { MinhaConta } from '@/components/minha-conta';
import { SeletorAvatar } from '@/components/seletor-avatar';
import { Botao, Campo, Cartao, Contador } from '@/components/ui';
import { repo } from '@/db';
import { escolherAvatar, esquecerAvatar, useAvatarAtual } from '@/lib/avatar-atual';
import { mensagemDeErro } from '@/lib/avisos';
import { clubConfigurado, excluirConta, useUsuarioClub } from '@/lib/club';
import { preencherComDadosDeTeste } from '@/lib/dados-de-teste';
import { formatarLitros, formatarMinutos, lerNumero } from '@/lib/metas';
import { CORES } from '@/lib/tema';

interface Formulario {
  nome: string;
  idade: string;
  altura: string;
  peso: string;
  cardioAtividade: string;
  metaCardioMin: number;
  metaAguaMl: number;
}

const texto = (n: number | null) => (n === null ? '' : String(n).replace('.', ','));

export default function Usuario() {
  const [form, setForm] = useState<Formulario | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [escolhendoAvatar, setEscolhendoAvatar] = useState(false);
  const avatar = useAvatarAtual();
  const { confirmar, dialogo } = useConfirmacao();
  const [preenchendo, setPreenchendo] = useState(false);
  const usuarioClub = useUsuarioClub();
  const [excluindo, setExcluindo] = useState(false);
  const [erroExcluir, setErroExcluir] = useState<string | null>(null);

  const carregarPerfil = useCallback((aindaAtivo: () => boolean = () => true) => {
    repo.obterPerfil().then((p) => {
      if (!aindaAtivo()) return;
      setForm({
          nome: p.nome ?? '',
          idade: texto(p.idade),
          altura: texto(p.alturaCm),
          peso: texto(p.pesoKg),
          cardioAtividade: p.cardioAtividade ?? '',
          metaCardioMin: p.metaCardioMin ?? 0,
        metaAguaMl: p.metaAguaMl ?? 0,
      });
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      carregarPerfil(() => ativo);
      return () => {
        ativo = false;
      };
    }, [carregarPerfil])
  );

  if (!form) return <ActivityIndicator style={styles.carregando} />;

  const alterar = (dados: Partial<Formulario>) => {
    setForm({ ...form, ...dados });
    setSalvo(false);
  };

  const salvar = async () => {
    const idade = lerNumero(form.idade);
    await repo.salvarPerfil({
      nome: form.nome.trim() || null,
      idade: idade === null ? null : Math.round(idade),
      alturaCm: lerNumero(form.altura),
      pesoKg: lerNumero(form.peso),
      cardioAtividade: form.cardioAtividade.trim() || null,
      metaCardioMin: form.metaCardioMin || null,
      metaAguaMl: form.metaAguaMl || null,
    });
    setSalvo(true);
  };

  const preencherTeste = async () => {
    const ok = await confirmar({
      titulo: 'Preencher com dados de teste?',
      mensagem:
        'Apaga suas rotinas, treinos e histórico atuais e coloca um histórico de exemplo (2 meses de treinos, sequência de 23 dias). Seu perfil e avatar ficam.',
      textoConfirmar: 'Preencher',
      icone: 'flask-outline',
    });
    if (!ok) return;
    setPreenchendo(true);
    try {
      await preencherComDadosDeTeste();
    } finally {
      setPreenchendo(false);
    }
    router.navigate('/');
  };

  /** Apaga tudo: a conta do Club (se houver) e todos os dados deste aparelho. */
  const excluirTudo = async () => {
    const ok = await confirmar({
      titulo: 'Excluir conta?',
      destaque: form.nome.trim() || 'Minha conta',
      mensagem: `Apaga para sempre suas rotinas, treinos, histórico, metas e perfil${
        usuarioClub ? ', e também sua conta do Heavy Training Club com amigos, PRs, check-ins e fotos' : ''
      }. Não dá para desfazer.`,
      textoConfirmar: 'Continuar',
      icone: 'warning-outline',
    });
    if (!ok) return;
    const certeza = await confirmar({
      titulo: 'Última confirmação',
      destaque: 'Excluir tudo agora',
      mensagem: 'Depois disso o app volta a ficar como novo.',
      textoConfirmar: 'Excluir tudo',
    });
    if (!certeza) return;

    setExcluindo(true);
    setErroExcluir(null);
    try {
      // Primeiro a nuvem: se falhar (ex.: sem internet), os dados do aparelho continuam para tentar de novo.
      if (usuarioClub) await excluirConta();
      await repo.apagarDadosDeTreino();
      await repo.salvarPerfil({
        nome: null,
        idade: null,
        alturaCm: null,
        pesoKg: null,
        cardioAtividade: null,
        metaCardioMin: null,
        metaAguaMl: null,
      });
      await esquecerAvatar();
      router.navigate('/');
    } catch (e) {
      setErroExcluir(mensagemDeErro(e));
    } finally {
      setExcluindo(false);
    }
  };

  const altura = lerNumero(form.altura);
  const peso = lerNumero(form.peso);
  const imc = altura && peso ? peso / (altura / 100) ** 2 : null;

  return (
    <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
      {dialogo}
      <View style={styles.topo}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Trocar meu Heavy Guy"
          onPress={() => setEscolhendoAvatar(true)}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <Image source={avatar.imagem} style={styles.mascote} contentFit="cover" />
          <View style={styles.lapis}>
            <Ionicons name="pencil" size={16} color={CORES.sobreDestaque} />
          </View>
        </Pressable>
        <Text style={styles.nomeTopo}>{form.nome.trim() || 'Heavy Guy'}</Text>
        <Text style={styles.detalhe}>Toque na foto para trocar seu Heavy Guy</Text>
      </View>
      <SeletorAvatar
        visivel={escolhendoAvatar}
        selecionado={avatar.id}
        onEscolher={(id) => {
          escolherAvatar(id);
          setEscolhendoAvatar(false);
        }}
        onFechar={() => setEscolhendoAvatar(false)}
      />

      <Text style={styles.secao}>Meus dados</Text>
      <Cartao style={styles.cartao}>
        <Rotulo texto="Nome" />
        <Campo value={form.nome} onChangeText={(nome) => alterar({ nome })} placeholder="Como quer ser chamado?" />

        <View style={styles.linha}>
          <View style={styles.flex}>
            <Rotulo texto="Idade" />
            <Campo
              value={form.idade}
              onChangeText={(idade) => alterar({ idade })}
              keyboardType="number-pad"
              placeholder="anos"
            />
          </View>
          <View style={styles.flex}>
            <Rotulo texto="Altura (cm)" />
            <Campo
              value={form.altura}
              onChangeText={(altura) => alterar({ altura })}
              keyboardType="decimal-pad"
              placeholder="ex.: 178"
            />
          </View>
          <View style={styles.flex}>
            <Rotulo texto="Peso (kg)" />
            <Campo
              value={form.peso}
              onChangeText={(peso) => alterar({ peso })}
              keyboardType="decimal-pad"
              placeholder="ex.: 82,5"
            />
          </View>
        </View>
        {imc !== null && (
          <Text style={styles.detalhe}>IMC: {imc.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</Text>
        )}
      </Cartao>

      <Text style={styles.secao}>Minhas metas</Text>
      <Cartao style={styles.cartao}>
        <Text style={styles.tituloMeta}>Cardio semanal</Text>
        <Rotulo texto="Atividade" />
        <Campo
          value={form.cardioAtividade}
          onChangeText={(cardioAtividade) => alterar({ cardioAtividade })}
          placeholder="ex.: Escada, esteira, bike"
        />
        <View style={styles.linhaMeta}>
          <Text style={styles.detalhe}>Meta por semana</Text>
          <Contador
            rotulo="meta de cardio"
            valor={form.metaCardioMin}
            passo={15}
            max={1200}
            formatar={(v) => (v === 0 ? 'Sem meta' : formatarMinutos(v))}
            onChange={(metaCardioMin) => alterar({ metaCardioMin })}
          />
        </View>
      </Cartao>

      <Cartao style={styles.cartao}>
        <Text style={styles.tituloMeta}>Água diária</Text>
        <View style={styles.linhaMeta}>
          <Text style={styles.detalhe}>Meta por dia</Text>
          <Contador
            rotulo="meta de água"
            valor={form.metaAguaMl}
            passo={250}
            max={8000}
            formatar={(v) => (v === 0 ? 'Sem meta' : formatarLitros(v))}
            onChange={(metaAguaMl) => alterar({ metaAguaMl })}
          />
        </View>
      </Cartao>

      <Text style={styles.detalhe}>
        O progresso das metas você registra no painel Início, arrastando a barra de cada uma. O cardio
        recomeça toda segunda e a água todo dia.
      </Text>

      <Botao
        titulo={salvo ? 'Perfil salvo!' : 'Salvar perfil'}
        icone={salvo ? 'checkmark-done-circle' : 'checkmark-circle-outline'}
        onPress={salvar}
        style={styles.salvar}
      />

      {clubConfigurado && (
        <>
          <Text style={styles.secao}>Minha conta</Text>
          <MinhaConta onDadosTrazidos={() => carregarPerfil()} />
        </>
      )}

      <View style={styles.zonaPerigo}>
        <Text style={styles.rotulo}>Conta</Text>
        <Text style={styles.detalhe}>
          Excluir a conta apaga todos os seus dados deste aparelho{usuarioClub ? ' e do Heavy Training Club' : ''}.
        </Text>
        {erroExcluir && <Text style={styles.erro}>{erroExcluir}</Text>}
        <Botao
          titulo={excluindo ? 'Excluindo…' : 'Excluir conta'}
          variante="perigo"
          icone="trash-outline"
          desabilitado={excluindo}
          onPress={excluirTudo}
        />
      </View>

      {/* Só em desenvolvimento: nunca aparece no app publicado. */}
      {__DEV__ && (
        <View style={styles.dev}>
          <Text style={styles.rotulo}>Desenvolvimento</Text>
          <Botao
            titulo={preenchendo ? 'Preenchendo…' : 'Preencher com dados de teste'}
            icone="flask-outline"
            variante="secundario"
            desabilitado={preenchendo}
            onPress={preencherTeste}
          />
        </View>
      )}
    </ScrollView>
  );
}

function Rotulo({ texto: t }: { texto: string }) {
  return <Text style={styles.rotulo}>{t}</Text>;
}

const styles = StyleSheet.create({
  carregando: { marginTop: 40 },
  conteudo: { padding: 16, gap: 12, paddingBottom: 40 },
  topo: { alignItems: 'center', gap: 8, marginVertical: 8 },
  mascote: { width: 104, height: 104, borderRadius: 52, borderWidth: 3, borderColor: CORES.dourado },
  lapis: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: CORES.dourado,
    borderWidth: 3,
    borderColor: CORES.fundo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nomeTopo: { color: CORES.texto, fontSize: 22, fontWeight: '800' },
  secao: { color: CORES.texto, fontSize: 20, fontWeight: '700', marginTop: 8 },
  cartao: { gap: 8 },
  rotulo: { color: CORES.textoSuave, fontSize: 13, fontWeight: '600' },
  linha: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1, gap: 8, minWidth: 0 },
  detalhe: { color: CORES.textoSuave, fontSize: 14 },
  tituloMeta: { color: CORES.dourado, fontSize: 16, fontWeight: '700' },
  linhaMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  salvar: { marginTop: 8, paddingVertical: 16 },
  zonaPerigo: { marginTop: 32, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: CORES.borda, paddingTop: 16 },
  erro: { color: CORES.vermelho, fontSize: 15, fontWeight: '600' },
  dev: { marginTop: 32, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: CORES.borda, paddingTop: 16 },
});
