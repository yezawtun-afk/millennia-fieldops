import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Profile } from "../lib/types";

// The profile row (name, role) is cached on the phone. Starting the app with no
// connection used to leave `profile` as null, which silently disabled anything
// that needed the user - saving records included. With the cache, the app knows
// who is signed in offline, and the server still re-checks everything on upload.
const PROFILE_CACHE_PREFIX = "millennia-fieldops.profile.";

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  initError: string | null;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<{ error?: string; needsConfirmation?: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (!error && data) {
      const row = data as Profile;

      // Deactivated accounts are refused at the database level too, but signing
      // out here stops the app from pretending it is still connected.
      if (row.is_active === false) {
        await supabase.auth.signOut();
        setProfile(null);
        setInitError("This account has been deactivated. Ask an administrator to reactivate it.");
        return;
      }

      setProfile(row);
      setInitError(null);
      // Save a copy so the next start works without a connection.
      void AsyncStorage.setItem(
        PROFILE_CACHE_PREFIX + userId,
        JSON.stringify(row)
      ).catch(() => undefined);
      return;
    }

    // No answer from the server (usually offline): use the copy on the phone.
    const cached = await AsyncStorage.getItem(PROFILE_CACHE_PREFIX + userId).catch(() => null);
    if (cached) {
      try {
        setProfile(JSON.parse(cached) as Profile);
        return;
      } catch {
        // fall through to the error below
      }
    }

    if (error) setInitError(error.message);
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        if (data.session?.user.id) {
          loadProfile(data.session.user.id).finally(() => active && setLoading(false));
        } else {
          setLoading(false);
        }
      })
      .catch((error) => {
        if (!active) return;
        setInitError(error instanceof Error ? error.message : "Could not restore your session.");
        setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user.id) {
        loadProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? { error: error.message } : {};
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim() } },
    });
    if (error) return { error: error.message };
    // If email confirmation is on, there is no session yet.
    return { needsConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user.id) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  const value = useMemo(
    () => ({ session, profile, loading, initError, signIn, signUp, signOut, refreshProfile }),
    [session, profile, loading, initError, signIn, signUp, signOut, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside an AuthProvider");
  return context;
}
