// Local notifications using expo-notifications.
// Two paths use this file:
//   - presentUnreadNotifications(): on demand (the "Enable phone alerts" button).
//   - watchNotifications(): while the app is open, poll for a review the app has
//     not announced yet and raise one phone notification for it.
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

// ---------------------------------------------------------------------------
// Live watching while the app is open
// ---------------------------------------------------------------------------
//
// Reviews happen on the web dashboard, so the phone only finds out when it asks.
// This watcher asks every 20 seconds (any tab, the whole time the app is in
// front) and raises a phone notification the first time it sees a review it has
// not announced yet. It also reports the unread count so the tab can show a
// badge.
//
// Scope, honestly: this works while the app is running. A review made while the
// app is closed still waits for the next launch - real background delivery needs
// a Firebase project plus an Expo push token and a server-side push send, which
// is a separate piece of setup.
const WATCH_INTERVAL_MS = 20000;

export function watchNotifications(
  userId: string,
  onUnreadCount?: (count: number) => void
): () => void {
  let stopped = false;
  // The newest notification we already know about, so the first pass does not
  // fire a banner for the whole backlog.
  let newestKnown: string | null = null;

  async function tick(): Promise<void> {
    if (stopped) return;

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (stopped || error || !data) return;
    const all = data as AppNotification[];

    onUnreadCount?.(all.filter((item) => !item.read_at).length);

    const newest = all[0]?.created_at ?? null;
    if (newestKnown === null) {
      newestKnown = newest;
      return;
    }

    const fresh = all.filter((item) => item.created_at > (newestKnown as string));
    if (fresh.length === 0) return;
    newestKnown = fresh[0].created_at;

    const granted = await ensureNotificationPermission();
    if (!granted) return;
    const native = await loadNotifications();
    if (!native) return;

    // Oldest first, so the newest message sits on top of the notification list.
    for (const item of [...fresh].reverse()) {
      try {
        await native.scheduleNotificationAsync({
          content: { title: "Millennia FieldOps", body: item.message },
          trigger: null,
        });
      } catch {
        // A phone notification is best-effort; the in-app list is the record.
      }
    }
  }

  void tick();
  const interval = setInterval(() => {
    void tick();
  }, WATCH_INTERVAL_MS);

  return () => {
    stopped = true;
    clearInterval(interval);
  };
}
