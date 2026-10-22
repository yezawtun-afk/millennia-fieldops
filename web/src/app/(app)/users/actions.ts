"use server";

import { getProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone, phoneEmail } from "@/lib/phone";
import type { UserRole } from "@/lib/types";

export interface CreateUserInput {
  full_name: string;
  phone: string;
  email?: string;
  password: string;
  role: UserRole;
}

export type CreateUserResult = { ok: true } | { ok: false; error: string };
export type ActionResult = { ok: true } | { ok: false; error: string };

// Creates a new account on behalf of an administrator. Runs on the server with
// the service role key, so this file must never be imported by a client
// component directly (the client only calls the exported action).
export async function createUser(input: CreateUserInput): Promise<CreateUserResult> {
  const profile = await getProfile();
  if (profile?.role !== "admin") {
    return { ok: false, error: "Only administrators can create accounts." };
  }

  if (!input.email?.trim() && !input.phone?.trim()) {
    return { ok: false, error: "Enter a phone number (email is optional)." };
  }
  if (input.password.length < 6) {
    return { ok: false, error: "Choose a password of at least 6 characters." };
  }

  const phone = normalizePhone(input.phone ?? "");
  if (!phone) {
    return { ok: false, error: "Enter a valid phone number, for example 012-345 6789." };
  }

  const typedEmail = input.email?.trim().toLowerCase() ?? "";
  // Phone-first accounts still need an Auth identity; the placeholder is never
  // shown and never receives mail.
  const email = typedEmail || phoneEmail(phone);

  const admin = createAdminClient();
  if (!admin) {
    return {
      ok: false,
      error: "Server is missing SUPABASE_SERVICE_ROLE_KEY (see web/.env.local).",
    };
  }

  const { data: phoneClash, error: lookupError } = await admin
    .from("profiles")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  if (lookupError) {
    return {
      ok: false,
      error: "Run 01_schema.sql, 02_policies.sql and 04_triggers.sql first: the phone column is missing.",
    };
  }
  if (phoneClash) return { ok: false, error: "Another account already uses that phone number." };

  const { data: emailClash } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (emailClash) return { ok: false, error: "Another account already uses that email address." };

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.full_name.trim() || fullNameFromPhone(phone), phone },
  });

  if (error) return { ok: false, error: error.message };

  // The database trigger creates the profile as an unapproved field worker
  // (that is what self sign-ups must get). An account created here by an
  // administrator is approved immediately, with the chosen role.
  if (data.user) {
    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: data.user.id,
        full_name: input.full_name.trim() || fullNameFromPhone(phone),
        email,
        phone,
        role: input.role,
        status: "approved",
        is_active: true,
        decided_by: profile.id,
        decided_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (profileError) {
      return {
        ok: false,
        error: `Account created, but its profile could not be updated: ${profileError.message}`,
      };
    }

    // The service role has no signed-in user inside the database, so the audit
    // row is written here, with the administrator as the actor.
    await recordAudit(admin, {
      actorId: profile.id,
      actorName: profile.full_name,
      action: "account.created",
      entityId: data.user.id,
      summary: `${profile.full_name} created an account for ${
        input.full_name.trim() || fullNameFromPhone(phone)
      }${typedEmail ? ` (${typedEmail})` : ` (${phone})`}`,
      details: { role: input.role, phone, email: typedEmail || null },
    });
  }

  return { ok: true };
}

function fullNameFromPhone(phone: string): string {
  return `Field worker ${phone.slice(-4)}`;
}

// Best effort: a failed audit write must not undo a real action, but it should
// be visible in the server log.
async function recordAudit(
  admin: ReturnType<typeof createAdminClient>,
  entry: {
    actorId: string;
    actorName: string;
    action: string;
    entityId: string;
    summary: string;
    details?: Record<string, unknown>;
  }
): Promise<void> {
  if (!admin) return;
  const { error } = await admin.from("audit_logs").insert({
    actor_id: entry.actorId,
    actor_name: entry.actorName,
    action: entry.action,
    entity: "account",
    entity_id: entry.entityId,
    summary: entry.summary,
    details: entry.details ?? {},
  });
  if (error) console.error("audit write failed:", error.message);
}

// Permanently removes an account. Deactivate is the safer everyday action, so
// this one refuses when the account still owns field records: `records.
// submitted_by` points at the profile and deleting it would erase site history.
export async function deleteUser(userId: string): Promise<ActionResult> {
  const profile = await getProfile();
  if (profile?.role !== "admin") {
    return { ok: false, error: "Only administrators can delete accounts." };
  }
  if (!userId) return { ok: false, error: "Pick an account first." };
  if (userId === profile.id) {
    return { ok: false, error: "You cannot delete your own account." };
  }

  const admin = createAdminClient();
  if (!admin) {
    return {
      ok: false,
      error: "Server is missing SUPABASE_SERVICE_ROLE_KEY (see web/.env.local).",
    };
  }

  const { data: target, error: targetError } = await admin
    .from("profiles")
    .select("id, full_name, role, email, phone")
    .eq("id", userId)
    .maybeSingle();

  if (targetError) return { ok: false, error: targetError.message };
  if (!target) return { ok: false, error: "That account no longer exists." };

  if (target.role === "admin") {
    const { count: otherAdmins } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .neq("id", userId);
    if (!otherAdmins) {
      return {
        ok: false,
        error: "This is the last administrator. Make someone else an administrator first.",
      };
    }
  }

  const { count: recordCount } = await admin
    .from("records")
    .select("id", { count: "exact", head: true })
    .eq("submitted_by", userId);

  if (recordCount && recordCount > 0) {
    return {
      ok: false,
      error: `${target.full_name} has ${recordCount} field record${
        recordCount === 1 ? "" : "s"
      }. Deactivate the account instead, or ask an administrator to reassign those records first.`,
    };
  }

  await recordAudit(admin, {
    actorId: profile.id,
    actorName: profile.full_name,
    action: "account.deleted",
    entityId: userId,
    summary: `${profile.full_name} deleted ${target.full_name}`,
    details: { role: target.role, email: target.email, phone: target.phone },
  });

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}
