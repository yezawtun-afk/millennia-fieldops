import type { ComponentType, ReactNode } from "react";

// Sign-in pages share this calm green background and card.
// `icon` is a lucide icon component shown in the rounded green tile.
export function AuthShell({
  children,
  icon: Icon,
}: {
  children: ReactNode;
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-forest px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-lg">
            {Icon ? <Icon className="h-7 w-7" /> : <Leaf className="h-7 w-7" />}
          </div>
          <p className="mt-3 text-sm font-semibold tracking-wide text-white/80">Millennia FieldOps</p>
        </div>
        {children}
      </div>
    </div>
  );
}

// The white rounded card all sign-in screens use.
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white p-5 shadow-2xl sm:p-6">
      <h1 className="text-xl font-bold text-ink">{title}</h1>
      <p className="mt-1 text-sm text-muted">{subtitle}</p>
      <div className="mt-5">{children}</div>
      {footer ? (
        <div className="mt-5 border-t border-line pt-4 text-center text-sm text-muted">{footer}</div>
      ) : null}
    </div>
  );
}

// The small leaf mark used by the brand.
function Leaf({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M20 4c-8 0-14 3-14 9a6 6 0 0 0 6 6c6 0 8-7 8-15Z" strokeLinecap="round" />
      <path d="M6 20c2-5 6-9 11-12" strokeLinecap="round" />
    </svg>
  );
}
