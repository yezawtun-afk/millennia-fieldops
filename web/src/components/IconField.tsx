"use client";

import type { ComponentType, InputHTMLAttributes, ReactNode } from "react";

// A text input with a small icon inside, used on the sign-in page.
export function IconField({
  icon: Icon,
  label,
  hint,
  right,
  ...inputProps
}: {
  icon?: ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  right?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-medium text-ink">{label}</span>
        {right}
      </span>
      <span className="relative block">
        {Icon ? (
          <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        ) : null}
        <input
          {...inputProps}
          className={`w-full rounded-md border border-line bg-white py-2.5 ${
            Icon ? "pl-9" : "pl-3"
          } pr-3 text-sm text-ink outline-none placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/20`}
        />
      </span>
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

// Green full-width button used as the main action on forms.
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
      className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-60"
    >
      {busy ? "Please wait..." : children}
    </button>
  );
}
