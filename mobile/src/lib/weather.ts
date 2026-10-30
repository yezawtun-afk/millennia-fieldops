// The site forecast, for the weather row on Home.
//
// Open-Meteo is used because it needs no API key: a field app should not carry
// a secret that can expire mid-season. The reading is cached on the phone, so
// the row still has something to say after a day with no signal - it just says
// how old the reading is.
//
// This is context, not a warning. A forecast is for a grid cell several
// kilometres wide, so it can say "rain is likely from 15:00" but it can never
// say a particular slope is dangerous.
import AsyncStorage from "@react-native-async-storage/async-storage";

// The middle of the monitoring area. One forecast covers the whole village:
// the zones sit within about 700 m of each other, and nothing a forecast can
// resolve changes over that distance.
const SITE_LAT = 2.7527;
const SITE_LNG = 101.9069;

// The site's own clock, so "from 15:00" means 15:00 at the site rather than on
// whatever timezone the phone happens to be set to.
const SITE_TIMEZONE = "Asia/Kuala_Lumpur";

const CACHE_KEY = "millennia-fieldops.weather";
const WINDOW_HOURS = 12;
// A forecast older than this is shown with its time, not passed off as current.
const STALE_AFTER_MS = 60 * 60 * 1000;

export interface SiteWeather {
  /** Degrees Celsius, rounded. */
  tempC: number;
  /** WMO weather code, for the icon. */
  code: number;
  /** Highest chance of rain in the next twelve hours, in percent. */
  rainChance: number;
  /** "15:00" when rain is likely and we know when; null otherwise. */
  rainFrom: string | null;
  /** ISO timestamp of the reading itself. */
  fetchedAt: string;
}

interface OpenMeteoResponse {
  current?: { time?: string; temperature_2m?: number; weather_code?: number };
  hourly?: { time?: string[]; precipitation_probability?: (number | null)[] };
}

// Rain this likely is worth naming an hour for.
const LIKELY_RAIN = 60;

export function isWeatherStale(weather: SiteWeather): boolean {
  return Date.now() - new Date(weather.fetchedAt).getTime() > STALE_AFTER_MS;
}

/** The site's local clock time of a reading, "08:12". */
export function weatherTimeLabel(weather: SiteWeather): string {
  const date = new Date(weather.fetchedAt);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function weatherIcon(code: number): string {
  if (code <= 1) return "sunny-outline";
  if (code === 2) return "partly-sunny-outline";
  if (code === 3 || code === 45 || code === 48) return "cloud-outline";
  if (code >= 95) return "thunderstorm-outline";
  if (code >= 71 && code <= 77) return "snow-outline";
  return "rainy-outline";
}

export async function readCachedWeather(): Promise<SiteWeather | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SiteWeather;
    if (typeof parsed?.tempC !== "number" || typeof parsed?.rainChance !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function fetchSiteWeather(): Promise<SiteWeather> {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${SITE_LAT}&longitude=${SITE_LNG}` +
    "&current=temperature_2m,weather_code" +
    "&hourly=precipitation_probability" +
    `&forecast_days=2&timezone=${encodeURIComponent(SITE_TIMEZONE)}`;

  // Without a deadline a dead connection leaves the row saying nothing forever.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  let data: OpenMeteoResponse;
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Weather request failed (${response.status})`);
    data = (await response.json()) as OpenMeteoResponse;
  } finally {
    clearTimeout(timer);
  }

  const temp = data.current?.temperature_2m;
  if (typeof temp !== "number") throw new Error("Weather response had no temperature");

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

  const weather: SiteWeather = {
    tempC: Math.round(temp),
    code: typeof data.current?.weather_code === "number" ? data.current.weather_code : 0,
    rainChance,
    rainFrom,
    fetchedAt: new Date().toISOString(),
  };

  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(weather));
  } catch {
    // The reading is still usable; it just will not survive a restart.
  }

  return weather;
}
