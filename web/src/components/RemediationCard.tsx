"use client";

// The repair loop, in one card.
//
// A supervisor assigns the work, the worker fixes it in the mobile app, then a
// supervisor compares the before and after photos and either closes the job or
// sends it back. The database functions enforce every rule (assign_remediation,
// verify_close, reopen_remediation), so this component only presents them and
// never decides who may do what.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, RotateCcw, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BeforeAfter } from "@/components/BeforeAfter";
import { btnGhost, btnPrimary, btnSecondary, selectClass, textareaClass } from "@/components/ui";
import { useI18n } from "@/i18n";
import {
  PRIORITY_LABELS,
  PRIORITY_STYLES,
  daysUntilDue,
  formatDateTime,
  formatDueDate,
  isOverdue,
  workStage,
} from "@/lib/format";
import type { FieldRecord, Profile, RemediationPriority } from "@/lib/types";

// A failed attempt that a supervisor sent back. The photos were signed on the
// server before the page was rendered.
export interface AttemptView {
  reason: string | null;
  note: string | null;
  completedAt: string | null;
  completedBy: string | null;
  photos: string[];
}

function defaultPriority(record: FieldRecord): RemediationPriority {
  if (record.priority) return record.priority;
  if (record.severity === "critical") return "high";
  if (record.severity === "medium") return "medium";
  return "low";
}

