// Phone sign-in resolver.
//
// Supabase Auth only knows email addresses (its phone provider needs a paid SMS
// provider and a one-time code). So a phone number lives on the profile row,
// and this route turns "phone + password" into a normal email session:
//
//   1. normalise the number and find the account with the service role;
//   2. check the password against Supabase Auth;
//   3. only then look at the approval status, so a stranger cannot use this
//      endpoint to find out whether a number is registered or waiting;
//   4. return the tokens, which the app hands to `supabase.auth.setSession`.
//
// The email address is never returned to the caller.
import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/phone";
import { getT } from "@/i18n/server";

export const runtime = "nodejs";

const GENERIC_ERROR = "Incorrect phone number or password.";

// Best-effort rate limit. Serverless instances do not share memory, so this
// slows a single attacker down rather than stopping a botnet; Supabase Auth has
// its own limits behind it. Only failed attempts count, so a busy shared
// connection (a campus Wi-Fi, a demo) does not lock people out.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILURES = 20;
const failures = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(key: string): boolean {
  const entry = failures.get(key);
  if (!entry) return false;
  if (entry.resetAt < Date.now()) {
    failures.delete(key);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

function recordFailure(key: string): void {
  const now = Date.now();
  const entry = failures.get(key);
  if (!entry || entry.resetAt < now) {
    failures.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  entry.count += 1;
}

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: Request) {
  const t = await getT();
  const key = clientKey(request);
  if (isRateLimited(key)) {
    return NextResponse.json(
      { error: t("Too many attempts. Wait a few minutes and try again.") },
      { status: 429 }
    );
  }

  let body: { identifier?: unknown; password?: unknown };
  try {
    body = (await request.json()) as { identifier?: unknown; password?: unknown };
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }

  const identifier = typeof body.identifier === "string" ? body.identifier : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!identifier.trim() || !password || password.length > 200) {
    return NextResponse.json(
      { error: t("Enter your phone number and password.") },
      { status: 400 }
    );
  }

  const phone = normalizePhone(identifier);
  if (!phone) {
    return NextResponse.json(
      { error: t("Enter a valid phone number, for example 012-345 6789.") },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!admin || !url || !anonKey) {
    return NextResponse.json(
      { error: "Phone sign-in is not configured on the server." },
      { status: 500 }
    );
  }

  const { data: profile, error: lookupError } = await admin
    .from("profiles")
    .select("email, status, is_active")
    .eq("phone", phone)
    .maybeSingle();

  if (lookupError) {
    // Usually means 01_schema.sql has not been re-run on this database yet.
    return NextResponse.json(
      { error: t("Phone sign-in is not available yet. Use your email for now.") },
      { status: 503 }
    );
  }

  // Same answer whether the number is unknown or the password is wrong, so the
  // endpoint cannot be used to test which numbers have accounts.
  if (!profile?.email) {
    recordFailure(key);
    return NextResponse.json({ error: t(GENERIC_ERROR) }, { status: 401 });
  }

  const supabase = createSupabaseClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password,
  });

  if (signInError || !signIn.session) {
    recordFailure(key);
    return NextResponse.json({ error: t(GENERIC_ERROR) }, { status: 401 });
  }

  // The password is correct, so the caller owns the account and it is safe to
  // explain why it cannot be used. Do not hand out a session for a blocked one.
  const status = profile.status as "pending" | "approved" | "declined" | undefined;
  if (status && status !== "approved") {
    return NextResponse.json(
      {
        error:
          status === "pending"
            ? t("Your account request is waiting for an administrator to approve it.")
            : t("Your account request was declined. Contact an administrator."),
        code: status,
      },
      { status: 403 }
    );
  }

  if (profile.is_active === false) {
    return NextResponse.json(
      {
        error: t("That account has been deactivated. Ask an administrator to reactivate it."),
        code: "inactive",
      },
      { status: 403 }
    );
  }

  return NextResponse.json({
    access_token: signIn.session.access_token,
    refresh_token: signIn.session.refresh_token,
    expires_in: signIn.session.expires_in,
    expires_at: signIn.session.expires_at,
    token_type: signIn.session.token_type,
  });
}
