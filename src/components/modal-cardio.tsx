import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Botao, BotaoIcone, Campo, Contador } from '@/components/ui';
import { ATIVIDADES_CARDIO, MINUTOS_CARDIO_PADRAO } from '@/lib/cardio';
import { formatarMinutos } from '@/lib/metas';
import { CORES } from '@/lib/tema';

interface Props {
  visivel: boolean;
  /** Atividade já marcada ao abrir (ex.: a da meta de cardio do perfil). */
  atividadeInicial: string;
  onAdicionar: (atividade: string, minutos: number) => void;
  onFechar: () => void;
}

/** Escolha da atividade e dos minutos para pôr um cardio na lista do treino. Remonte (key) para recomeçar. */
export function ModalCardio({ visivel, atividadeInicial, onAdicionar, onFechar }: Props) {
  const [atividade, setAtividade] = useState(atividadeInicial);
  const [minutos, setMinutos] = useState(MINUTOS_CARDIO_PADRAO);
  const nome = atividade.trim();

  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={onFechar}>
      <Pressable style={styles.fundo} onPress={onFechar}>
        {/* Pressable interno impede que toques no conteúdo fechem a janela. */}
        <Pressable style={styles.cartao} onPress={() => {}}>
          <View style={styles.cabecalho}>
            <Text style={styles.titulo}>Adicionar cardio</Text>
            <BotaoIcone icone="close" rotulo="Fechar" onPress={onFechar} />
          </View>
          <ScrollView contentContainerStyle={styles.corpo} keyboardShouldPersistTaps="handled">
            <Text style={styles.rotulo}>Atividade</Text>
            <View style={styles.opcoes}>
              {ATIVIDADES_CARDIO.map((opcao) => {
                const ativa = opcao === nome;
                return (
                  <Pressable
                    key={opcao}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: ativa }}
                    onPress={() => setAtividade(opcao)}
                    style={({ pressed }) => [styles.opcao, ativa && styles.opcaoAtiva, { opacity: pressed ? 0.7 : 1 }]}>
                    <Text style={[styles.textoOpcao, ativa && styles.textoOpcaoAtiva]}>{opcao}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Campo
              value={atividade}
              onChangeText={setAtividade}
              placeholder="Ou escreva outra (ex.: Pular corda)"
              accessibilityLabel="Atividade de cardio"
            />

            <Text style={styles.rotulo}>Tempo</Text>
            <Contador
              rotulo="minutos de cardio"
              valor={minutos}
              min={5}
              max={180}
              passo={5}
              formatar={formatarMinutos}
              onChange={setMinutos}
            />

            <Botao
              titulo="Adicionar ao treino"
              icone="add-circle-outline"
              desabilitado={!nome}
              onPress={() => onAdicionar(nome, minutos)}
            />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fundo: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  cartao: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    backgroundColor: CORES.cartao,
    borderColor: CORES.borda,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  cabecalho: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titulo: { color: CORES.texto, fontSize: 20, fontWeight: '800' },
  corpo: { gap: 12, paddingBottom: 4 },
  rotulo: { color: CORES.textoSuave, fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opcao: { borderWidth: 1.5, borderColor: CORES.borda, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  opcaoAtiva: { backgroundColor: CORES.dourado, borderColor: CORES.dourado },
  textoOpcao: { color: CORES.texto, fontSize: 15, fontWeight: '600' },
  textoOpcaoAtiva: { color: CORES.sobreDestaque },
});
