"use client";

import type { ComponentType, InputHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

// A text input with a small icon inside, used on the sign-in page.
export function IconField({
  icon: Icon,
  label,
  hint,
  right,
  trailing,
  ...inputProps
}: {
  icon?: ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  right?: ReactNode;
  /** A control drawn inside the right edge of the input, such as an eye. */
  trailing?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between">
        <span className="text-[12px] font-medium text-muted">{label}</span>
        {right}
      </span>
      <span className="relative block">
        {Icon ? (
          <Icon
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
          />
        ) : null}
        <input
          {...inputProps}
          className={`h-10 w-full rounded-control border border-control bg-sheet ${
            Icon ? "pl-9" : "pl-3"
          } ${trailing ? "pr-11" : "pr-3"} text-[14px] text-ink placeholder:text-faint focus:border-accent focus:outline-none`}
        />
        {trailing ? (
          <span className="absolute right-1 top-1/2 -translate-y-1/2">{trailing}</span>
        ) : null}
      </span>
      {hint ? <span className="mt-1 block text-[12px] text-muted">{hint}</span> : null}
    </label>
  );
}

// The one filled action on a form.
export function PrimaryButton({
  children,
  busy,
  ...props
}: {
  children: ReactNode;
  busy?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      disabled={busy || props.disabled}
      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-control bg-primary px-4 text-[14px] font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {busy ? "Signing in" : children}
    </button>
  );
}
