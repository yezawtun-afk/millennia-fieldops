import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { requestAccount, signInWithPhone } from "../lib/api";
import { looksLikePhone, normalizePhone } from "../lib/phone";
import { useI18n } from "../i18n";
import type { Profile } from "../lib/types";

// The profile row (name, role) is cached on the phone. Starting the app with no
// connection used to leave `profile` as null, which silently disabled anything
// that needed the user - saving records included. With the cache, the app knows
// who is signed in offline, and the server still re-checks everything on upload.
const PROFILE_CACHE_PREFIX = "millennia-fieldops.profile.";

// Why a correct password still cannot get in. A missing status means the
// database has not been upgraded yet, so the account is treated as approved.
function refusalMessage(
  profile: Profile,
  t: (text: string) => string
): string | null {
  if (profile.status === "pending") {
    return t("Your account request is waiting for an administrator to approve it.");
  }
  if (profile.status === "declined") {
    return t("Your account request was declined. Contact an administrator.");
  }
  if (profile.is_active === false) {
    return t("This account has been deactivated. Ask an administrator to reactivate it.");
  }
  return null;
}

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  initError: string | null;
  signIn: (identifier: string, password: string) => Promise<{ error?: string }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    phone?: string
  ) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  // Callbacks that run long after render (session restore, sign-in) need the
  // current language without being recreated every time it changes.
  const tRef = useRef(t);
  tRef.current = t;

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

      // Pending, declined and deactivated accounts are refused at the database
      // level too, but signing out here stops the app from pretending it is
      // still connected.
      const refusal = refusalMessage(row, tRef.current);
      if (refusal) {
        await supabase.auth.signOut();
        setProfile(null);
        setInitError(refusal);
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
        setInitError(
          error instanceof Error ? error.message : tRef.current("Could not restore your session.")
        );
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

  const signIn = useCallback(async (identifier: string, password: string) => {
    const value = identifier.trim();

    if (looksLikePhone(value)) {
      // Phone numbers are not Supabase identities. The web dashboard resolves
      // the number to an account and returns a normal session.
      const result = await signInWithPhone(value, password);
      if (!result.access_token || !result.refresh_token) {
        return {
          error: result.error
            ? tRef.current(result.error)
            : tRef.current("Incorrect phone number or password."),
        };
      }
      const { error } = await supabase.auth.setSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      });
      return error ? { error: error.message } : {};
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: value,
      password,
    });
    if (error) return { error: error.message };

    // A pending, declined or deactivated account can still authenticate; the
    // profile row decides. Check before the navigator switches screens.
    if (data.user) {
      const { data: row } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .single();
      const refusal = row ? refusalMessage(row as Profile, tRef.current) : null;
      if (refusal) {
        await supabase.auth.signOut();
        return { error: refusal };
      }
    }

    return {};
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, fullName: string, phone?: string) => {
      const trimmedPhone = phone?.trim() ?? "";
      if (!trimmedPhone) {
        return { error: tRef.current("Enter your phone number. It is how you will sign in.") };
      }
      const normalizedPhone = normalizePhone(trimmedPhone);
      if (!normalizedPhone) {
        return {
          error: tRef.current("Enter a valid phone number, for example 012-345 6789."),
        };
      }

      // The account is created (as pending) by the web dashboard, so the app
      // needs no email confirmation and an email address is optional.
      const result = await requestAccount({
        full_name: fullName.trim(),
        phone: normalizedPhone,
        email: email.trim() || undefined,
        password,
      });

      return result.ok ? {} : { error: result.error };
    },
    []
  );

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
