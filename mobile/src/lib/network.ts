// Detects whether the phone can reach the backend, so the app can show the
// same Online / Offline pill as the web dashboard. No extra dependency: a
// short request to the Supabase health endpoint is enough - any HTTP reply
// means we are online, only a network failure means we are offline.
import { useEffect, useState } from "react";

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let active = true;

    async function ping() {
      if (!URL) return;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        await fetch(`${URL}/auth/v1/health`, { method: "GET", signal: controller.signal });
        if (active) setOnline(true);
      } catch {
        if (active) setOnline(false);
      } finally {
        clearTimeout(timeout);
      }
    }

    ping();
    const interval = setInterval(ping, 20000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return online;
}
