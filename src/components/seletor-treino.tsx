import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BotaoIcone, Selo } from '@/components/ui';
import type { Ficha, Id } from '@/db';
import { CORES } from '@/lib/tema';

interface Props {
  visivel: boolean;
  fichas: Ficha[];
  /** Treino mostrado agora no painel. */
  atual: Id | null;
  /** Sugestão do rodízio (nula se a semana já foi concluída). */
  sugerida: Id | null;
  feitasNaSemana: Set<Id>;
  onEscolher: (id: Id) => void;
  onFechar: () => void;
}

/** Lista os treinos da rotina para o usuário trocar o treino do dia. */
export function SeletorTreino({ visivel, fichas, atual, sugerida, feitasNaSemana, onEscolher, onFechar }: Props) {
  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={onFechar}>
      <Pressable style={styles.fundo} onPress={onFechar}>
        {/* Pressable interno impede que toques na lista fechem o seletor. */}
        <Pressable style={styles.cartao} onPress={() => {}}>
          <View style={styles.cabecalho}>
            <Text style={styles.titulo}>Qual treino hoje?</Text>
            <BotaoIcone icone="close" rotulo="Fechar" onPress={onFechar} />
          </View>
          <Text style={styles.dica}>O rodízio se ajusta: o treino que ficar para trás volta a ser sugerido depois.</Text>
          <ScrollView contentContainerStyle={styles.lista}>
            {fichas.map((f) => {
              const escolhido = f.id === atual;
              const feito = feitasNaSemana.has(f.id);
              return (
                <Pressable
                  key={f.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: escolhido }}
                  onPress={() => onEscolher(f.id)}
                  style={({ pressed }) => [
                    styles.opcao,
                    escolhido && { borderColor: CORES.dourado },
                    { opacity: pressed ? 0.7 : 1 },
                  ]}>
                  <Ionicons
                    name={escolhido ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={escolhido ? CORES.dourado : CORES.textoSuave}
                  />
                  <View style={styles.flex}>
                    <Text style={styles.nome}>{f.nome}</Text>
                    {feito && <Text style={styles.detalhe}>✓ Feito esta semana</Text>}
                  </View>
                  {f.id === sugerida && <Selo texto="Sugerido" />}
                </Pressable>
              );
            })}
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
    gap: 10,
  },
  cabecalho: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titulo: { color: CORES.texto, fontSize: 20, fontWeight: '800' },
  dica: { color: CORES.textoSuave, fontSize: 14 },
  lista: { gap: 8 },
  opcao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderColor: CORES.borda,
    borderRadius: 12,
    padding: 14,
  },
  flex: { flex: 1 },
  nome: { color: CORES.texto, fontSize: 17, fontWeight: '700' },
  detalhe: { color: CORES.textoSuave, fontSize: 13 },
});
