"use client";

import { Eye, EyeOff } from "lucide-react";
import { useI18n } from "@/i18n";

// The eye that shows or hides a password. `type="button"` keeps it from
// submitting the form it sits inside; the label is read out by screen readers
// and shown as the hover title.
export function PasswordEye({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  const { t } = useI18n();
  const label = visible ? t("Hide password") : t("Show password");

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={visible}
      title={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-control text-muted transition-colors hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      {visible ? (
        <EyeOff className="h-4 w-4" strokeWidth={1.8} />
      ) : (
        <Eye className="h-4 w-4" strokeWidth={1.8} />
      )}
    </button>
  );
}
