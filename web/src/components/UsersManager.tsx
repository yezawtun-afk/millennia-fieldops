"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui";
import { createUser } from "@/app/(app)/users/actions";
import type { Profile, UserRole } from "@/lib/types";

const ROLES: UserRole[] = ["field_worker", "supervisor", "admin"];

const ROLE_LABELS: Record<UserRole, string> = {
  field_worker: "Field worker",
  supervisor: "Supervisor",
  admin: "Administrator",
};

export function UsersManager({
  initialUsers,
  currentUserId,
}: {
  initialUsers: Profile[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ full_name: "", email: "", password: "", role: "field_worker" as UserRole });
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function changeRole(user: Profile, role: UserRole) {
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ role }).eq("id", user.id);
    if (error) return setMessage({ kind: "error", text: error.message });
    startTransition(() => router.refresh());
  }

  async function toggleActive(user: Profile) {
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: !user.is_active })
      .eq("id", user.id);
    if (error) return setMessage({ kind: "error", text: error.message });
    startTransition(() => router.refresh());
  }

  function invite(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await createUser(form);
      if (result.ok) {
        setMessage({ kind: "ok", text: `Account created for ${form.email}.` });
        setForm({ full_name: "", email: "", password: "", role: "field_worker" });
        router.refresh();
      } else {
        setMessage({ kind: "error", text: result.error });
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="p-4 lg:col-span-1">
        <h2 className="mb-3 text-sm font-semibold text-ink">Create account</h2>

        {message ? (
          <p
            className={`mb-3 rounded-md px-3 py-2 text-sm ${
              message.kind === "ok" ? "bg-approved-soft text-approved" : "bg-rejected-soft text-rejected"
            }`}
          >
            {message.text}
          </p>
        ) : null}

        <form onSubmit={invite} className="space-y-3">
          <Input label="Full name" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
          <Input
            label="Email"
            type="email"
            required
            value={form.email}
            onChange={(v) => setForm({ ...form, email: v })}
          />
          <Input
            label="Temporary password"
            type="password"
            required
            value={form.password}
            onChange={(v) => setForm({ ...form, password: v })}
          />
          <label className="block text-sm font-medium text-ink">
            Role
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
              className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-primary"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            disabled={pending}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
          >
            <UserPlus className="h-4 w-4" /> {pending ? "Working..." : "Create account"}
          </button>
        </form>
      </Card>

      <div className="lg:col-span-2">
        <h2 className="mb-3 text-sm font-semibold text-ink">Accounts ({initialUsers.length})</h2>
        <div className="overflow-hidden rounded-lg border border-line bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-page text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold"> </th>
                </tr>
              </thead>
              <tbody>
                {initialUsers.map((user) => {
                  const isSelf = user.id === currentUserId;
                  return (
                    <tr key={user.id} className="border-t border-line hover:bg-page">
                      <td className="px-4 py-3 font-semibold text-ink">
                        {user.full_name}
                        {isSelf ? <span className="ml-2 text-xs font-normal text-muted">(you)</span> : null}
                      </td>
                      <td className="px-4 py-3 text-muted">{user.email}</td>
                      <td className="px-4 py-3">
                        <select
                          value={user.role}
                          disabled={isSelf}
                          onChange={(e) => changeRole(user, e.target.value as UserRole)}
                          className="rounded-md border border-line px-2 py-1 text-xs outline-none focus:border-primary disabled:opacity-60"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            user.is_active ? "bg-approved-soft text-approved" : "bg-rejected-soft text-rejected"
                          }`}
                        >
                          {user.is_active ? "Active" : "Deactivated"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          disabled={isSelf}
                          onClick={() => toggleActive(user)}
                          className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {user.is_active ? "Deactivate" : "Reactivate"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">
          Deactivated accounts keep their data and history but should not be used to sign in.
        </p>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-ink">
      {label}
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}
