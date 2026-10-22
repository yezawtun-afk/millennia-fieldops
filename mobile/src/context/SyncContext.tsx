// The single source of truth for the sync badge: connection, queue counts and
// whether an upload is running right now.
//
// Everything that changes the queue reports here (the sync engine emits start
// and finish events), and the counts are re-read from SQLite after every run,
// so the badge is never a guess.
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./AuthContext";
import { currentOnlineStatus, useOnlineStatus } from "../lib/network";
import { countDrafts, countFailed, countPending } from "../lib/sqlite";
import { subscribeSync, syncOutbox, type SyncResult } from "../lib/sync";

const LAST_SYNC_KEY = "millennia-fieldops.last-sync";

export type SyncStatus = "synced" | "syncing" | "offline" | "needsRetry";

interface SyncValue {
  online: boolean;
  syncing: boolean;
  queued: number;
  failed: number;
  drafts: number;
  lastSyncedAt: string | null;
  status: SyncStatus;
  remaining: number;
  refresh: () => Promise<void>;
  syncNow: () => Promise<SyncResult | null>;
}

const SyncContext = createContext<SyncValue | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { profile, session } = useAuth();
  const userId = session?.user.id ?? profile?.id ?? null;
  const online = useOnlineStatus();

  const [syncing, setSyncing] = useState(false);
  const [queued, setQueued] = useState(0);
  const [failed, setFailed] = useState(0);
  const [drafts, setDrafts] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(LAST_SYNC_KEY)
      .then((value) => {
        if (value && mounted.current) setLastSyncedAt(value);
      })
      .catch(() => undefined);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [pending, errors, draftCount] = await Promise.all([
        countPending(),
        countFailed(),
        countDrafts(),
      ]);
      if (!mounted.current) return;
      setQueued(pending);
      setFailed(errors);
      setDrafts(draftCount);
    } catch {
      // The database might not be open yet; the next refresh will catch up.
    }
  }, []);

  // Queue changes happen outside React (SQLite writes), so poll cheaply and
  // also refresh whenever the screen comes back into focus via refresh().
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 8000);
    return () => clearInterval(timer);
  }, [refresh, userId]);

  useEffect(() => {
    return subscribeSync((event) => {
      setSyncing(event.running);
      if (event.running) return;

      void refresh();
      if (event.result && event.result.uploaded > 0) {
        const stamp = new Date().toISOString();
        setLastSyncedAt(stamp);
        void AsyncStorage.setItem(LAST_SYNC_KEY, stamp).catch(() => undefined);
      }
    });
  }, [refresh]);

  const syncNow = useCallback(async (): Promise<SyncResult | null> => {
    if (!userId) return null;
    // Let the button work as a "retry" even if the last ping failed: the
    // upload itself is the real test of the connection.
    try {
      return await syncOutbox(userId);
    } catch {
      return null;
    } finally {
      void refresh();
    }
  }, [userId, refresh]);

  // Upload waiting records by itself when the phone has a connection (and once
  // on start-up, for anything queued while the app was closed).
  useEffect(() => {
    if (!userId || !currentOnlineStatus()) return;
    void syncOutbox(userId).catch(() => undefined);
  }, [userId, online]);

  const remaining = queued + failed;
  let status: SyncStatus;
  if (!online) status = "offline";
  else if (syncing || queued > 0) status = "syncing";
  else if (failed > 0) status = "needsRetry";
  else status = "synced";

  return (
    <SyncContext.Provider
      value={{
        online,
        syncing,
        queued,
        failed,
        drafts,
        lastSyncedAt,
        status,
        remaining,
        refresh,
        syncNow,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncValue {
  const value = useContext(SyncContext);
  if (!value) throw new Error("useSync must be used inside SyncProvider");
  return value;
}