export function RemediationCard({
  record,
  workers,
  before,
  after,
  attempts,
  isReviewer,
}: {
  record: FieldRecord;
  workers: Pick<Profile, "id" | "full_name">[];
  before: string[];
  after: string[];
  attempts: AttemptView[];
  isReviewer: boolean;
}) {
  const router = useRouter();
  const { t } = useI18n();

  const stage = workStage(record);

  const [editing, setEditing] = useState(stage === "unassigned");
  const [workerId, setWorkerId] = useState(record.assigned_to ?? "");
  const [priority, setPriority] = useState<RemediationPriority>(defaultPriority(record));
  const [dueOn, setDueOn] = useState(record.due_on ?? "");
  const [closeNote, setCloseNote] = useState("");
  const [sendBackOpen, setSendBackOpen] = useState(false);
  const [sendBackReason, setSendBackReason] = useState("");
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (stage === "none") return null;

  async function run(
    fn: "assign_remediation" | "verify_close" | "reopen_remediation",
    args: Record<string, string | null>
  ): Promise<boolean> {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc(fn, args);
    setBusy(false);

    if (rpcError) {
      setError(rpcError.message);
      return false;
    }
    router.refresh();
    return true;
  }

  async function saveAssignment(event: React.FormEvent) {
    event.preventDefault();
    if (!workerId) {
      setError(t("Choose a field worker first."));
      return;
    }
    if (priority === "high" && !dueOn) {
      setError(t("High priority work needs a due date."));
      return;
    }

    const ok = await run("assign_remediation", {
      p_record_id: record.id,
      p_assignee: workerId,
      p_priority: priority,
      p_due_on: dueOn || null,
    });
    if (ok) setEditing(false);
  }

  async function closeJob() {
    await run("verify_close", { p_record_id: record.id, p_note: closeNote.trim() || null });
  }

  async function sendBack() {
    if (!sendBackReason.trim()) {
      setError(t("Say what still needs fixing."));
      return;
    }
    const ok = await run("reopen_remediation", {
      p_record_id: record.id,
      p_reason: sendBackReason.trim(),
    });
    if (ok) {
      setSendBackOpen(false);
      setSendBackReason("");
    }
  }

  async function reopen() {
    if (!reopenReason.trim()) {
      setError(t("Say what still needs fixing."));
      return;
    }
    const ok = await run("reopen_remediation", {
      p_record_id: record.id,
      p_reason: reopenReason.trim(),
    });
    if (ok) {
      setReopenOpen(false);
      setReopenReason("");
    }
  }

  const days = daysUntilDue(record.due_on);
  const overdue = isOverdue(record);
  const workerOptions = [...workers];
  // A worker who has been deactivated still holds past work; keep him in the
  // list so the select shows the truth instead of silently going blank.
  if (record.assigned_to && !workerOptions.some((worker) => worker.id === record.assigned_to)) {
    workerOptions.push({
      id: record.assigned_to,
      full_name: record.assignee?.full_name ?? t("Former worker"),
    });
  }

  function dueText(): string | null {
    if (!record.due_on) return null;
    if (days === null) return null;
    if (overdue) return t("{count}d overdue", { count: Math.abs(days) });
    if (days === 0) return t("Due today");
    if (days === 1) return t("Due tomorrow");
    return t("Due {date}", { date: formatDueDate(record.due_on) });
  }

  return (
    <div className="space-y-4 text-[13px]">
      {error ? (
        <p className="rounded-control border border-negative/25 bg-negative-soft px-3 py-2 text-[12px] text-negative-ink">
          {error}
        </p>
      ) : null}

      {/* ---- Who has the job ------------------------------------------------ */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {stage === "unassigned" ? (
          <span className="text-muted">{t("Nobody has been assigned yet.")}</span>
        ) : null}

        {stage === "assigned" || stage === "verify" ? (
          <span className="text-ink">
            {t("Assigned to {name}", {
              name: record.assignee?.full_name ?? t("a field worker"),
            })}
          </span>
        ) : null}

        {record.priority && stage !== "closed" ? (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              PRIORITY_STYLES[record.priority]
            }`}
          >
            {t(PRIORITY_LABELS[record.priority])}
          </span>
        ) : null}

        {dueText() && stage !== "closed" ? (
          <span className={overdue ? "num text-[12px] font-medium text-negative-ink" : "num text-[12px] text-muted"}>
            {dueText()}
          </span>
        ) : null}
      </div>

      {/* ---- The assignment form -------------------------------------------- */}
      {isReviewer && (stage === "unassigned" || stage === "assigned") ? (
        editing ? (
          <form onSubmit={saveAssignment} className="rounded-control border border-rule bg-panel p-3">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <label className="block sm:col-span-3">
                <span className="mb-1 block text-[11px] font-medium text-muted">
                  {t("Field worker")}
                </span>
                <select
                  value={workerId}
                  onChange={(event) => setWorkerId(event.target.value)}
                  className={selectClass}
                  disabled={workers.length === 0}
                >
                  <option value="">{t("Choose a worker")}</option>
                  {workerOptions.map((worker) => (
                    <option key={worker.id} value={worker.id}>
                      {worker.full_name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-muted">
                  {t("Priority")}
                </span>
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as RemediationPriority)}
                  className={selectClass}
                >
                  <option value="low">{t("Low priority")}</option>
                  <option value="medium">{t("Medium priority")}</option>
                  <option value="high">{t("High priority")}</option>
                </select>
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-1 block text-[11px] font-medium text-muted">
                  {t("Due date")}
                </span>
                <input
                  type="date"
                  value={dueOn}
                  onChange={(event) => setDueOn(event.target.value)}
                  className="h-9 w-full rounded-control border border-control bg-sheet px-2.5 text-[13px] text-ink focus:border-accent focus:outline-none"
                />
              </label>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button type="submit" disabled={busy || workers.length === 0} className={btnPrimary}>
                {stage === "unassigned" ? (
                  <>
                    <UserPlus className="h-4 w-4" strokeWidth={1.8} />
                    {busy ? t("Assigning...") : t("Assign remediation")}
                  </>
                ) : (
                  <>{busy ? t("Saving...") : t("Update assignment")}</>
                )}
              </button>
              {stage === "assigned" ? (
                <button type="button" onClick={() => setEditing(false)} className={btnGhost}>
                  {t("Cancel")}
                </button>
              ) : null}
            </div>

            {workers.length === 0 ? (
              <p className="mt-2 text-[12px] text-muted">
                {t("There are no active field workers to assign yet.")}
              </p>
            ) : null}
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setEditing(true)} className={btnSecondary}>
              <UserPlus className="h-4 w-4" strokeWidth={1.8} />
              {t("Change assignment")}
            </button>
            <span className="text-[12px] text-muted">
              {t("Waiting for the worker to fix this.")}
            </span>
          </div>
        )
      ) : null}

      {/* ---- After the fix: compare, then decide ---------------------------- */}
      {stage === "verify" || stage === "closed" ? (
        <>
          <BeforeAfter before={before} after={after} />

          {stage === "verify" ? (
            <p className="text-muted">
              {t("Fixed by {name} on {date}.", {
                name: record.completer?.full_name ?? t("a field worker"),
                date: record.completed_at ? formatDateTime(record.completed_at) : "-",
              })}{" "}
              {isReviewer
                ? t("Check the after photo, then close the job.")
                : t("Waiting for a supervisor to verify the fix.")}
            </p>
          ) : (
            <p className="text-muted">
              {t("Closed by {name} on {date}.", {
                name: record.closer?.full_name ?? t("a supervisor"),
                date: record.closed_at ? formatDateTime(record.closed_at) : "-",
              })}
            </p>
          )}

          {record.completion_note ? (
            <p className="whitespace-pre-wrap rounded-control border border-rule bg-panel px-3 py-2 text-ink">
              {record.completion_note}
            </p>
          ) : null}

          {record.close_note ? (
            <p className="whitespace-pre-wrap rounded-control border border-rule bg-panel px-3 py-2 text-ink">
              {record.close_note}
            </p>
          ) : null}
        </>
      ) : null}

      {stage === "closed" && isReviewer ? (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setReopenOpen((open) => !open)} className={btnGhost}>
            <RotateCcw className="h-4 w-4" strokeWidth={1.8} />
            {t("Reopen job")}
          </button>
        </div>
      ) : null}

      {stage === "closed" && reopenOpen ? (
        <div className="rounded-control border border-rule bg-panel p-3">
          <label className="block text-[11px] font-medium text-muted">
            {t("Why is this job being reopened?")}
            <textarea
              value={reopenReason}
              onChange={(event) => setReopenReason(event.target.value)}
              rows={3}
              className={`${textareaClass} mt-1`}
              placeholder={t("The hazard came back, or the fix did not hold.")}
            />
          </label>
          <div className="mt-2 flex items-center gap-2">
            <button type="button" onClick={reopen} disabled={busy} className={btnSecondary}>
              {busy ? t("Saving...") : t("Reopen")}
            </button>
            <button type="button" onClick={() => setReopenOpen(false)} className={btnGhost}>
              {t("Cancel")}
            </button>
          </div>
        </div>
      ) : null}

      {stage === "verify" && isReviewer ? (
        <div className="space-y-2">
          <textarea
            value={closeNote}
            onChange={(event) => setCloseNote(event.target.value)}
            rows={2}
            className={textareaClass}
            placeholder={t("Close note (optional)")}
            aria-label={t("Close note (optional)")}
          />

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={closeJob} disabled={busy} className={btnPrimary}>
              <Check className="h-4 w-4" strokeWidth={2} />
              {busy ? t("Saving...") : t("Verify & close")}
            </button>
            <button
              type="button"
              onClick={() => setSendBackOpen((open) => !open)}
              className={btnSecondary}
            >
              {t("Send back")}
            </button>
          </div>

          {sendBackOpen ? (
            <div className="rounded-control border border-rule bg-panel p-3">
              <label className="block text-[11px] font-medium text-muted">
                {t("What still needs fixing?")}
                <textarea
                  value={sendBackReason}
                  onChange={(event) => setSendBackReason(event.target.value)}
                  rows={3}
                  className={`${textareaClass} mt-1`}
                  placeholder={t("For example: the drain is clear but the bank is still washing out.")}
                />
              </label>
              <div className="mt-2 flex items-center gap-2">
                <button type="button" onClick={sendBack} disabled={busy} className={btnSecondary}>
                  {busy ? t("Saving...") : t("Send back for rework")}
                </button>
                <button type="button" onClick={() => setSendBackOpen(false)} className={btnGhost}>
                  {t("Cancel")}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {stage === "assigned" || stage === "unassigned" ? (
        record.reopened_at && record.reopen_reason ? (
          <p className="rounded-control border border-warning/30 bg-warning-soft px-3 py-2 text-[12px] text-warning-ink">
            {t("Sent back: {reason}", { reason: record.reopen_reason })}
          </p>
        ) : null
      ) : null}

      {/* ---- Attempts that were sent back ----------------------------------- */}
      {attempts.length > 0 ? (
        <details className="rounded-control border border-rule bg-panel px-3 py-2">
          <summary className="cursor-pointer text-[12px] font-medium text-muted">
            {t("Earlier attempts ({count})", { count: attempts.length })}
          </summary>
          <ul className="mt-2 space-y-3">
            {attempts.map((attempt, index) => (
              <li key={`${attempt.completedAt ?? "attempt"}-${index}`} className="text-[12px] text-muted">
                <p className="text-ink">
                  {attempt.completedBy ?? t("A field worker")}
                  {attempt.completedAt ? ` · ${formatDateTime(attempt.completedAt)}` : null}
                </p>
                {attempt.reason ? (
                  <p className="mt-0.5">{t("Sent back: {reason}", { reason: attempt.reason })}</p>
                ) : null}
                {attempt.note ? <p className="mt-0.5">{attempt.note}</p> : null}
                {attempt.photos.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {attempt.photos.map((url, photoIndex) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        title={t("Open photo in a new tab")}
                        className="block overflow-hidden rounded-[4px] border border-line"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={t("After photo {number}", { number: photoIndex + 1 })}
                          className="h-16 w-16 object-cover"
                        />
                      </a>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
