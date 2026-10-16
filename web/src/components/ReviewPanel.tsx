"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function ReviewPanel({ recordId }: { recordId: string }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(status: "approved" | "rejected") {
    if (status === "rejected" && !feedback.trim()) {
      setError("Please add a short reason before rejecting.");
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
  }

  return (
    <div>
      {error ? (
        <p className="mb-3 rounded-md border border-rejected/30 bg-rejected-soft px-3 py-2 text-sm text-rejected">
          {error}
        </p>
      ) : null}

      <label className="block text-sm font-medium text-ink">
        Comment (optional when approving)
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={4}
          placeholder="Notes for the field worker..."
          className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </label>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => decide("approved")}
          disabled={busy}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-approved px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          <Check className="h-4 w-4" /> Approve
        </button>
        <button
          type="button"
          onClick={() => decide("rejected")}
          disabled={busy}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-rejected px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          <X className="h-4 w-4" /> Reject
        </button>
      </div>
    </div>
  );
}
