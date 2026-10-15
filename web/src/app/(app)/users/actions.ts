"use server";

import { getProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/types";

export interface CreateUserInput {
  full_name: string;
  email: string;
  password: string;
  role: UserRole;
}

export type CreateUserResult = { ok: true } | { ok: false; error: string };

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

  const admin = createAdminClient();
  if (!admin) {
    return {
      ok: false,
      error: "Server is missing SUPABASE_SERVICE_ROLE_KEY (see web/.env.local).",
    };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: input.email.trim(),
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.full_name.trim() || input.email.split("@")[0] },
  });

  if (error) return { ok: false, error: error.message };

  // The database trigger creates the profile as field_worker; upgrade it if a
  // different role was chosen.
  if (input.role !== "field_worker" && data.user) {
    await admin.from("profiles").update({ role: input.role }).eq("id", data.user.id);
  }

  return { ok: true };
}
