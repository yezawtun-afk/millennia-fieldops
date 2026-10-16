"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { IconField, PrimaryButton } from "@/components/IconField";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setBusy(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <IconField
        icon={Mail}
        label="Email"
        type="email"
        name="email"
        autoComplete="email"
        placeholder="you@millennia.my"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
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
        <p className="rounded-md border border-rejected/30 bg-rejected-soft px-3 py-2 text-sm text-rejected">
          {error}
        </p>
      ) : null}

      <PrimaryButton type="submit" busy={busy}>
        Log in
      </PrimaryButton>
    </form>
  );
}
