"use client";

// Language picker. Choosing a language writes a one-year cookie and refreshes
// the current page, so every server-rendered sentence is rebuilt in that
// language. The button shows the short code; the menu spells each language out
// in its own script, which a native select could not do consistently.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Globe } from "lucide-react";
import { useI18n } from "@/i18n";
import { LOCALES, LOCALE_COOKIE, type Locale } from "@/i18n/translate";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const current = LOCALES.find((item) => item.value === locale) ?? LOCALES[0];

  function choose(next: Locale) {
    setOpen(false);
    buttonRef.current?.focus();
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    // The page is server-rendered, so a refresh is what applies the choice.
    router.refresh();
  }

  // Close on a click outside, and Escape returns focus to the button.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Open the menu with the current language already focused, so the keyboard
  // continues from where the eye is.
  useEffect(() => {
    if (!open) return;
    const active = menuRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    (active ?? menuRef.current?.querySelector<HTMLElement>('[role="option"]'))?.focus();
  }, [open]);

  function moveFocus(offset: number) {
    const options = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []
    );
    if (options.length === 0) return;
    const index = options.indexOf(document.activeElement as HTMLElement);
    const next = (index + offset + options.length) % options.length;
    options[next].focus();
  }

  function onMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveFocus(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveFocus(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      menuRef.current?.querySelector<HTMLElement>('[role="option"]')?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      const options = menuRef.current?.querySelectorAll<HTMLElement>('[role="option"]');
      options?.[options.length - 1]?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t("Change language")}: ${current.label}`}
        title={t("Change language")}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-control bg-sheet pl-2 pr-1.5 text-[12px] text-muted transition-colors hover:border-accent hover:text-ink"
      >
        <Globe className="h-3.5 w-3.5 shrink-0" strokeWidth={1.7} />
        <span className="font-medium text-ink">{compact ? current.short : current.label}</span>
        <ChevronDown
          className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={1.8}
        />
      </button>

      {open ? (
        <div
          ref={menuRef}
          role="listbox"
          aria-label={t("Language")}
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 z-40 mt-1.5 w-[184px] overflow-hidden rounded-card border border-line bg-sheet py-1 shadow-[0_18px_48px_rgb(20_24_27_/_0.16)]"
        >
          {LOCALES.map((item) => {
            const active = item.value === locale;
            return (
              <button
                key={item.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => choose(item.value)}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] transition-colors ${
                  active
                    ? "bg-accent-soft font-medium text-ink"
                    : "text-muted hover:bg-panel hover:text-ink"
                }`}
              >
                {item.label}
                {active ? <Check className="h-4 w-4 shrink-0 text-accent" strokeWidth={2} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export type { Locale };
