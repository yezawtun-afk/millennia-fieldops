"use server";

import { getProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/phone";
import type { UserRole } from "@/lib/types";

export interface CreateUserInput {
  full_name: string;
  email: string;
  password: string;
  role: UserRole;
  phone?: string;
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

  if (!input.email.trim() || input.password.length < 6) {
    return { ok: false, error: "Enter an email and a password of at least 6 characters." };
  }

  const phone = input.phone?.trim() ? normalizePhone(input.phone) : null;
  if (input.phone?.trim() && !phone) {
    return { ok: false, error: "Enter a valid phone number, for example 012-345 6789." };
  }

  const admin = createAdminClient();
  if (!admin) {
    return {
      ok: false,
      error: "Server is missing SUPABASE_SERVICE_ROLE_KEY (see web/.env.local).",
    };
  }

  if (phone) {
    const { data: clash } = await admin
      .from("profiles")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();
    if (clash) {
      return { ok: false, error: "Another account already uses that phone number." };
    }
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: input.email.trim(),
    password: input.password,
    email_confirm: true,
    user_metadata: {
      full_name: input.full_name.trim() || input.email.split("@")[0],
      ...(phone ? { phone } : {}),
    },
  });

  if (error) return { ok: false, error: error.message };

  // The database trigger creates the profile as an unapproved field worker
  // (that is what self sign-ups must get). An account created here by an
  // administrator is approved immediately, with the chosen role.
  if (data.user) {
    const { error: profileError } = await admin
      .from("profiles")
      .update({
        role: input.role,
        status: "approved",
        phone,
        decided_by: profile.id,
        decided_at: new Date().toISOString(),
      })
      .eq("id", data.user.id);

    if (profileError) {
      return {
        ok: false,
        error: `Account created, but its profile could not be updated: ${profileError.message}`,
      };
    }
  }

  return { ok: true };
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
    .select("id, full_name, role")
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

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}
