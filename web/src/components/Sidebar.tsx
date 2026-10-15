"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Map,
  Layers,
  Users,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["field_worker", "supervisor", "admin"] },
  { href: "/records", label: "Records", icon: ClipboardList, roles: ["field_worker", "supervisor", "admin"] },
  { href: "/map", label: "Site map", icon: Map, roles: ["field_worker", "supervisor", "admin"] },
  { href: "/zones", label: "Zones", icon: Layers, roles: ["admin"] },
  { href: "/users", label: "Users", icon: Users, roles: ["admin"] },
] as const;

export function Sidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col bg-forest text-white">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary font-bold">
          M
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Millennia FieldOps</p>
          <p className="text-[11px] text-white/60">Monitoring dashboard</p>
        </div>
      </div>

      <nav className="mt-2 flex-1 space-y-1 px-3">
        {NAV.filter((item) => (item.roles as readonly string[]).includes(profile.role)).map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                active ? "bg-primary text-white" : "text-white/75 hover:bg-forest-soft hover:text-white"
              }`}
            >
              <Icon size={17} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-forest-line px-3 py-3">
        <div className="px-2 pb-2">
          <p className="truncate text-sm font-medium">{profile.full_name}</p>
          <p className="truncate text-[11px] text-white/60">{profile.email}</p>
        </div>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/75 transition hover:bg-forest-soft hover:text-white"
        >
          <LogOut size={17} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
