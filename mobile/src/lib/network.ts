// Detects whether the phone can reach the backend, so the app can show the
// sync badge and the Online / Offline pill. No extra dependency: a short
// request to the Supabase health endpoint is enough - any HTTP reply means we
// are online, only a network failure means we are offline.
//
// One poller is shared by every component that asks (Home, the sync provider,
// the automatic uploader), so the app sends one ping every 20 seconds, not one
// per screen.
import { useEffect, useState } from "react";

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const POLL_MS = 20000;

type Listener = (online: boolean) => void;

let online = true;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<Listener>();

async function ping(): Promise<void> {
  if (!URL) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    await fetch(`${URL}/auth/v1/health`, { method: "GET", signal: controller.signal });
    setOnline(true);
  } catch {
    setOnline(false);
  } finally {
    clearTimeout(timeout);
  }
}

function setOnline(next: boolean): void {
  if (online === next) return;
  online = next;
  for (const listener of listeners) listener(next);
}

function startPolling(): void {
  if (timer) return;
  void ping();
  timer = setInterval(() => void ping(), POLL_MS);
}

function stopPolling(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

export function currentOnlineStatus(): boolean {
  return online;
}

export function subscribeOnline(listener: Listener): () => void {
  listeners.add(listener);
  if (listeners.size === 1) startPolling();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stopPolling();
  };
}

export function useOnlineStatus(): boolean {
  const [value, setValue] = useState(online);

  useEffect(() => {
    setValue(online);
    return subscribeOnline(setValue);
  }, []);

  return value;
}
