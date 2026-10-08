import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Cartao } from '@/components/ui';
import { mensagemDeErro } from '@/lib/avisos';
import { atualizarMeuPerfil, obterPerfil, publicarRetrato, type Privacidade } from '@/lib/club';
import { calcularRecordes, carregarHistoricoCompleto, type Recorde } from '@/lib/prs';
import { formatarKg } from '@/lib/sessao';
import { CORES } from '@/lib/tema';

export default function TelaPrivacidade() {
  const [privacidade, setPrivacidade] = useState<Privacidade | null>(null);
  const [recordes, setRecordes] = useState<Recorde[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  // Publica o retrato só depois que o usuário para de mexer (evita uma chamada por toque).
  const publicacao = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      (async () => {
        try {
          const [perfil, { sessoes, series, nomes }] = await Promise.all([obterPerfil(), carregarHistoricoCompleto()]);
          if (!ativo) return;
          setPrivacidade({
            mostrarCheckins: perfil.mostrarCheckins,
            mostrarSequencia: perfil.mostrarSequencia,
            mostrarRotina: perfil.mostrarRotina,
            prsVisiveis: perfil.prsVisiveis,
          });
          setRecordes(calcularRecordes(sessoes, series, nomes));
        } catch (e) {
          if (ativo) setErro(mensagemDeErro(e));
        }
      })();
      return () => {
        ativo = false;
      };
    }, [])
  );

  if (erro) return <Text style={[styles.aviso, styles.erro]}>{erro}</Text>;
  if (!privacidade) return <ActivityIndicator style={styles.carregando} />;

  const mudar = async (dados: Partial<Privacidade>) => {
    const anterior = privacidade;
    setPrivacidade({ ...privacidade, ...dados });
    try {
      await atualizarMeuPerfil(dados);
      if (publicacao.current) clearTimeout(publicacao.current);
      publicacao.current = setTimeout(() => publicarRetrato().catch(() => {}), 800);
    } catch (e) {
      setPrivacidade(anterior);
      setErro(mensagemDeErro(e));
    }
  };

  const alternarPr = (exercicio: string, visivel: boolean) =>
    mudar({
      prsVisiveis: visivel
        ? [...privacidade.prsVisiveis, exercicio]
        : privacidade.prsVisiveis.filter((e) => e !== exercicio),
    });

  return (
    <ScrollView contentContainerStyle={styles.conteudo}>
      <Text style={styles.dica}>Só seus amigos do Club veem o que estiver ligado. O que estiver desligado nem sai do seu aparelho.</Text>

      <Cartao style={styles.lista}>
        <Opcao
          titulo="Check-ins e fotos dos treinos"
          detalhe="Seus posts aparecem no feed dos amigos."
          valor={privacidade.mostrarCheckins}
          onChange={(v) => mudar({ mostrarCheckins: v })}
        />
        <Opcao
          titulo="Sequência"
          detalhe="Quantos dias seguidos você está treinando."
          valor={privacidade.mostrarSequencia}
          onChange={(v) => mudar({ mostrarSequencia: v })}
        />
        <Opcao
          titulo="Rotina atual"
          detalhe="O nome da rotina que você está seguindo."
          valor={privacidade.mostrarRotina}
          onChange={(v) => mudar({ mostrarRotina: v })}
        />
      </Cartao>

      <Text style={styles.secao}>PRs por exercício</Text>
      <Text style={styles.dica}>Escolha quais recordes (maior carga numa série válida) aparecem no seu perfil.</Text>
      {recordes.length === 0 ? (
        <Text style={styles.dica}>Conclua treinos para ter seus primeiros PRs.</Text>
      ) : (
        <Cartao style={styles.lista}>
          {recordes.map((r) => (
            <Opcao
              key={r.exercicioId}
              titulo={r.exercicio}
              detalhe={`${formatarKg(r.carga)} × ${r.repeticoes}`}
              valor={privacidade.prsVisiveis.includes(r.exercicio)}
              onChange={(v) => alternarPr(r.exercicio, v)}
            />
          ))}
        </Cartao>
      )}
    </ScrollView>
  );
}

function Opcao({
  titulo,
  detalhe,
  valor,
  onChange,
}: {
  titulo: string;
  detalhe: string;
  valor: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.opcao}>
      <View style={styles.flex}>
        <Text style={styles.titulo}>{titulo}</Text>
        <Text style={styles.detalhe}>{detalhe}</Text>
      </View>
      <Switch
        value={valor}
        onValueChange={onChange}
        trackColor={{ false: CORES.borda, true: CORES.dourado }}
        thumbColor={CORES.texto}
        accessibilityLabel={titulo}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  carregando: { marginTop: 40 },
  conteudo: { padding: 16, gap: 12, paddingBottom: 40 },
  aviso: { padding: 24, textAlign: 'center' },
  erro: { color: CORES.vermelho, fontSize: 15, fontWeight: '600' },
  dica: { color: CORES.textoSuave, fontSize: 14 },
  secao: { color: CORES.texto, fontSize: 20, fontWeight: '700', marginTop: 12 },
  lista: { gap: 16 },
  opcao: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  titulo: { color: CORES.texto, fontSize: 16, fontWeight: '700' },
  detalhe: { color: CORES.textoSuave, fontSize: 13 },
});
