"use client";

// The theme picker. Light, Dark or System, written to a one-year cookie and
// applied with a refresh, the same way the language picker works.
//
// The attribute is also set on <html> immediately, so the change lands before
// the server round-trip finishes instead of after a visible pause.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useI18n } from "@/i18n";
import { THEME_COOKIE, type ThemePref } from "@/lib/theme";

const OPTIONS: { value: ThemePref; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

function resolveSystem(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeSwitcher({ pref }: { pref: ThemePref }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const current = OPTIONS.find((option) => option.value === pref) ?? OPTIONS[0];
  const CurrentIcon = current.icon;

  // Follow the OS while "System" is chosen - both on first mount and after the
  // reader has just picked it, without waiting for a reload.
  useEffect(() => {
    if (pref !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.setAttribute("data-theme", media.matches ? "dark" : "light");
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [pref]);

  function choose(next: ThemePref) {
    setOpen(false);
    buttonRef.current?.focus();
    if (next === pref) return;

    document.documentElement.setAttribute("data-theme-pref", next);
    document.documentElement.setAttribute(
      "data-theme",
      next === "system" ? resolveSystem() : next
    );
    document.cookie = `${THEME_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    // The attribute gives an instant change; the refresh makes it official for
    // every server-rendered surface.
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

  // Open the menu with the current choice focused.
  useEffect(() => {
    if (!open) return;
    const active = menuRef.current?.querySelector<HTMLElement>('[aria-checked="true"]');
    (active ?? menuRef.current?.querySelector<HTMLElement>('[role="menuitemradio"]'))?.focus();
  }, [open]);

  function moveFocus(offset: number) {
    const options = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? []
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
      menuRef.current?.querySelector<HTMLElement>('[role="menuitemradio"]')?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      const options = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]');
      options?.[options.length - 1]?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div className="relative shrink-0" ref={wrapRef}>
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
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t("Change theme")}: ${t(current.label)}`}
        title={t("Change theme")}
        className="inline-flex h-8 items-center gap-1 rounded-md border border-control bg-sheet pl-2 pr-1.5 text-muted transition-colors hover:border-accent hover:text-ink"
      >
        <CurrentIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.7} aria-hidden="true" />
        <ChevronDown
          className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={1.8}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label={t("Theme")}
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 z-40 mt-1.5 w-[160px] overflow-hidden rounded-card border border-line bg-sheet py-1 shadow-[0_18px_48px_rgb(0_0_0_/_0.18)]"
        >
          {OPTIONS.map((option) => {
            const active = option.value === pref;
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => choose(option.value)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors ${
                  active
                    ? "bg-accent-soft font-medium text-ink"
                    : "text-muted hover:bg-panel hover:text-ink"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
                <span className="flex-1">{t(option.label)}</span>
                {active ? <Check className="h-4 w-4 shrink-0 text-accent" strokeWidth={2} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
