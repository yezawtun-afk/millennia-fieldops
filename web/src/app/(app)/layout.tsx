import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/supabase/server";
import { getNews } from "@/lib/data";
import { getSiteWeather } from "@/lib/weather";
import { getTheme } from "@/lib/theme-server";
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

  // The forecast travels with the page too, so the header has it on the first
  // paint. The fetch is cached for ten minutes, so this costs one request per
  // ten minutes however many people are watching.
  const weather = await getSiteWeather();
  const theme = await getTheme();

  return (
    <AppShell
      profile={profile}
      news={news}
      seenAt={seenUser === profile.id ? seenAt : null}
      weather={weather}
      theme={theme}
    >
      {children}
    </AppShell>
  );
}
