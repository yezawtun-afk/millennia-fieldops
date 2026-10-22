import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/supabase/server";
import { getNews } from "@/lib/data";
import { AppShell } from "@/components/AppShell";

// Every page inside (app) requires a signed-in, active user.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!profile.is_active) redirect("/login?inactive=1");

  // Reviewers have no per-record rows to mark read, so the bell remembers when
  // they last opened it in a cookie. Reading it here (rather than after the page
  // loads) means the red dot is right on the first paint.
  const seenCookie = (await cookies()).get("pending_seen")?.value ?? null;
  const [seenUser, seenAt] = seenCookie ? seenCookie.split("|", 2) : [null, null];

  // The bell's contents travel with the page, so the ten-second refresh in the
  // shell keeps the red dot current without a second poll of its own.
  const news = await getNews(profile);

  return (
    <AppShell
      profile={profile}
      news={news}
      seenAt={seenUser === profile.id ? seenAt : null}
    >
      {children}
    </AppShell>
  );
}
