// Phone numbers are stored and compared in one shape only: E.164, which looks
// like +60123456789 (a plus sign, country code, then the number, no spaces).
// People type "012-345 6789", "+60 12 345 6789" or "60123456789", so every
// entry point runs it through this helper first.
//
// The project is based in Malaysia, so a number without a country code is
// assumed to be local (+60).
const DEFAULT_COUNTRY_CODE = "60";

export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  let normalized: string;
  if (hasPlus) {
    normalized = `+${digits}`;
  } else if (digits.startsWith("0")) {
    normalized = `+${DEFAULT_COUNTRY_CODE}${digits.slice(1)}`;
  } else if (digits.startsWith(DEFAULT_COUNTRY_CODE)) {
    normalized = `+${digits}`;
  } else {
    normalized = `+${DEFAULT_COUNTRY_CODE}${digits}`;
  }

  // Same rule as the check constraint on profiles.phone.
  return /^\+[1-9][0-9]{7,14}$/.test(normalized) ? normalized : null;
}

// A login field accepts an email or a phone number. Anything without an "@"
// and with at least one digit is treated as a phone number.
export function looksLikePhone(input: string): boolean {
  const trimmed = input.trim();
  return trimmed.length > 0 && !trimmed.includes("@") && /\d/.test(trimmed);
}
