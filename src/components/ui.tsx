import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from 'expo-router';
import { useState, type ComponentProps, type Ref } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ColorValue,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { CORES } from '@/lib/tema';

type NomeIcone = ComponentProps<typeof Ionicons>['name'];

interface BotaoProps {
  titulo: string;
  onPress: () => void;
  variante?: 'primario' | 'secundario' | 'perigo';
  icone?: NomeIcone;
  desabilitado?: boolean;
  style?: StyleProp<ViewStyle>;
}

const COR_BOTAO = { primario: CORES.vermelho, secundario: CORES.dourado, perigo: CORES.vermelho };

export function Botao({ titulo, onPress, variante = 'primario', icone, desabilitado, style }: BotaoProps) {
  const cor = COR_BOTAO[variante];
  const cheio = variante === 'primario';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={desabilitado}
      onPress={onPress}
      style={({ pressed }) => [
        styles.botao,
        cheio ? { backgroundColor: cor } : { borderColor: cor, borderWidth: 1.5 },
        { opacity: desabilitado ? 0.4 : pressed ? 0.7 : 1 },
        style,
      ]}>
      {icone && <Ionicons name={icone} size={20} color={cheio ? CORES.texto : cor} />}
      <Text style={[styles.textoBotao, { color: cheio ? CORES.texto : cor }]}>{titulo}</Text>
    </Pressable>
  );
}

export function BotaoIcone({
  icone,
  onPress,
  rotulo,
  desabilitado,
  cor,
}: {
  icone: NomeIcone;
  onPress: () => void;
  rotulo: string;
  desabilitado?: boolean;
  cor?: ColorValue;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      disabled={desabilitado}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.botaoIcone, { opacity: desabilitado ? 0.25 : pressed ? 0.5 : 1 }]}>
      <Ionicons name={icone} size={22} color={cor ?? colors.text} />
    </Pressable>
  );
}

export function Campo(props: TextInputProps & { ref?: Ref<TextInput> }) {
  const { colors } = useTheme();
  return (
    <TextInput
      placeholderTextColor={CORES.textoSuave}
      {...props}
      style={[styles.campo, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }, props.style]}
    />
  );
}

export function Cartao({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.cartao, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
      {children}
    </View>
  );
}

/** Contador com − e +. */
export function Contador({
  valor,
  onChange,
  min = 0,
  max = 99,
  passo = 1,
  formatar = String,
  rotulo,
}: {
  valor: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  passo?: number;
  formatar?: (v: number) => string;
  rotulo: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.contador}>
      <BotaoIcone
        icone="remove-circle-outline"
        rotulo={`Diminuir ${rotulo}`}
        desabilitado={valor <= min}
        onPress={() => onChange(Math.max(min, valor - passo))}
        cor={CORES.dourado}
      />
      <Text style={[styles.valorContador, { color: colors.text }]}>{formatar(valor)}</Text>
      <BotaoIcone
        icone="add-circle-outline"
        rotulo={`Aumentar ${rotulo}`}
        desabilitado={valor >= max}
        onPress={() => onChange(Math.min(max, valor + passo))}
        cor={CORES.dourado}
      />
    </View>
  );
}

/** Botão que abre um campo para digitar um nome e confirmar. */
export function CriarComNome({
  titulo,
  placeholder,
  onCriar,
}: {
  titulo: string;
  placeholder: string;
  onCriar: (nome: string) => Promise<void> | void;
}) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState('');

  if (!aberto) return <Botao titulo={titulo} icone="add" onPress={() => setAberto(true)} />;

  const confirmar = async () => {
    const limpo = nome.trim();
    if (!limpo) return;
    await onCriar(limpo);
    setNome('');
    setAberto(false);
  };

  return (
    <Cartao style={styles.formNome}>
      <Campo
        autoFocus
        placeholder={placeholder}
        value={nome}
        onChangeText={setNome}
        onSubmitEditing={confirmar}
        returnKeyType="done"
      />
      <View style={styles.linhaBotoes}>
        <Botao titulo="Cancelar" variante="secundario" onPress={() => setAberto(false)} style={styles.flex} />
        <Botao titulo="Criar" onPress={confirmar} desabilitado={!nome.trim()} style={styles.flex} />
      </View>
    </Cartao>
  );
}

export function Selo({ texto }: { texto: string }) {
  return (
    <View style={[styles.selo, { backgroundColor: CORES.dourado }]}>
      <Text style={styles.textoSelo}>{texto}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  botao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  textoBotao: { fontSize: 16, fontWeight: '600' },
  botaoIcone: { padding: 4 },
  campo: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  cartao: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14 },
  contador: { flexDirection: 'row', alignItems: 'center' },
  valorContador: { minWidth: 34, textAlign: 'center', fontSize: 16, fontWeight: '600' },
  formNome: { gap: 10 },
  linhaBotoes: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  selo: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  textoSelo: { color: CORES.sobreDestaque, fontSize: 12, fontWeight: '700' },
});
