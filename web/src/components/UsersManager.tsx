"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2, UserPlus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { visibleEmail } from "@/lib/phone";
import { Card, btnPrimary, inputClass, selectClass, tdClass, thClass } from "@/components/ui";
import { createUser, deleteUser } from "@/app/(app)/users/actions";
import { useI18n } from "@/i18n";
import type { AccountStatus, Profile, UserRole } from "@/lib/types";

const ROLES: UserRole[] = ["field_worker", "supervisor", "admin"];

const ROLE_LABELS: Record<UserRole, string> = {
  field_worker: "Field worker",
  supervisor: "Supervisor",
  admin: "Administrator",
};

// A missing status means the database has not been upgraded yet; those
// accounts behave exactly as before (approved).
function accountStatus(user: Profile): AccountStatus {
  return user.status ?? "approved";
}

export function UsersManager({
  initialUsers,
  currentUserId,
}: {
  initialUsers: Profile[];
  currentUserId: string;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    role: "field_worker" as UserRole,
  });
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const requests = initialUsers.filter((user) => accountStatus(user) === "pending");
  // If no row carries a status, the column does not exist yet: the requests
  // panel would silently do nothing, so say what to run instead.
  const approvalReady = initialUsers.some(
    (user) => user.status !== undefined && user.status !== null
  );

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

  // Approve or decline a request. The row stays either way, so there is a
  // record of who asked and who decided.
  async function decide(user: Profile, status: "approved" | "declined") {
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        status,
        decided_by: currentUserId,
        decided_at: new Date().toISOString(),
        decision_note: status === "declined" ? "Declined from the accounts page." : null,
        is_active: status === "approved" ? true : user.is_active,
      })
      .eq("id", user.id);

    if (error) return setMessage({ kind: "error", text: error.message });
    setMessage({
      kind: "ok",
      text:
        status === "approved"
          ? t("{name} can now sign in.", { name: user.full_name })
          : t("{name} was declined and cannot sign in.", { name: user.full_name }),
    });
    startTransition(() => router.refresh());
  }

  function remove(user: Profile) {
    const confirmed = window.confirm(
      `${t("Delete {name} ({email}) permanently?", {
        name: user.full_name,
        email: user.email,
      })}\n\n` +
        t(
          "Their account is removed and they cannot sign in again. Accounts that already submitted field records can only be deactivated."
        )
    );
    if (!confirmed) return;

    setMessage(null);
    startTransition(async () => {
      const result = await deleteUser(user.id);
      if (result.ok) {
        setMessage({
          kind: "ok",
          text: t("{name}'s account was deleted.", { name: user.full_name }),
        });
        router.refresh();
      } else {
        setMessage({ kind: "error", text: result.error });
      }
    });
  }

  function invite(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await createUser(form);
      if (result.ok) {
        setMessage({ kind: "ok", text: t("Account created for {phone}.", { phone: form.phone }) });
        setForm({ full_name: "", email: "", phone: "", password: "", role: "field_worker" });
        router.refresh();
      } else {
        setMessage({ kind: "error", text: result.error });
      }
    });
  }

  return (
    <div className="space-y-4">
      {message ? (
        <p
          className={`rounded-control px-3 py-2 text-[12px] ${
            message.kind === "ok"
              ? "bg-positive-soft text-positive-ink"
              : "bg-negative-soft text-negative-ink"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      {!approvalReady ? (
        <Card className="border-warning/40 bg-warning-soft p-4">
          <h2 className="text-[14px] font-semibold text-warning-ink">
            {t("Account approval is not switched on yet")}
          </h2>
          <p className="mt-1 text-[12px] leading-relaxed text-warning-ink">
            {t(
              "The database is missing the phone and status columns, so requests cannot be reviewed and phone sign-in does not work. In Supabase, open SQL Editor and run these files from supabase/ one at a time: 01_schema.sql, 02_policies.sql, 04_triggers.sql, 09_delete_own_pending.sql. Then reload this page."
            )}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden border-warning/30">
          <div className="flex items-center justify-between border-b border-rule px-4 py-3">
            <div>
              <h2 className="text-[14px] font-semibold text-ink">
                {t("Requests waiting for review")}
              </h2>
              <p className="mt-0.5 text-[12px] text-muted">
                {t(
                  "People who asked for an account in the app. They cannot sign in until you approve them."
                )}
              </p>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                requests.length > 0
                  ? "bg-warning-soft text-warning-ink"
                  : "bg-panel text-muted"
              }`}
            >
              {requests.length > 0
                ? t("{count} waiting", { count: requests.length })
                : t("None waiting")}
            </span>
          </div>

          {requests.length === 0 ? (
            <p className="px-4 py-4 text-[12px] text-muted">
              {t(
                "No requests right now. When someone taps Request an account in the app, they appear here for you to approve or decline."
              )}
            </p>
          ) : (
            <ul>
              {requests.map((user) => (
                <li
                  key={user.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-4 py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-ink">{user.full_name}</p>
                    <p className="text-[12px] text-muted">
                      {user.phone ?? t("No phone number")}
                      {visibleEmail(user.email) ? ` · ${visibleEmail(user.email)}` : ""}
                    </p>
                    <p className="text-[11px] text-faint">
                      {t("Asked {date}", {
                        date: new Date(
                          user.requested_at ?? user.created_at
                        ).toLocaleDateString(),
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => decide(user, "approved")}
                      className="inline-flex h-8 items-center gap-1.5 rounded-control bg-primary px-2.5 text-[12px] font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={2} />
                      {t("Approve")}
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => decide(user, "declined")}
                      className="inline-flex h-8 items-center gap-1.5 rounded-control border border-control px-2.5 text-[12px] font-medium text-ink transition-colors hover:border-negative hover:text-negative disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={2} />
                      {t("Decline")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="h-fit p-4">
          <h2 className="text-[14px] font-semibold text-ink">{t("Create an account")}</h2>
          <p className="mt-0.5 text-[12px] text-muted">
            {t(
              "Accounts you create here are approved straight away. The phone number is how they sign in; an email address is optional. Share the temporary password with the person."
            )}
          </p>

          <form onSubmit={invite} className="mt-3 space-y-3">
            <Field label={t("Full name")}>
              <input
                value={form.full_name}
                onChange={(event) => setForm({ ...form, full_name: event.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label={t("Phone number")}>
              <input
                type="tel"
                required
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                placeholder="012-345 6789"
                className={inputClass}
              />
            </Field>
            <Field label={t("Email (optional)")}>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label={t("Temporary password")}>
              <input
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label={t("Role")}>
              <select
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value as UserRole })}
                className={selectClass}
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {t(ROLE_LABELS[role])}
                  </option>
                ))}
              </select>
            </Field>

            <button type="submit" disabled={pending} className={`${btnPrimary} w-full`}>
              <UserPlus className="h-4 w-4" strokeWidth={1.7} />
              {pending ? t("Creating account") : t("Create account")}
            </button>
          </form>
        </Card>

        <Card className="h-fit overflow-hidden">
          <div className="flex items-center justify-between border-b border-rule px-4 py-3">
            <h2 className="text-[14px] font-semibold text-ink">{t("Accounts")}</h2>
            <span className="text-[12px] text-muted">
              {t("{count} people", { count: initialUsers.length })}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-rule">
                  <th className={thClass}>{t("Name")}</th>
                  <th className={thClass}>{t("Role")}</th>
                  <th className={thClass}>{t("Status")}</th>
                  <th className={`${thClass} text-right`}>{t("Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {initialUsers.map((user) => {
                  const isSelf = user.id === currentUserId;
                  const status = accountStatus(user);
                  return (
                    <tr
                      key={user.id}
                      className="border-b border-rule transition-colors last:border-b-0 hover:bg-panel"
                    >
                      <td className={`${tdClass} font-medium`}>
                        {user.full_name}
                        {isSelf ? (
                          <span className="ml-2 text-[12px] font-normal text-muted">{t("you")}</span>
                        ) : null}
                        <span className="mt-0.5 block text-[12px] font-normal text-muted">
                          {user.phone ?? t("No phone")}
                          {visibleEmail(user.email) ? ` · ${visibleEmail(user.email)}` : ""}
                        </span>
                      </td>
                      <td className={tdClass}>
                        <select
                          value={user.role}
                          disabled={isSelf}
                          onChange={(event) => changeRole(user, event.target.value as UserRole)}
                          aria-label={`${t("Role")}: ${user.full_name}`}
                          className="h-8 rounded-control border border-control bg-sheet px-2 text-[12px] text-ink focus:border-accent focus:outline-none disabled:opacity-60"
                        >
                          {ROLES.map((role) => (
                            <option key={role} value={role}>
                              {t(ROLE_LABELS[role])}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className={tdClass}>
                        {status === "pending" ? (
                          <span className="inline-flex items-center rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning-ink">
                            {t("Waiting approval")}
                          </span>
                        ) : status === "declined" ? (
                          <span className="inline-flex items-center rounded-full bg-negative-soft px-2 py-0.5 text-[11px] font-medium text-negative-ink">
                            {t("Declined")}
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              user.is_active
                                ? "bg-positive-soft text-positive-ink"
                                : "bg-negative-soft text-negative-ink"
                            }`}
                          >
                            {user.is_active ? t("Active") : t("Deactivated")}
                          </span>
                        )}
                      </td>
                      <td className={`${tdClass} text-right`}>
                        <div className="inline-flex items-center gap-1.5">
                          {status === "pending" ? (
                            <>
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => decide(user, "approved")}
                                className="h-8 rounded-control border border-control px-2.5 text-[12px] font-medium text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
                              >
                                {t("Approve")}
                              </button>
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => decide(user, "declined")}
                                className="h-8 rounded-control border border-control px-2.5 text-[12px] font-medium text-ink transition-colors hover:border-negative hover:text-negative disabled:opacity-50"
                              >
                                {t("Decline")}
                              </button>
                            </>
                          ) : status === "declined" ? (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => decide(user, "approved")}
                              className="h-8 rounded-control border border-control px-2.5 text-[12px] font-medium text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
                            >
                              {t("Approve")}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isSelf}
                              onClick={() => toggleActive(user)}
                              className="h-8 rounded-control border border-control px-2.5 text-[12px] font-medium text-ink transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {user.is_active ? t("Deactivate") : t("Reactivate")}
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={isSelf || pending}
                            onClick={() => remove(user)}
                            title={
                              isSelf
                                ? t("You cannot delete your own account")
                                : t("Delete this account")
                            }
                            aria-label={t("Delete {name}", { name: user.full_name })}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-control border border-control text-muted transition-colors hover:border-negative hover:text-negative disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="border-t border-rule px-4 py-2.5 text-[12px] text-muted">
            {t(
              "Deactivated accounts keep their records but cannot sign in, read or write data. Deleting is permanent and is refused for anyone who already submitted field records."
            )}
          </p>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="text-[14px] font-semibold text-ink">{t("What each role can do")}</h2>
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
          {[
            {
              role: "Field worker",
              lines:
                "Capture records in the app. Can delete their own record while it is still pending.",
            },
            {
              role: "Supervisor",
              lines:
                "Everything a field worker can do, plus approve or reject any record with a comment.",
            },
            {
              role: "Administrator",
              lines:
                "Everything above, plus zones, accounts, and deleting any record from the site history.",
            },
          ].map((item) => (
            <div key={item.role}>
              <dt className="text-[13px] font-medium text-ink">{t(item.role)}</dt>
              <dd className="mt-0.5 text-[12px] leading-relaxed text-muted">{t(item.lines)}</dd>
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
