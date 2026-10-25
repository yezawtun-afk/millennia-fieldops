"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { textareaClass } from "@/components/ui";
import { useI18n } from "@/i18n";

export function ReviewPanel({
  recordId,
  onDecided,
}: {
  recordId: string;
  /** Called after the database accepts the decision, before the page refreshes. */
  onDecided?: () => void;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(status: "approved" | "rejected") {
    if (status === "rejected" && !feedback.trim()) {
      setError(t("Please add a short reason before rejecting."));
      return;
    }
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error: updateError } = await supabase
      .from("records")
      .update({
        status,
        supervisor_feedback: feedback.trim() || null,
        reviewed_by: user?.id ?? null,
      })
      .eq("id", recordId);

    if (updateError) {
      setError(updateError.message);
      setBusy(false);
      return;
    }

    router.refresh();
    onDecided?.();
  }

  return (
    <div>
      {error ? (
        <p className="mb-3 rounded-control border border-negative/25 bg-negative-soft px-3 py-2 text-[12px] text-negative-ink">
          {error}
        </p>
      ) : null}

      <label className="block text-[12px] font-medium text-muted">
        {t("Comment (required to reject)")}
        <textarea
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          rows={4}
          placeholder={t("Notes for the field worker")}
          className={`${textareaClass} mt-1`}
        />
      </label>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => decide("approved")}
          disabled={busy}
          className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-control bg-accent px-3 text-[13px] font-medium text-white transition-colors hover:bg-primary disabled:opacity-60"
        >
          <Check className="h-4 w-4" strokeWidth={2} /> {t("Approve")}
        </button>
        <button
          type="button"
          onClick={() => decide("rejected")}
          disabled={busy}
          className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-control border border-control bg-sheet px-3 text-[13px] font-medium text-negative-ink transition-colors hover:border-negative/40 hover:bg-negative-soft disabled:opacity-60"
        >
          <X className="h-4 w-4" strokeWidth={2} /> {t("Reject")}
        </button>
      </div>
    </div>
  );
}
