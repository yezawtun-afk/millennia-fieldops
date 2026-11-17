// The site forecast for the header, the same reading the phone shows on Home.
//
// Open-Meteo is used because it needs no API key: the web app should not carry
// a secret that can expire mid-season. The call is cached for ten minutes, so a
// thousand visitors cost one upstream request, and the header never waits on
// the weather to paint.
//
// This is context, not a warning. A forecast is for a grid cell several
// kilometres wide, so it can say "rain is likely from 15:00" but it can never
// say a particular slope is dangerous.
import "server-only";

// The middle of the monitoring area. One forecast covers the whole village:
// the zones sit within about 700 m of each other, and nothing a forecast can
// resolve changes over that distance. Kept identical to mobile/src/lib/weather.ts
// so the phone and the website cannot disagree.
const SITE_LAT = 2.7527;
const SITE_LNG = 101.9069;

// The site's own clock, so "from 15:00" means 15:00 at the site rather than on
// whatever timezone the visitor's laptop happens to be set to.
const SITE_TIMEZONE = "Asia/Kuala_Lumpur";

const WINDOW_HOURS = 12;
// Rain this likely is worth naming an hour for.
const LIKELY_RAIN = 60;
// Ten minutes: the forecast does not change faster than that, and it keeps the
// header free of a request per page view.
const REVALIDATE_SECONDS = 600;

export interface SiteWeather {
  /** Degrees Celsius, rounded. */
  tempC: number;
  /** WMO weather code, for the icon. */
  code: number;
  /** Highest chance of rain in the next twelve hours, in percent. */
  rainChance: number;
  /** "15:00" when rain is likely and we know when; null otherwise. */
  rainFrom: string | null;
}

interface OpenMeteoResponse {
  current?: { time?: string; temperature_2m?: number; weather_code?: number };
  hourly?: { time?: string[]; precipitation_probability?: (number | null)[] };
}

/**
 * The current site forecast, or null when Open-Meteo cannot be reached.
 *
 * A missing pill is a smaller problem than a broken page, so every failure -
 * timeout, non-200, a body without a temperature - comes back as null and the
 * header simply shows one chip less.
 */
export async function getSiteWeather(): Promise<SiteWeather | null> {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${SITE_LAT}&longitude=${SITE_LNG}` +
    "&current=temperature_2m,weather_code" +
    "&hourly=precipitation_probability" +
    `&forecast_days=2&timezone=${encodeURIComponent(SITE_TIMEZONE)}`;

  try {
    const response = await fetch(url, {
      // Without a deadline a dead upstream holds the layout open.
      signal: AbortSignal.timeout(6000),
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!response.ok) return null;

    const data = (await response.json()) as OpenMeteoResponse;
    const temp = data.current?.temperature_2m;
    if (typeof temp !== "number") return null;

    // Local timestamps compare correctly as strings because the format is fixed
    // width: "2026-10-30T15:00" > "2026-10-30T14:15".
    const nowLocal = data.current?.time ?? "";
    const times = data.hourly?.time ?? [];
    const chances = data.hourly?.precipitation_probability ?? [];

    const start = Math.max(
      0,
      times.findIndex((time) => time > nowLocal)
    );
    const windowTimes = times.slice(start, start + WINDOW_HOURS);
    const windowChances = chances
      .slice(start, start + WINDOW_HOURS)
      .map((value) => (typeof value === "number" ? value : 0));

    const rainChance = windowChances.length > 0 ? Math.max(...windowChances) : 0;
    const likelyIndex = windowChances.findIndex((value) => value >= LIKELY_RAIN);
    const rainFrom =
      likelyIndex >= 0 && windowTimes[likelyIndex]
        ? windowTimes[likelyIndex].slice(11, 16)
        : null;

    return {
      tempC: Math.round(temp),
      code: typeof data.current?.weather_code === "number" ? data.current.weather_code : 0,
      rainChance,
      rainFrom,
    };
  } catch {
    return null;
  }
}
