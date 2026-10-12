import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useConfirmacao } from '@/components/dialogo-confirmacao';
import { Botao, Campo, Cartao, Contador } from '@/components/ui';
import { repo, type CardioPlanejado, type Ficha } from '@/db';
import { ATIVIDADES_CARDIO, MINUTOS_CARDIO_PADRAO } from '@/lib/cardio';
import { formatarMinutos } from '@/lib/metas';
import { CORES } from '@/lib/tema';

/**
 * Editor do dia de cardio: atividade e minutos planejados.
 * `/treinos/cardio/novo?rotina=ID` monta um novo, que só entra na rotina no "Adicionar à rotina";
 * com o id de um existente, as mudanças são salvas na hora.
 */
export default function TelaCardio() {
  const { id, rotina } = useLocalSearchParams<{ id: string; rotina?: string }>();
  const novo = id === 'novo';
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [cardio, setCardio] = useState<CardioPlanejado | null>(null);
  const [atividade, setAtividade] = useState('');
  const [carregado, setCarregado] = useState(false);
  const { confirmar, dialogo } = useConfirmacao();

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      (async () => {
        if (novo) {
          const perfil = await repo.obterPerfil();
          if (!ativo) return;
          const inicial = { atividade: perfil.cardioAtividade?.trim() || 'Esteira', minutos: MINUTOS_CARDIO_PADRAO };
          setCardio((atual) => atual ?? inicial);
          setAtividade((atual) => atual || inicial.atividade);
        } else {
          const f = await repo.obterFicha(Number(id));
          if (!ativo) return;
          setFicha(f);
          setCardio(f?.cardio ?? null);
          setAtividade(f?.cardio?.atividade ?? '');
        }
        setCarregado(true);
      })();
      return () => {
        ativo = false;
      };
    }, [id, novo])
  );

  if (!carregado) return <ActivityIndicator style={styles.carregando} />;
  if (!cardio || (!novo && !ficha)) return <Text style={styles.vazio}>Dia de cardio não encontrado.</Text>;

  const salvar = (mudado: CardioPlanejado) => {
    setCardio(mudado);
    if (ficha) repo.atualizarFicha(ficha.id, { cardio: mudado });
  };

  /** Inclui a atividade digitada (se o campo ainda estiver em edição) e volta para a rotina. */
  const concluir = async () => {
    const final = { ...cardio, atividade: atividade.trim() || cardio.atividade };
    if (ficha) {
      await repo.atualizarFicha(ficha.id, { cardio: final });
    } else {
      await repo.criarFicha({ rotinaId: Number(rotina), nome: 'Cardio', descricao: null, cardio: final });
    }
    router.back();
  };

  const escolherAtividade = (nome: string) => {
    setAtividade(nome);
    salvar({ ...cardio, atividade: nome });
  };

  const salvarAtividadeDigitada = () => {
    const limpo = atividade.trim();
    if (!limpo) {
      setAtividade(cardio.atividade);
      return;
    }
    if (limpo !== cardio.atividade) salvar({ ...cardio, atividade: limpo });
  };

  const remover = async () => {
    if (!ficha) return;
    const ok = await confirmar({
      titulo: 'Remover dia de cardio?',
      destaque: `${cardio.atividade} · ${formatarMinutos(cardio.minutos)}`,
      mensagem: 'O dia de cardio sai do rodízio. Os cardios já feitos continuam no histórico e na sequência.',
      textoConfirmar: 'Remover',
    });
    if (!ok) return;
    await repo.removerFicha(ficha.id);
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: novo ? 'Novo dia de cardio' : 'Dia de cardio' }} />
      {dialogo}

      <Cartao style={styles.cartao}>
        <Text style={styles.rotulo}>Atividade</Text>
        <View style={styles.opcoes}>
          {ATIVIDADES_CARDIO.map((nome) => {
            const ativa = nome === cardio.atividade;
            return (
              <Pressable
                key={nome}
                accessibilityRole="radio"
                accessibilityState={{ checked: ativa }}
                onPress={() => escolherAtividade(nome)}
                style={({ pressed }) => [styles.opcao, ativa && styles.opcaoAtiva, { opacity: pressed ? 0.7 : 1 }]}>
                <Text style={[styles.textoOpcao, ativa && styles.textoOpcaoAtiva]}>{nome}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.dica}>Ou escreva outra:</Text>
        <Campo
          value={atividade}
          onChangeText={setAtividade}
          onBlur={salvarAtividadeDigitada}
          onSubmitEditing={salvarAtividadeDigitada}
          placeholder="Ex.: Pular corda"
          accessibilityLabel="Atividade de cardio"
        />
      </Cartao>

      <Cartao style={styles.cartao}>
        <Text style={styles.rotulo}>Tempo planejado</Text>
        <Contador
          rotulo="minutos de cardio"
          valor={cardio.minutos}
          min={5}
          max={300}
          passo={5}
          formatar={formatarMinutos}
          onChange={(minutos) => salvar({ ...cardio, minutos })}
        />
        <Text style={styles.dica}>No dia, o cronômetro mostra quanto falta. O tempo feito soma na meta de cardio da semana.</Text>
      </Cartao>

      <Botao
        titulo={novo ? 'Adicionar à rotina' : 'Adicionar'}
        icone="add-circle-outline"
        onPress={concluir}
      />

      {!novo && (
        <View style={styles.rodape}>
          <Botao titulo="Remover dia de cardio" variante="perigo" icone="trash-outline" onPress={remover} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  carregando: { marginTop: 40 },
  vazio: { padding: 24, textAlign: 'center', color: CORES.texto },
  conteudo: { flexGrow: 1, padding: 16, gap: 12, paddingBottom: 32 },
  cartao: { gap: 10 },
  rotulo: { color: CORES.textoSuave, fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opcao: {
    borderWidth: 1.5,
    borderColor: CORES.borda,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  opcaoAtiva: { backgroundColor: CORES.dourado, borderColor: CORES.dourado },
  textoOpcao: { color: CORES.texto, fontSize: 15, fontWeight: '600' },
  textoOpcaoAtiva: { color: CORES.sobreDestaque },
  dica: { color: CORES.textoSuave, fontSize: 13 },
  rodape: { marginTop: 'auto', paddingTop: 12 },
});
