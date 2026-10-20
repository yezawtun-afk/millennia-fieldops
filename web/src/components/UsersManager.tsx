"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, btnPrimary, inputClass, selectClass, tdClass, thClass } from "@/components/ui";
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
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "field_worker" as UserRole,
  });
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
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="h-fit p-4">
        <h2 className="text-[14px] font-semibold text-ink">Create an account</h2>
        <p className="mt-0.5 text-[12px] text-muted">
          Share the temporary password with the person, and ask them to change it.
        </p>

        {message ? (
          <p
            className={`mt-3 rounded-control px-3 py-2 text-[12px] ${
              message.kind === "ok"
                ? "bg-positive-soft text-positive-ink"
                : "bg-negative-soft text-negative-ink"
            }`}
          >
            {message.text}
          </p>
        ) : null}

        <form onSubmit={invite} className="mt-3 space-y-3">
          <Field label="Full name">
            <input
              value={form.full_name}
              onChange={(event) => setForm({ ...form, full_name: event.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              required
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Temporary password">
            <input
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Role">
            <select
              value={form.role}
              onChange={(event) => setForm({ ...form, role: event.target.value as UserRole })}
              className={selectClass}
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </Field>

          <button type="submit" disabled={pending} className={`${btnPrimary} w-full`}>
            <UserPlus className="h-4 w-4" strokeWidth={1.7} />
            {pending ? "Creating account" : "Create account"}
          </button>
        </form>
      </Card>

      <Card className="h-fit overflow-hidden">
        <div className="flex items-center justify-between border-b border-rule px-4 py-3">
          <h2 className="text-[14px] font-semibold text-ink">Accounts</h2>
          <span className="text-[12px] text-muted">{initialUsers.length} people</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-rule">
                <th className={thClass}>Name</th>
                <th className={thClass}>Role</th>
                <th className={thClass}>Status</th>
                <th className={`${thClass} text-right`}> </th>
              </tr>
            </thead>
            <tbody>
              {initialUsers.map((user) => {
                const isSelf = user.id === currentUserId;
                return (
                  <tr
                    key={user.id}
                    className="border-b border-rule transition-colors last:border-b-0 hover:bg-panel"
                  >
                    <td className={`${tdClass} font-medium`}>
                      {user.full_name}
                      {isSelf ? (
                        <span className="ml-2 text-[12px] font-normal text-muted">you</span>
                      ) : null}
                      <span className="mt-0.5 block text-[12px] font-normal text-muted">
                        {user.email}
                      </span>
                    </td>
                    <td className={tdClass}>
                      <select
                        value={user.role}
                        disabled={isSelf}
                        onChange={(event) => changeRole(user, event.target.value as UserRole)}
                        aria-label={`Role for ${user.full_name}`}
                        className="h-8 rounded-control border border-control bg-sheet px-2 text-[12px] text-ink focus:border-accent focus:outline-none disabled:opacity-60"
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={tdClass}>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          user.is_active
                            ? "bg-positive-soft text-positive-ink"
                            : "bg-negative-soft text-negative-ink"
                        }`}
                      >
                        {user.is_active ? "Active" : "Deactivated"}
                      </span>
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <button
                        type="button"
                        disabled={isSelf}
                        onClick={() => toggleActive(user)}
                        className="h-8 rounded-control border border-control px-2.5 text-[12px] font-medium text-ink transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
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

        <p className="border-t border-rule px-4 py-2.5 text-[12px] text-muted">
          Deactivated accounts keep their records but cannot sign in, read or write data.
        </p>
      </Card>
      </div>

      <Card className="p-4">
        <h2 className="text-[14px] font-semibold text-ink">What each role can do</h2>
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
          {[
            {
              role: "Field worker",
              lines: "Capture records in the app. Can delete their own record while it is still pending.",
            },
            {
              role: "Supervisor",
              lines: "Everything a field worker can do, plus approve or reject any record with a comment.",
            },
            {
              role: "Administrator",
              lines: "Everything above, plus zones, accounts, and deleting any record from the site history.",
            },
          ].map((item) => (
            <div key={item.role}>
              <dt className="text-[13px] font-medium text-ink">{item.role}</dt>
              <dd className="mt-0.5 text-[12px] leading-relaxed text-muted">{item.lines}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-[12px] font-medium text-muted">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}
