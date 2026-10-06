import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ComponentProps } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Botao } from '@/components/ui';
import { CORES } from '@/lib/tema';

interface Opcoes {
  titulo: string;
  /** Nome do item afetado, mostrado em destaque. */
  destaque?: string;
  mensagem?: string;
  textoConfirmar?: string;
  /** Padrão: lixeira (exclusões). */
  icone?: ComponentProps<typeof Ionicons>['name'];
}

interface Pedido extends Opcoes {
  responder: (ok: boolean) => void;
}

/**
 * Confirmação dentro do app (no lugar do Alert/confirm do sistema).
 * Renderize `dialogo` na tela e use `await confirmar({...})`.
 */
export function useConfirmacao() {
  const [pedido, setPedido] = useState<Pedido | null>(null);

  const confirmar = (opcoes: Opcoes) =>
    new Promise<boolean>((resolve) => {
      setPedido({
        ...opcoes,
        responder: (ok) => {
          setPedido(null);
          resolve(ok);
        },
      });
    });

  const dialogo = (
    <Modal
      visible={pedido !== null}
      transparent
      animationType="fade"
      onRequestClose={() => pedido?.responder(false)}>
      <Pressable style={styles.fundo} onPress={() => pedido?.responder(false)}>
        {/* Pressable interno impede que toques no cartão fechem o diálogo. */}
        <Pressable style={styles.cartao} onPress={() => {}}>
          <View style={styles.icone}>
            <Ionicons name={pedido?.icone ?? 'trash-outline'} size={28} color={CORES.vermelho} />
          </View>
          <Text style={styles.titulo}>{pedido?.titulo}</Text>
          {pedido?.destaque && <Text style={styles.destaque}>{pedido.destaque}</Text>}
          {pedido?.mensagem && <Text style={styles.mensagem}>{pedido.mensagem}</Text>}
          <View style={styles.botoes}>
            <Botao
              titulo="Cancelar"
              variante="secundario"
              onPress={() => pedido?.responder(false)}
              style={styles.flex}
            />
            <Botao
              titulo={pedido?.textoConfirmar ?? 'Apagar'}
              onPress={() => pedido?.responder(true)}
              style={styles.flex}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );

  return { confirmar, dialogo };
}

const styles = StyleSheet.create({
  fundo: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  cartao: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: CORES.cartao,
    borderColor: CORES.borda,
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  icone: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: CORES.vermelho,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  titulo: { color: CORES.texto, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  destaque: { color: CORES.dourado, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  mensagem: { color: CORES.textoSuave, fontSize: 15, textAlign: 'center' },
  botoes: { flexDirection: 'row', gap: 10, marginTop: 10, alignSelf: 'stretch' },
  flex: { flex: 1 },
});
