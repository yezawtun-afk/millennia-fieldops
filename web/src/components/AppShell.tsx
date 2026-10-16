"use client";

// The signed-in frame: dark green sidebar, page area and phone drawer.
// Mirrors the layout of the previous Millennia FieldOps build.
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Table2,
  Map as MapIcon,
  MapPin,
  Users as UsersIcon,
  LogOut,
  Menu,
  X,
  Wifi,
  WifiOff,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABELS } from "@/components/ui";
import type { Profile } from "@/lib/types";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: Profile["role"][];
  end?: boolean;
};

// The menu from the previous build. Each item says which roles may see it.
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Monitoring",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["field_worker", "supervisor", "admin"], end: true },
      { href: "/records", label: "Records", icon: Table2, roles: ["field_worker", "supervisor", "admin"] },
      { href: "/map", label: "Site Map", icon: MapIcon, roles: ["field_worker", "supervisor", "admin"] },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/zones", label: "Zones", icon: MapPin, roles: ["admin"] },
      { href: "/users", label: "Users", icon: UsersIcon, roles: ["admin"] },
    ],
  },
];

// Small pill in the sidebar footer showing whether the device has a connection.
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

function Brand() {
  return (
    <div className="flex items-center gap-3 px-4 py-5">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M20 4c-8 0-14 3-14 9a6 6 0 0 0 6 6c6 0 8-7 8-15Z" strokeLinecap="round" />
          <path d="M6 20c2-5 6-9 11-12" strokeLinecap="round" />
        </svg>
      </span>
      <span>
        <span className="block text-sm font-bold leading-tight text-white">Millennia FieldOps</span>
        <span className="block text-xs text-white/60">Millennia Village</span>
      </span>
    </div>
  );
}

function SidebarContent({
  profile,
  onNavigate,
}: {
  profile: Profile;
  onNavigate?: () => void;
}) {
  const online = useOnlineStatus();
  const router = useRouter();
  const pathname = usePathname();

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
    <div className="flex h-full flex-col bg-forest">
      <Brand />

      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => item.roles.includes(profile.role));
          if (items.length === 0) return null;

          return (
            <div key={group.label} className="mb-4">
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                {group.label}
              </p>
              <ul className="space-y-1">
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${
                          active ? "bg-primary text-white" : "text-white/75 hover:bg-forest-soft hover:text-white"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-forest-line px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{profile.full_name}</p>
            <p className="text-xs text-white/60">{ROLE_LABELS[profile.role]}</p>
          </div>
          <span
            className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${
              online ? "bg-primary/30 text-white" : "bg-pending/25 text-pending"
            }`}
            title={online ? "Connected" : "Offline"}
          >
            {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {online ? "Online" : "Offline"}
          </span>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-forest-line px-3 py-2 text-sm font-semibold text-white/85 hover:bg-forest-soft"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </div>
    </div>
  );
}

export function AppShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  // Close the phone drawer whenever the page changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-page">
      {/* Fixed sidebar from 1024 px wide */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block lg:w-64">
        <SidebarContent profile={profile} />
      </aside>

      {/* Phone and tablet top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-forest px-3 py-2 lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="rounded-md p-2 text-white hover:bg-forest-soft"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-sm font-bold text-white">Millennia FieldOps</span>
      </header>

      {/* Slide-out drawer on small screens */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="drawer-in absolute inset-y-0 left-0 w-72 max-w-[85%] shadow-2xl">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close menu"
              className="absolute right-2 top-3 z-10 rounded-md p-2 text-white/70 hover:bg-forest-soft"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent profile={profile} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      ) : null}

      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
