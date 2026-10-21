"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { IconField, PrimaryButton } from "@/components/IconField";
import { looksLikePhone } from "@/lib/phone";

// Explains why a correctly typed password still cannot get in. Kept here so
// the web dashboard and the phone app say the same thing.
function refusalMessage(status: string | undefined, isActive: boolean | undefined): string | null {
  if (status === "pending") {
    return "Your account request is waiting for an administrator to approve it.";
  }
  if (status === "declined") {
    return "Your account request was declined. Contact an administrator.";
  }
  if (isActive === false) {
    return "That account has been deactivated. Ask an administrator to reactivate it.";
  }
  return null;
}

export function LoginForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const value = identifier.trim();

    if (looksLikePhone(value)) {
      // Phone numbers are not Supabase identities; the API route finds the
      // account behind the number and returns a normal session.
      let payload: { access_token?: string; refresh_token?: string; error?: string } = {};
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: value, password }),
        });
        payload = (await response.json()) as typeof payload;
        if (!response.ok || !payload.access_token || !payload.refresh_token) {
          setError(payload.error ?? "Could not sign in. Check your number and password.");
          setBusy(false);
          return;
        }
      } catch {
        setError("Could not reach the server. Check your connection and try again.");
        setBusy(false);
        return;
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: payload.access_token,
        refresh_token: payload.refresh_token,
      });
      if (sessionError) {
        setError(sessionError.message);
        setBusy(false);
        return;
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: value,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setBusy(false);
        return;
      }
    }

    // A pending, declined or deactivated account can still authenticate; the
    // profile row is what says whether it may work. Check it before letting in.
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // select("*") keeps this working before the approval columns exist.
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      const refusal = refusalMessage(profile?.status, profile?.is_active);
      if (refusal) {
        await supabase.auth.signOut();
        setError(refusal);
        setBusy(false);
        return;
      }
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <IconField
        icon={Mail}
        label="Email or phone number"
        type="text"
        name="identifier"
        autoComplete="username"
        placeholder="you@millennia.my or 012-345 6789"
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        required
      />

      <IconField
        icon={Lock}
        label="Password"
        type="password"
        name="password"
        autoComplete="current-password"
        placeholder="Your password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      {error ? (
        <p className="rounded-control border border-negative/25 bg-negative-soft px-3 py-2 text-[12px] text-negative-ink">
          {error}
        </p>
      ) : null}

      <PrimaryButton type="submit" busy={busy}>
        Log in
      </PrimaryButton>
    </form>
  );
}
