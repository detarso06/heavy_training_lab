import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { clubConfigurado, useUsuarioClub } from '@/lib/club';
import { atualizarNovidades, useNovidades } from '@/lib/novidades';
import { CORES } from '@/lib/tema';

/** Sininho do cabeçalho do Início, com a bolinha de novidades do Club. */
export function BotaoNotificacoes() {
  const usuario = useUsuarioClub();
  const novidades = useNovidades();

  // Confere de novo a cada 30 s (e logo ao entrar ou sair da conta).
  useEffect(() => {
    atualizarNovidades();
    const intervalo = setInterval(atualizarNovidades, 30000);
    return () => clearInterval(intervalo);
  }, [usuario]);

  if (!clubConfigurado) return null;

  const rotulo = novidades > 0 ? `Notificações: ${novidades} novas` : 'Notificações';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      hitSlop={6}
      onPress={() => router.navigate('/notificacoes')}
      style={({ pressed }) => [styles.botao, { opacity: pressed ? 0.6 : 1 }]}>
      <Ionicons name={novidades > 0 ? 'notifications' : 'notifications-outline'} size={26} color={CORES.dourado} />
      {novidades > 0 && (
        <View style={styles.bolinha}>
          <Text style={styles.numero}>{novidades > 9 ? '9+' : novidades}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  botao: { marginRight: 14, padding: 2 },
  bolinha: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 4,
    backgroundColor: CORES.vermelho,
    borderWidth: 2,
    borderColor: CORES.fundo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numero: { color: CORES.texto, fontSize: 11, fontWeight: '800' },
});
