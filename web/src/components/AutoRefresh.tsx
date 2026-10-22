"use client";

// Keeps the page current without the user pressing refresh.
//
// The web app is server-rendered, so the simplest reliable signal is to ask the
// router to fetch the page again in place every few seconds. That picks up
// anything a field worker sends from the phone: a new record, a new review, a
// deleted record, a new zone. Because only the server-rendered data is refetched,
// open forms, typed text and scroll position survive.
//
// The poll pauses while the tab is in the background and catches up as soon as
// it comes back, so a forgotten tab costs nothing.
import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/i18n";

const POLL_MS = 10_000;
// When the tab comes back we refresh at once, but never twice in a row: a phone
// that fires focus and visibility together should not cause two fetches.
const MIN_GAP_MS = 3_000;

export function AutoRefresh() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const lastRun = useRef(Date.now());

  // A page change already fetched fresh data, so the clock starts again there.
  useEffect(() => {
    lastRun.current = Date.now();
  }, [pathname]);

  useEffect(() => {
    function refreshIfDue() {
      if (document.visibilityState !== "visible") return;
      if (navigator.onLine === false) return;
      const now = Date.now();
      if (now - lastRun.current < MIN_GAP_MS) return;
      lastRun.current = now;
      router.refresh();
    }

    const timer = window.setInterval(refreshIfDue, POLL_MS);
    window.addEventListener("focus", refreshIfDue);
    document.addEventListener("visibilitychange", refreshIfDue);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshIfDue);
      document.removeEventListener("visibilitychange", refreshIfDue);
    };
  }, [router]);

  return (
    <span
      className="hidden items-center gap-1.5 whitespace-nowrap text-[12px] font-medium text-muted md:inline-flex"
      title={t("This page updates on its own")}
    >
      <span className="relative flex h-1.5 w-1.5 items-center justify-center" aria-hidden="true">
        <span className="absolute h-1.5 w-1.5 rounded-full bg-accent/40 motion-safe:animate-ping" />
        <span className="relative h-1.5 w-1.5 rounded-full bg-accent" />
      </span>
      {t("Live")}
    </span>
  );
}
