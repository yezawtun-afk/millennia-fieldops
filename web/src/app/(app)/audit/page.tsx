import { redirect } from "next/navigation";
import { getProfile } from "@/lib/supabase/server";
import { getAuditLogs } from "@/lib/data";
import { AUDIT_ACTIONS, auditActionLabel, auditTone } from "@/lib/audit";
import { EmptyState, PageHeader, tdClass, thClass } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { getT } from "@/i18n/server";

type SearchParams = Promise<{ action?: string }>;

const TONE_STYLES: Record<ReturnType<typeof auditTone>, string> = {
  ok: "bg-positive-soft text-positive-ink",
  warn: "bg-warning-soft text-warning-ink",
  danger: "bg-negative-soft text-negative-ink",
  info: "bg-accent-soft text-accent",
};

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getT();
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") {
    return (
      <div>
        <PageHeader title={t("Activity log")} />
        <p className="text-sm text-muted">{t("Only administrators can read the activity log.")}</p>
      </div>
    );
  }

  const params = await searchParams;
  const action = params.action ?? "";
  const { rows, missingTable } = await getAuditLogs({ action: action || undefined });

  return (
    <div>
      <PageHeader
        title={t("Activity log")}
        subtitle={t(
          "An append-only history of field records and account changes. Newest first, last 200 entries."
        )}
      />

      {missingTable ? (
        <div className="rounded-card border border-warning-soft bg-warning-soft/40 p-4 text-[13px] text-warning-ink">
          <p className="font-medium">{t("The activity log is not set up yet.")}</p>
          <p className="mt-1">
            {t("Run")}{" "}
            <code className="rounded bg-sheet px-1 py-0.5">supabase/10_audit_logs.sql</code>{" "}
            {t("in the Supabase SQL editor, then reload this page.")}
          </p>
        </div>
      ) : (
        <>
          <form method="get" className="mb-3 flex flex-wrap items-center gap-2">
            <label htmlFor="action" className="text-[13px] text-muted">
              {t("Show")}
            </label>
            <select
              id="action"
              name="action"
              defaultValue={action}
              className="h-9 rounded-control border border-control bg-sheet px-2.5 text-[13px] text-ink focus:border-accent focus:outline-none"
            >
              <option value="">{t("All activity")}</option>
              {AUDIT_ACTIONS.map((value) => (
                <option key={value} value={value}>
                  {t(auditActionLabel(value))}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="h-9 rounded-control border border-control bg-sheet px-3 text-[13px] font-medium text-ink hover:border-accent hover:text-accent"
            >
              {t("Apply")}
            </button>
            {action ? (
              <a href="/audit" className="text-[13px] text-muted underline hover:text-ink">
                {t("Clear")}
              </a>
            ) : null}
          </form>

          {rows.length === 0 ? (
            <EmptyState
              title={t("Nothing recorded yet")}
              hint={t(
                "Submit a record from the mobile app or change an account, and it will appear here."
              )}
            />
          ) : (
            <div className="overflow-x-auto rounded-card border border-line">
              <table className="w-full border-collapse">
                <thead className="border-b border-rule bg-panel/60">
                  <tr>
                    <th className={thClass}>{t("When")}</th>
                    <th className={thClass}>{t("Who")}</th>
                    <th className={thClass}>{t("Activity")}</th>
                    <th className={thClass}>{t("Details")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const tone = auditTone(row.action);
                    return (
                      <tr key={row.id} className="border-b border-rule last:border-0">
                        <td className={`${tdClass} whitespace-nowrap text-[13px] text-muted`}>
                          {formatDateTime(row.created_at)}
                        </td>
                        <td className={`${tdClass} whitespace-nowrap`}>{row.actor_name}</td>
                        <td className={tdClass}>
                          <span
                            className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium leading-5 ${TONE_STYLES[tone]}`}
                          >
                            {t(auditActionLabel(row.action))}
                          </span>
                        </td>
                        <td className={`${tdClass} text-[13px] text-muted`}>{row.summary}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
