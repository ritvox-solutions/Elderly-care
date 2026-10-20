import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';

import { registerPushToken } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface FallNotificationData {
  type: 'fall_alert';
  alert_id: string;
  patient_name: string;
  room_number: string;
  device_id: string;
  magnitude: number;
  timestamp: string;
}

export async function enableFallPushNotifications(accessToken: string) {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('fall-alerts', {
      name: 'Critical fall alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 250, 500, 250, 500],
      lightColor: '#e11d48',
      sound: 'default',
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.status === 'granted'
    ? existing
    : await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return false;

  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn('Fall push notifications need EXPO_PUBLIC_EAS_PROJECT_ID or an EAS project link.');
    return false;
  }

  const pushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await registerPushToken(pushToken, accessToken);
  return true;
}

export function readFallNotification(notification: Notifications.Notification): FallNotificationData | null {
  const data = notification.request.content.data as Partial<FallNotificationData>;
  if (data.type !== 'fall_alert' || !data.alert_id || !data.timestamp) return null;
  return {
    type: 'fall_alert',
    alert_id: data.alert_id,
    patient_name: String(data.patient_name || 'Patient'),
    room_number: String(data.room_number || data.device_id || 'Unknown room'),
    device_id: String(data.device_id || ''),
    magnitude: Number(data.magnitude || 0),
    timestamp: data.timestamp,
  };
}

export { Notifications };
