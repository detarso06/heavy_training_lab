import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BotaoIcone } from '@/components/ui';
import { AVATARES } from '@/lib/avatares';
import { CORES } from '@/lib/tema';

interface Props {
  visivel: boolean;
  selecionado: string;
  onEscolher: (id: string) => void;
  onFechar: () => void;
}

/** Grade com os rostos do Heavy Guy para escolher a foto de perfil. */
export function SeletorAvatar({ visivel, selecionado, onEscolher, onFechar }: Props) {
  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={onFechar}>
      <Pressable style={styles.fundo} onPress={onFechar}>
        {/* Pressable interno impede que toques na grade fechem o seletor. */}
        <Pressable style={styles.cartao} onPress={() => {}}>
          <View style={styles.cabecalho}>
            <Text style={styles.titulo}>Escolha seu Heavy Guy</Text>
            <BotaoIcone icone="close" rotulo="Fechar" onPress={onFechar} />
          </View>
          <ScrollView contentContainerStyle={styles.grade}>
            {AVATARES.map((a) => {
              const ativo = a.id === selecionado;
              return (
                <Pressable
                  key={a.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: ativo }}
                  accessibilityLabel={a.nome}
                  onPress={() => onEscolher(a.id)}
                  style={({ pressed }) => [styles.opcao, { opacity: pressed ? 0.7 : 1 }]}>
                  <View>
                    <Image
                      source={a.imagem}
                      style={[styles.imagem, { borderColor: ativo ? CORES.dourado : CORES.borda }]}
                      contentFit="cover"
                    />
                    {ativo && (
                      <View style={styles.marca}>
                        <Ionicons name="checkmark" size={14} color={CORES.sobreDestaque} />
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const TAMANHO = 84;

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
    maxHeight: '90%',
    backgroundColor: CORES.cartao,
    borderColor: CORES.borda,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  cabecalho: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titulo: { color: CORES.texto, fontSize: 20, fontWeight: '800' },
  grade: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
  opcao: { width: '31%', alignItems: 'center' },
  imagem: { width: TAMANHO, height: TAMANHO, borderRadius: TAMANHO / 2, borderWidth: 3 },
  marca: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: CORES.dourado,
    borderWidth: 2,
    borderColor: CORES.cartao,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
