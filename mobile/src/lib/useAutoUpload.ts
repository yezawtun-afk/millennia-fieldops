// Uploads the queue by itself as soon as the phone has a connection again.
// useOnlineStatus() polls the backend every 20s, so the moment it flips from
// offline to online this effect runs and pushes everything that is waiting.
// It also runs once on start-up (for records queued while the app was closed).
import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { syncOutbox } from "./sync";
import { useOnlineStatus } from "./network";

export function useAutoUpload(): void {
  const { profile, session } = useAuth();
  const online = useOnlineStatus();
  // Prefer the session id: it is on the phone already, so uploads can be retried
  // even when the profile row could not be fetched.
  const userId = session?.user.id ?? profile?.id ?? null;

  useEffect(() => {
    if (!online || !userId) return;
    // Best effort: errors stay in the queue and are shown as "Needs retry".
    void syncOutbox(userId).catch(() => undefined);
  }, [online, userId]);
}
