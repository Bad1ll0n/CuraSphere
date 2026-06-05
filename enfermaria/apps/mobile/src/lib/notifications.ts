import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import api from './api';

// Configurar o comportamento das notificações quando a app está em foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registarPushToken(): Promise<void> {
  // Push só funciona em dispositivo físico (não em simulador)
  if (!Device.isDevice) return;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  // Necessário no Android (canal de notificações)
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('curasphere-alertas', {
      name: 'Alertas Clínicos',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#dc2626',
    });
  }

  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;

  // Registar o token no backend
  try {
    await api.post('/notificacoes/registar-token', {
      token,
      plataforma: Platform.OS,
    });
  } catch {
    // Silencioso — não bloquear o login por falha no push
  }
}

export function configurarHandlers(
  onNotificacao?: (notification: Notifications.Notification) => void,
  onResposta?: (response: Notifications.NotificationResponse) => void,
): () => void {
  const subN = Notifications.addNotificationReceivedListener((n) => {
    onNotificacao?.(n);
  });

  const subR = Notifications.addNotificationResponseReceivedListener((r) => {
    onResposta?.(r);
  });

  // Retorna função de cleanup para usar em useEffect
  return () => {
    Notifications.removeNotificationSubscription(subN);
    Notifications.removeNotificationSubscription(subR);
  };
}
