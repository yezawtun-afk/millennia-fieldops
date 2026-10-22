"use client";

// The bell in the top bar.
//
// Field workers: the decisions made on their own records (rows in the
// `notifications` table, unread until they open them). Reviewers: records that
// arrived and are waiting for a decision. The red dot therefore means "there is
// something here you have not looked at yet".
//
// Reviewers have no per-record rows to mark read, so "looked at" is kept in a
// `pending_seen` cookie. The server reads it and passes it in, so the dot is
// correct on the first paint instead of appearing after the page loads.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/i18n";
import { formatDateTime } from "@/lib/format";
import type { News, Profile } from "@/lib/types";

const SEEN_COOKIE = "pending_seen";
const SEEN_MAX_AGE = 60 * 60 * 24 * 365;

export function NewsBell({
  profile,
  news,
  seenAt,
}: {
  profile: Pick<Profile, "id" | "role">;
  news: News;
  seenAt: string | null;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [marking, setMarking] = useState(false);
  const [seen, setSeen] = useState(seenAt);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const isReviewer = news.kind === "reviewer";
  const latestAt = news.kind === "reviewer" ? news.latestAt : null;

  // A refresh can bring a newer server value; keep the two in step, but never
  // let an in-flight refresh undo a panel that was just opened.
  useEffect(() => {
    setSeen((current) => {
      if (!seenAt) return current;
      if (!current) return seenAt;
      return new Date(seenAt).getTime() > new Date(current).getTime() ? seenAt : current;
    });
  }, [seenAt]);

  const unread = news.kind === "worker" ? news.unread : 0;
  const pending = news.kind === "reviewer" ? news.pending : 0;

  const hasNews = isReviewer
    ? Boolean(latestAt) &&
      (!seen || new Date(latestAt as string).getTime() > new Date(seen).getTime())
    : unread > 0;

  // Looking at the panel counts as having seen what is in it.
  useEffect(() => {
    if (!open || !isReviewer || !latestAt) return;
    const value = `${profile.id}|${latestAt}`;
    document.cookie = `${SEEN_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${SEEN_MAX_AGE}; samesite=lax`;
    setSeen(latestAt);
  }, [open, isReviewer, latestAt, profile.id, news]);

  // Close on a click outside or on Escape.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const dot = hasNews && !open;

  function timeAgo(iso: string): string {
    const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
    if (minutes < 1) return t("Just now");
    if (minutes < 60) return t("{count}m ago", { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t("{count}h ago", { count: hours });
    const days = Math.floor(hours / 24);
    if (days < 7) return t("{count}d ago", { count: days });
    return formatDateTime(iso);
  }

  async function markAllRead() {
    if (news.kind !== "worker" || unread === 0) return;
    setMarking(true);
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", profile.id)
      .is("read_at", null);
    setMarking(false);
    router.refresh();
  }

  async function openWorkerItem(itemId: string, recordId: string | null) {
    setOpen(false);
    if (!recordId) {
      router.refresh();
      return;
    }
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", itemId);
    router.push(`/records/${recordId}`);
  }

  const label =
    news.kind === "worker"
      ? unread > 0
        ? t("{count} unread", { count: unread })
        : t("Notifications")
      : pending > 0
        ? t("{count} waiting for review", { count: pending })
        : t("Notifications");

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={label}
        title={t("Notifications")}
        className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-frame-soft hover:text-ink"
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={1.8} />
        {dot ? (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-negative ring-2 ring-frame" />
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={t("Notifications")}
          className="absolute right-0 top-[calc(100%+6px)] z-40 w-[340px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-card border border-line bg-sheet shadow-lg"
        >
          <div className="flex items-baseline justify-between gap-3 border-b border-rule px-4 py-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-ink">{t("Notifications")}</p>
              <p className="mt-0.5 text-[12px] text-muted">
                {news.kind === "worker"
                  ? unread > 0
                    ? t("{count} unread", { count: unread })
                    : t("Everything here has been read")
                  : pending > 0
                    ? t("{count} waiting for review", { count: pending })
                    : t("Nothing is waiting for review")}
              </p>
            </div>
            {news.kind === "worker" && unread > 0 ? (
              <button
                type="button"
                onClick={markAllRead}
                disabled={marking}
                className="flex shrink-0 items-center gap-1 text-[12px] font-medium text-accent hover:underline disabled:opacity-60"
              >
                <CheckCheck className="h-3.5 w-3.5" strokeWidth={1.8} />
                {t("Mark all read")}
              </button>
            ) : null}
          </div>

          {news.items.length === 0 ? (
            <p className="px-4 py-6 text-[13px] text-muted">
              {news.kind === "worker"
                ? t("No notifications yet")
                : t("No records are waiting for review.")}
            </p>
          ) : (
            <ul className="max-h-[min(70vh,400px)] overflow-y-auto">
              {news.kind === "worker"
                ? news.items.map((item) => {
                    const unreadItem = !item.readAt;
                    return (
                      <li key={item.id} className="border-b border-rule last:border-b-0">
                        <button
                          type="button"
                          onClick={() => openWorkerItem(item.id, item.recordId)}
                          className="flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors hover:bg-panel"
                        >
                          <span
                            className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                              unreadItem ? "bg-accent" : "bg-transparent"
                            }`}
                          />
                          <span className="min-w-0">
                            <span
                              className={`block text-[13px] leading-snug ${
                                unreadItem ? "font-medium text-ink" : "text-muted"
                              }`}
                            >
                              {item.message}
                            </span>
                            <span className="mt-0.5 block text-[12px] text-faint">
                              {timeAgo(item.createdAt)}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })
                : news.items.map((item) => (
                    <li key={item.id} className="border-b border-rule last:border-b-0">
                      <Link
                        href={`/records/${item.id}`}
                        onClick={() => setOpen(false)}
                        className="block px-4 py-3 transition-colors hover:bg-panel"
                      >
                        <span className="block truncate text-[13px] font-medium text-ink">
                          {item.title}
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] text-muted">
                          {item.zoneName ?? t("No zone")} · {timeAgo(item.createdAt)}
                        </span>
                      </Link>
                    </li>
                  ))}
            </ul>
          )}

          <div className="border-t border-rule px-4 py-2.5">
            {news.kind === "reviewer" ? (
              <Link
                href="/records?status=pending"
                onClick={() => setOpen(false)}
                className="text-[12px] font-medium text-accent hover:underline"
              >
                {t("Open the queue")}
              </Link>
            ) : (
              <Link
                href="/records"
                onClick={() => setOpen(false)}
                className="text-[12px] font-medium text-accent hover:underline"
              >
                {t("All records")}
              </Link>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
