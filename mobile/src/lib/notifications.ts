// Local notifications using expo-notifications.
// When the app is opened and there are unread review notifications, the app
// shows them as phone notifications too.
//
// The library is imported lazily and defensively on purpose. Expo Go for
// Android does not ship the native modules for remote (push) notifications, and
// `expo-notifications` requires some of them while it is being imported, so a
// plain top-level import can crash the whole app at start-up. Loading it here
// means a missing native module can only turn off the phone notification; the
// in-app notification list keeps working. See
// `patches/expo-notifications+57.0.23.patch` for the library-side fix.
import { supabase } from "./supabase";
import type { AppNotification } from "./types";

type NotificationsModule = typeof import("expo-notifications");

let modulePromise: Promise<NotificationsModule | null> | null = null;
let handlerRegistered = false;

function registerNotificationHandler(module: NotificationsModule): void {
  if (handlerRegistered) return;
  module.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: true,
    }),
  });
  handlerRegistered = true;
}

async function loadNotifications(): Promise<NotificationsModule | null> {
  if (!modulePromise) {
    modulePromise = import("expo-notifications")
      .then((module) => {
        registerNotificationHandler(module);
        return module;
      })
      .catch((error: unknown) => {
        console.warn(
          "[notifications] phone notifications are unavailable on this build, " +
            "continuing without them:",
          error
        );
        return null;
      });
  }
  return modulePromise;
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const notifications = await loadNotifications();
  if (!notifications) return false;
  try {
    const current = await notifications.getPermissionsAsync();
    if (current.granted) return true;
    const requested = await notifications.requestPermissionsAsync();
    return requested.granted;
  } catch {
    return false;
  }
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
    const native = await loadNotifications();
    if (native) {
      for (const item of notifications) {
        try {
          await native.scheduleNotificationAsync({
            content: { title: "Millennia FieldOps", body: item.message },
            trigger: null,
          });
        } catch {
          // Showing a phone notification is best-effort; never break the screen.
        }
      }
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
