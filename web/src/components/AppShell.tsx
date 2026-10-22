"use client";

// The signed-in frame: one tinted green-grey frame holds the navigation and the
// top bar; the work sits on a white sheet inset from the window edge.
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Table2,
  Map as MapIcon,
  MapPin,
  Users as UsersIcon,
  History,
  LogOut,
  Menu,
  Search,
  X,
  Wifi,
  WifiOff,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ROLE_LABELS } from "@/lib/format";
import type { Profile } from "@/lib/types";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: Profile["role"][];
  end?: boolean;
};

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Monitoring",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard, roles: ["field_worker", "supervisor", "admin"], end: true },
      { href: "/records", label: "Records", icon: Table2, roles: ["field_worker", "supervisor", "admin"] },
      { href: "/map", label: "Site map", icon: MapIcon, roles: ["field_worker", "supervisor", "admin"] },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/zones", label: "Zones", icon: MapPin, roles: ["admin"] },
      { href: "/users", label: "Accounts", icon: UsersIcon, roles: ["admin"] },
      { href: "/audit", label: "Activity log", icon: History, roles: ["admin"] },
    ],
  },
];

// The device's connection state, shown in the sidebar footer.
function useOnlineStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  return online;
}

// A leaf drawn from the place the product monitors - not a boxed letter.
function Mark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M20 4c-8 0-14 3-14 9a6 6 0 0 0 6 6c6 0 8-7 8-15Z" strokeLinecap="round" />
      <path d="M6 20c2-5 6-9 11-12" strokeLinecap="round" />
    </svg>
  );
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 px-3 py-4 hover:opacity-80">
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent-soft text-accent">
        <Mark />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-semibold leading-tight text-ink">
          Millennia FieldOps
        </span>
        <span className="block truncate text-[12px] leading-tight text-muted">Millennia Village</span>
      </span>
    </Link>
  );
}

function SidebarContent({ profile, onNavigate }: { profile: Profile; onNavigate?: () => void }) {
  const online = useOnlineStatus();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  function isActive(item: NavItem) {
    return item.end ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  return (
    <div className="flex h-full flex-col bg-frame">
      <Brand />

      <nav className="flex-1 overflow-y-auto px-2 pb-4" aria-label="Main">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => item.roles.includes(profile.role));
          if (items.length === 0) return null;

          return (
            <div key={group.label} className="mb-5">
              <p className="px-3 pb-1.5 text-[12px] font-medium text-muted">{t(group.label)}</p>
              <ul>
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={`flex h-[34px] items-center gap-2.5 rounded-md px-3 text-[14px] transition-colors ${
                          active
                            ? "bg-frame-soft font-medium text-ink"
                            : "text-muted hover:bg-frame-soft/60 hover:text-ink"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" strokeWidth={1.7} />
                        {t(item.label)}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-line/80 px-3 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-frame-soft text-[12px] font-semibold text-ink">
            {profile.full_name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium leading-tight text-ink">{profile.full_name}</p>
            <p className="truncate text-[12px] leading-tight text-muted">{t(ROLE_LABELS[profile.role])}</p>
          </div>
          <span
            className={`flex items-center gap-1 text-[12px] ${online ? "text-accent" : "text-warning-ink"}`}
            title={online ? t("Connected") : t("No connection")}
          >
            {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            <span className="sr-only">{online ? t("Connected") : t("No connection")}</span>
          </span>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted transition-colors hover:bg-frame-soft hover:text-ink"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.7} />
          {t("Log out")}
        </button>
      </div>
    </div>
  );
}

const TITLES: Record<string, string> = {
  "/dashboard": "Overview",
  "/records": "Records",
  "/map": "Site map",
  "/zones": "Zones",
  "/users": "Accounts",
  "/audit": "Activity log",
};

function pageTitle(t: (text: string) => string, pathname: string): string {
  if (TITLES[pathname]) return t(TITLES[pathname]);
  if (pathname.startsWith("/records/")) return t("Record");
  return "Millennia FieldOps";
}

// The one search on the screen: it searches the records list.
function TopSearch() {
  const router = useRouter();
  const { t } = useI18n();
  const [q, setQ] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const term = q.trim();
        router.push(term ? `/records?q=${encodeURIComponent(term)}` : "/records");
      }}
      className="relative hidden w-full max-w-[320px] sm:block"
      role="search"
    >
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" strokeWidth={1.7} />
      <input
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder={t("Search records")}
        aria-label={t("Search records")}
        className="h-8 w-full rounded-md border border-control bg-sheet pl-8 pr-3 text-[13px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
      />
    </form>
  );
}

export function AppShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const { t } = useI18n();

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-frame">
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block lg:w-[228px]">
        <SidebarContent profile={profile} />
      </aside>

      <div className="lg:pl-[228px]">
        {/* Shared by the sidebar and the top bar: one tinted L, no rule between. */}
        <header className="sticky top-0 z-20 flex h-12 items-center gap-3 bg-frame px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label={t("Open menu")}
            className="-ml-2 rounded-md p-2 text-muted hover:bg-frame-soft hover:text-ink lg:hidden"
          >
            <Menu className="h-5 w-5" strokeWidth={1.7} />
          </button>

          <span className="text-[13px] font-medium text-muted lg:hidden">{pageTitle(t, pathname)}</span>
          <span className="hidden text-[13px] text-muted lg:block">
            {t("Field data review · Millennia Village")}
          </span>

          <div className="ml-auto flex items-center gap-3">
            <TopSearch />
            <LanguageSwitcher compact />
            <Link
              href="/records?status=pending"
              className="hidden whitespace-nowrap rounded-md px-2 py-1 text-[13px] font-medium text-accent hover:bg-frame-soft sm:block"
            >
              {t("Pending review")}
            </Link>
          </div>
        </header>

        {/* The white sheet: inset 8px from the window's right and bottom edges. */}
        <main className="px-2 pb-2">
          <div className="min-h-[calc(100vh-4rem)] rounded-[16px] border border-line bg-sheet p-5 sm:p-6">
            <div className="mx-auto w-full max-w-[1240px]">{children}</div>
          </div>
        </main>
      </div>

      {/* Phone: the frame disappears and the navigation becomes a sheet. */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label={t("Close menu")}
            className="absolute inset-0 bg-ink/40"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="drawer-in absolute inset-y-0 left-0 w-[260px] max-w-[85%] border-r border-line bg-frame">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label={t("Close menu")}
              className="absolute right-2 top-3 z-10 rounded-md p-2 text-muted hover:bg-frame-soft hover:text-ink"
            >
              <X className="h-5 w-5" strokeWidth={1.7} />
            </button>
            <SidebarContent profile={profile} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
