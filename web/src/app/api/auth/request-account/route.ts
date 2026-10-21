// Public endpoint used by the phone app to ask for an account.
//
// A request must work without an email address, so the account is created on
// the server with the service role:
//
//   * the phone number is the real identifier and is required;
//   * the email address is optional; when it is missing the account gets a
//     private placeholder address, because Supabase Auth needs one;
//   * the profile row is written as `pending`, so the database refuses all
//     data until an administrator approves it.
//
// Creating the account here (instead of in the app with supabase.auth.signUp)
// also means email confirmation never blocks a phone-first request.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone, phoneEmail } from "@/lib/phone";

export const runtime = "nodejs";

// Five requests per IP per hour: enough for a family or a shared phone, far
// below what a spam script needs. Best effort - serverless instances do not
// share this memory.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS = 5;
const requests = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = requests.get(key);
  if (!entry || entry.resetAt < now) {
    requests.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_REQUESTS;
}

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  if (isRateLimited(clientKey(request))) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }

  const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
  const phoneRaw = typeof body.phone === "string" ? body.phone.trim() : "";
  const emailRaw = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!fullName || fullName.length > 80) {
    return NextResponse.json({ error: "Enter your full name." }, { status: 400 });
  }
  if (password.length < 6 || password.length > 200) {
    return NextResponse.json(
      { error: "Choose a password of at least 6 characters." },
      { status: 400 }
    );
  }

  const phone = normalizePhone(phoneRaw);
  if (!phone) {
    return NextResponse.json(
      { error: "Enter a valid phone number, for example 012-345 6789." },
      { status: 400 }
    );
  }

  if (emailRaw && !EMAIL_PATTERN.test(emailRaw)) {
    return NextResponse.json({ error: "That email address does not look right." }, { status: 400 });
  }

  const email = emailRaw || phoneEmail(phone);

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Account requests are not configured on the server." },
      { status: 500 }
    );
  }

  // If these columns are missing, 01_schema.sql has not been run yet.
  const { data: phoneClash, error: lookupError } = await admin
    .from("profiles")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json(
      {
        error:
          "Account requests are not available yet. Run 01_schema.sql, 02_policies.sql and 04_triggers.sql in Supabase.",
      },
      { status: 503 }
    );
  }

  if (phoneClash) {
    return NextResponse.json(
      { error: "An account already uses this phone number. Try signing in.", code: "exists" },
      { status: 409 }
    );
  }

  const { data: emailClash } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (emailClash) {
    return NextResponse.json(
      { error: "An account already uses this email address. Try signing in.", code: "exists" },
      { status: 409 }
    );
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone },
  });

  if (createError || !created.user) {
    const message = createError?.message ?? "Could not create the account.";
    return NextResponse.json(
      {
        error: /already|registered|exists/i.test(message)
          ? "An account already uses these details. Try signing in."
          : message,
      },
      { status: 409 }
    );
  }

  // The trigger normally writes the profile; upserting makes the request
  // complete even if 04_triggers.sql has not been re-run yet, and guarantees
  // the row is pending rather than approved.
  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: created.user.id,
      full_name: fullName,
      email,
      phone,
      role: "field_worker",
      status: "pending",
      is_active: true,
      requested_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (profileError) {
    return NextResponse.json(
      { error: `Account created, but the request could not be saved: ${profileError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
