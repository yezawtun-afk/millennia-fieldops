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

// Supabase Auth needs an email or a phone identity, and its phone identity
// requires a paid SMS provider. Phone-first accounts therefore get a private
// placeholder address built from the number; nobody ever sends mail to it and
// the dashboards hide it. The real identifier is profiles.phone.
const PHONE_EMAIL_DOMAIN = "phone.millennia.local";

export function phoneEmail(phone: string): string {
  return `${phone.replace(/\D/g, "")}@${PHONE_EMAIL_DOMAIN}`;
}

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return Boolean(email && email.endsWith(`@${PHONE_EMAIL_DOMAIN}`));
}

// What to show in a table: the real address, or nothing for phone-only people.
export function visibleEmail(email: string | null | undefined): string | null {
  if (!email || isPlaceholderEmail(email)) return null;
  return email;
}
