import type { ComponentType, ReactNode } from "react";

// Sign-in sits on the same tinted frame as the app: the statement lives on the
// frame, the form lives on one white sheet.
export function AuthShell({ children }: { children: ReactNode; icon?: ComponentType<{ className?: string }> }) {
  return (
    <div className="flex min-h-screen flex-col bg-frame">
      <header className="flex h-14 items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-accent-soft text-accent">
            <Leaf className="h-4 w-4" />
          </span>
          <span className="text-[13px] font-medium text-ink">Millennia FieldOps</span>
        </div>
        <span className="hidden text-[12px] text-muted sm:block">Millennia Village · site monitoring</span>
      </header>

      <div className="flex flex-1 flex-col gap-8 lg:flex-row lg:gap-6">
        {/* The frame carries the one statement and says what happens after the
            form, so the space beside the sheet has a job. */}
        <section className="hidden max-w-[460px] flex-col px-8 pb-10 pt-4 lg:flex">
          <p className="text-[12px] font-medium text-muted">Field data review</p>
          <h2 className="mt-2 text-[30px] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">
            Field observations, reviewed on site.
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed text-muted">
            Flora surveys, soil and water readings, and hazard reports are captured on the phone,
            offline when there is no signal, and land here for a supervisor's decision.
          </p>

          <ol className="mt-9 space-y-5 border-t border-line pt-5">
            <Step n="01" title="Capture on site">
              Photos, GPS and the reading are taken in the app.
            </Step>
            <Step n="02" title="Sync when connected">
              Everything is queued on the phone and uploads itself.
            </Step>
            <Step n="03" title="A reviewer decides">
              Records are approved, or sent back with a comment.
            </Step>
          </ol>
        </section>

        <main className="flex flex-1 items-center justify-center px-3 pb-4 lg:pb-8">
          <div className="w-full max-w-[400px] rounded-[16px] border border-line bg-sheet p-6 sm:p-7">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 font-mono text-[11px] text-faint">{n}</span>
      <span>
        <span className="block text-[14px] font-medium text-ink">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-relaxed text-muted">{children}</span>
      </span>
    </li>
  );
}

// The form block. The sheet behind it is the card, so this adds no second box.
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
    <div>
      <h1 className="text-[22px] font-semibold leading-7 tracking-[-0.01em] text-ink">{title}</h1>
      <p className="mt-1 text-[13px] text-muted">{subtitle}</p>
      <div className="mt-6">{children}</div>
      {footer ? (
        <div className="mt-6 border-t border-rule pt-4 text-[12px] text-muted">{footer}</div>
      ) : null}
    </div>
  );
}

// The leaf mark drawn from the place the product monitors.
function Leaf({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <path d="M20 4c-8 0-14 3-14 9a6 6 0 0 0 6 6c6 0 8-7 8-15Z" strokeLinecap="round" />
      <path d="M6 20c2-5 6-9 11-12" strokeLinecap="round" />
    </svg>
  );
}
