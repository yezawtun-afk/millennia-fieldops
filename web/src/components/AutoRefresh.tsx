"use client";

// Keeps the page current without the user pressing refresh - and proves it.
//
// The web app is server-rendered, so the simplest reliable signal is to ask the
// router to fetch the page again in place every ten seconds. That picks up
// anything a field worker sends from the phone: a new record, a new review, a
// deleted record, a new zone. Because only the server-rendered data is refetched,
// open forms, typed text and scroll position survive.
//
// The badge used to read "Live 10s", which asked the reader to take the polling
// on trust. It now counts down, says "Updating" while the fetch is actually in
// flight, and rests on "Updated just now" - so the ten seconds are visible
// rather than asserted.
//
// The poll pauses while the tab is in the background and catches up as soon as
// it comes back, so a forgotten tab costs nothing.
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { useI18n } from "@/i18n";

const POLL_MS = 10_000;
// When the tab comes back we refresh at once, but never twice in a row: a phone
// that fires focus and visibility together should not cause two fetches.
const MIN_GAP_MS = 3_000;
// Long enough to read, short enough that the countdown feels continuous.
const UPDATED_HOLD_MS = 2_000;
// A fast local response would otherwise flash the spinner for one frame; keep
// "Updating" on screen long enough to be seen, without delaying the fetch.
const MIN_SPIN_MS = 500;
// Half a second keeps the digits honest without spinning the main thread.
const TICK_MS = 500;

type Phase = "counting" | "updating" | "updated" | "paused" | "offline";

export function AutoRefresh() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();
  const [phase, setPhase] = useState<Phase>("counting");
  const [seconds, setSeconds] = useState(POLL_MS / 1000);

  // Deadlines rather than decrements: a throttled background timer or a slow
  // render cannot make the countdown drift away from the real next fetch.
  const nextRunRef = useRef(Date.now() + POLL_MS);
  const lastRunRef = useRef(Date.now());
  const holdUntilRef = useRef(0);
  const spinUntilRef = useRef(0);
  const pendingRef = useRef(false);
  const wasPendingRef = useRef(false);

  useEffect(() => {
    pendingRef.current = isPending;
  }, [isPending]);

  const refresh = useCallback(() => {
    const now = Date.now();
    lastRunRef.current = now;
    nextRunRef.current = now + POLL_MS;
    spinUntilRef.current = now + MIN_SPIN_MS;
    startTransition(() => router.refresh());
  }, [router]);

  const tick = useCallback(() => {
    if (document.visibilityState !== "visible") {
      setPhase("paused");
      return;
    }
    if (navigator.onLine === false) {
      setPhase("offline");
      return;
    }
    if (pendingRef.current) {
      setPhase("updating");
      return;
    }

    const now = Date.now();
    // A refresh that returned in 40 ms still says "Updating" for half a second,
    // so the cycle reads as a cycle rather than a flicker.
    if (now < spinUntilRef.current) {
      setPhase("updating");
      return;
    }
    if (now < holdUntilRef.current) {
      setPhase("updated");
      return;
    }
    if (now >= nextRunRef.current) {
      if (now - lastRunRef.current >= MIN_GAP_MS) {
        refresh();
        return;
      }
      // Something refreshed a moment ago; give the full ten seconds from there.
      nextRunRef.current = lastRunRef.current + POLL_MS;
    }

    setPhase("counting");
    setSeconds(Math.max(1, Math.ceil((nextRunRef.current - now) / 1000)));
  }, [refresh]);

  // The fetch finished: hold "Updated just now" before the countdown resumes.
  useEffect(() => {
    if (isPending) {
      wasPendingRef.current = true;
      setPhase("updating");
      return;
    }
    if (wasPendingRef.current) {
      wasPendingRef.current = false;
      holdUntilRef.current = Date.now() + UPDATED_HOLD_MS;
      setPhase(Date.now() < spinUntilRef.current ? "updating" : "updated");
    }
  }, [isPending]);

  // A page change already fetched fresh data, so the clock starts again there.
  useEffect(() => {
    const now = Date.now();
    lastRunRef.current = now;
    nextRunRef.current = now + POLL_MS;
    holdUntilRef.current = 0;
    spinUntilRef.current = 0;
    setPhase("counting");
    setSeconds(POLL_MS / 1000);
  }, [pathname]);

  useEffect(() => {
    tick();
    const timer = window.setInterval(tick, TICK_MS);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("online", tick);
    window.addEventListener("offline", tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("online", tick);
      window.removeEventListener("offline", tick);
    };
  }, [tick]);

  const label =
    phase === "updating"
      ? t("Updating...")
      : phase === "updated"
        ? t("Updated just now")
        : phase === "paused"
          ? t("Paused")
          : phase === "offline"
            ? t("Offline")
            : t("Refreshing in {seconds}s…", { seconds });

  // Paused and offline are states, not progress: the pale green chip would read
  // as "still working", so those two go quiet.
  const active = phase === "counting" || phase === "updating" || phase === "updated";

  return (
    <span
      className={`hidden min-w-[148px] shrink-0 items-center justify-center gap-1.5 rounded-full border py-1 pl-2 pr-2.5 md:inline-flex ${
        active ? "border-accent/25 bg-accent-soft" : "border-line bg-sheet"
      }`}
      title={t("This page updates on its own")}
    >
      <span className="relative flex h-1.5 w-1.5 items-center justify-center" aria-hidden="true">
        {phase === "updating" ? (
          <span className="absolute h-1.5 w-1.5 rounded-full bg-accent/50 motion-safe:animate-ping" />
        ) : null}
        <span
          className={`relative h-1.5 w-1.5 rounded-full ${
            active ? "bg-accent" : phase === "offline" ? "bg-negative/60" : "bg-faint/60"
          }`}
        />
      </span>

      {/* The digits change every second: hidden from assistive tech so a screen
          reader is not interrupted ten times a minute. The purpose is exposed
          once, in the sr-only sentence below. */}
      <span
        className={`whitespace-nowrap text-[11px] font-medium leading-none ${active ? "text-accent" : "text-muted"}`}
        aria-hidden="true"
      >
        {label}
      </span>
      <span className="sr-only">{t("This page updates on its own")}</span>

      <RefreshCw
        className={`h-3 w-3 shrink-0 ${active ? "text-accent" : "text-muted"} ${
          phase === "updating" ? "motion-safe:animate-spin" : ""
        }`}
        aria-hidden="true"
      />
    </span>
  );
}
