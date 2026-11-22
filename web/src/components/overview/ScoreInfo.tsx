// The long explanation of the health score, folded away behind one [?].
//
// The paragraph it replaces was accurate but read as legal fine print under a
// table, so it never got read. A native <details> means hover, keyboard focus
// and a phone tap all open it, and the dashboard still ships no JavaScript for
// it. The sentence itself is passed in already translated, so the thresholds
// stay in one place (lib/health.ts) instead of being retyped here.
import { Info } from "lucide-react";

export function ScoreInfo({ label, body }: { label: string; body: string }) {
  return (
    <details className="group relative">
      <summary
        className="flex h-6 w-6 cursor-pointer list-none items-center justify-center rounded-full border border-line text-faint transition-colors hover:border-control hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden"
        aria-label={label}
        title={label}
      >
        <Info className="h-3.5 w-3.5" strokeWidth={1.8} />
      </summary>

      <div
        role="note"
        className="absolute right-0 top-8 z-20 hidden w-[min(300px,calc(100vw-2rem))] rounded-card border border-line bg-sheet px-3.5 py-3 text-[12px] leading-relaxed text-muted group-open:block group-hover:block group-focus-within:block"
      >
        {body}
      </div>
    </details>
  );
}
