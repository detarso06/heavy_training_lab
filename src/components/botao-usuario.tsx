import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { useAvatarAtual } from '@/lib/avatar-atual';
import { CORES } from '@/lib/tema';

/** Heavy Guy escolhido pelo usuário, no canto do cabeçalho: abre Configurações (rota /usuario). */
export function BotaoUsuario() {
  const avatar = useAvatarAtual();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Abrir meu perfil"
      hitSlop={6}
      onPress={() => router.navigate('/usuario')}
      style={({ pressed }) => [styles.botao, { opacity: pressed ? 0.7 : 1 }]}>
      <Image source={avatar.imagem} style={styles.imagem} contentFit="cover" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  botao: { marginRight: 14 },
  imagem: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: CORES.dourado },
});
