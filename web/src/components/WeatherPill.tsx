"use client";

// The site weather, beside the live signal in the top bar.
//
// The phone's Home row says "29°C · Rain 92% from 17:00"; this says the same
// thing in the same words, so the two surfaces cannot describe one afternoon
// differently. The numbers are fetched on the server and handed down, which
// means the first paint already has them - no flash of an empty chip, and no
// client request to Open-Meteo per visitor.
//
// Chrome, not data: the chip is white on the tinted frame like the search box,
// and only the icon carries colour. The emoji in the mock-up was replaced with
// a lucide glyph to match the rest of the dashboard and the phone.
import { Cloud, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun, type LucideIcon } from "lucide-react";
import { useI18n } from "@/i18n";
import type { SiteWeather } from "@/lib/weather";

// The same split as mobile/src/lib/weather.ts, mapped onto lucide names.
function weatherIcon(code: number): LucideIcon {
  if (code <= 1) return Sun;
  if (code === 2) return CloudSun;
  if (code === 3 || code === 45 || code === 48) return Cloud;
  if (code >= 95) return CloudLightning;
  if (code >= 71 && code <= 77) return CloudSnow;
  return CloudRain;
}

export function WeatherPill({ weather }: { weather: SiteWeather | null }) {
  const { t } = useI18n();
  if (!weather) return null;

  // One sentence of site weather. Under a 20% chance there is nothing to plan
  // around, so it says that rather than naming a number nobody acts on.
  const sentence =
    weather.rainChance >= 20
      ? weather.rainFrom
        ? t("{temp}°C · Rain {chance}% from {time}", {
            temp: weather.tempC,
            chance: weather.rainChance,
            time: weather.rainFrom,
          })
        : t("{temp}°C · Rain {chance}% later", {
            temp: weather.tempC,
            chance: weather.rainChance,
          })
      : t("{temp}°C · Rain unlikely", { temp: weather.tempC });

  // Between md and xl the header is busy, so only the two numbers that change a
  // decision stay; the full sentence returns on wide screens. The percentage is
  // dropped when there is nothing to plan around - "5%" beside a sun reads as a
  // warning about nothing.
  const compact =
    weather.rainChance >= 20
      ? `${weather.tempC}°C · ${weather.rainChance}%`
      : `${weather.tempC}°C`;

  const Icon = weatherIcon(weather.code);
  // Only clear skies get the warm cast; cloud and rain read as water.
  const precipitation = weather.code > 2;
  const label = `${t("Millennia Village")} · ${sentence}`;

  return (
    <span
      className="hidden shrink-0 items-center gap-1.5 rounded-full border border-line bg-sheet py-1 pl-2 pr-2.5 md:inline-flex"
      title={label}
    >
      <Icon
        className={precipitation ? "h-3.5 w-3.5 text-water" : "h-3.5 w-3.5 text-sev-low"}
        strokeWidth={1.8}
        aria-hidden="true"
      />
      <span className="num whitespace-nowrap text-[11px] font-medium leading-none text-ink" aria-hidden="true">
        <span className="hidden xl:inline">{sentence}</span>
        <span className="xl:hidden">{compact}</span>
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
