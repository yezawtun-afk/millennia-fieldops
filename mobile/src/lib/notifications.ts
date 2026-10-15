// Local notifications using expo-notifications.
// When the app is opened and there are unread review notifications, the app
// shows them as phone notifications too.
import * as Notifications from "expo-notifications";
import { supabase } from "./supabase";
import type { AppNotification } from "./types";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

// Fetches unread notifications and shows a local notification for each.
export async function presentUnreadNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .is("read_at", null)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  const notifications = data as AppNotification[];

  const granted = await ensureNotificationPermission();
  if (granted) {
    for (const item of notifications) {
      await Notifications.scheduleNotificationAsync({
        content: { title: "Millennia FieldOps", body: item.message },
        trigger: null,
      });
    }
  }

  return notifications;
}

export async function markAllRead(userId: string): Promise<void> {
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
}
