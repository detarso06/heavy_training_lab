// Aviso do fim do descanso quando o app não está na tela (celular bloqueado ou em segundo plano):
// uma notificação local agendada para o fim do timer. Com o app aberto, quem avisa é a vibração
// do próprio timer, então a notificação não aparece em primeiro plano.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CANAL = 'descanso';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let preparado: Promise<boolean> | null = null;

/** Cria o canal (Android) e pede a permissão uma vez. Se o usuário negar, segue sem aviso. */
function preparar() {
  preparado ??= (async () => {
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(CANAL, {
          name: 'Fim do descanso',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 400, 200, 400],
        });
      }
      const atual = await Notifications.getPermissionsAsync();
      if (atual.granted || atual.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return true;
      if (!atual.canAskAgain) return false;
      const pedido = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowSound: true, allowBadge: false },
      });
      return pedido.granted;
    } catch {
      return false;
    }
  })();
  return preparado;
}

/**
 * Agenda o aviso para daqui a `ms` (padrão: fim do descanso; o cardio usa para a meta de tempo).
 * Devolve o id para cancelar, ou nulo se não deu.
 */
export async function agendarAvisoDescanso(
  ms: number,
  conteudo = { titulo: 'Descanso acabou!', corpo: 'Bora pra próxima série 💪' }
): Promise<string | null> {
  const segundos = Math.ceil(ms / 1000);
  if (segundos < 1 || !(await preparar())) return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: { title: conteudo.titulo, body: conteudo.corpo, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: segundos,
        channelId: CANAL,
      },
    });
  } catch {
    return null;
  }
}

export async function cancelarAvisoDescanso(id: string) {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Já disparou ou não existe mais.
  }
}
