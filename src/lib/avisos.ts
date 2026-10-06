import { Alert, Platform } from 'react-native';

// No react-native-web o Alert.alert não exibe nada, então no navegador usamos window.alert.
// Para confirmações, use useConfirmacao (components/dialogo-confirmacao.tsx).

export function avisar(titulo: string, mensagem: string) {
  if (Platform.OS === 'web') globalThis.alert(`${titulo}\n\n${mensagem}`);
  else Alert.alert(titulo, mensagem);
}

export function mensagemDeErro(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}
