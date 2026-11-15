/** Phone numbers with a country code for sign-up (pure, unit-tested). Stored as "+91 9876543210". */
export interface CountryCode { code: string; country: string; flag: string; min: number; max: number }

export const COUNTRY_CODES: CountryCode[] = [
  { code: '+91', country: 'India', flag: '🇮🇳', min: 10, max: 10 },
  { code: '+971', country: 'United Arab Emirates', flag: '🇦🇪', min: 8, max: 9 },
  { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦', min: 9, max: 9 },
  { code: '+974', country: 'Qatar', flag: '🇶🇦', min: 8, max: 8 },
  { code: '+968', country: 'Oman', flag: '🇴🇲', min: 8, max: 8 },
  { code: '+965', country: 'Kuwait', flag: '🇰🇼', min: 8, max: 8 },
  { code: '+973', country: 'Bahrain', flag: '🇧🇭', min: 8, max: 8 },
  { code: '+1', country: 'USA / Canada', flag: '🇺🇸', min: 10, max: 10 },
  { code: '+44', country: 'United Kingdom', flag: '🇬🇧', min: 9, max: 10 },
  { code: '+61', country: 'Australia', flag: '🇦🇺', min: 9, max: 9 },
  { code: '+65', country: 'Singapore', flag: '🇸🇬', min: 8, max: 8 },
  { code: '+60', country: 'Malaysia', flag: '🇲🇾', min: 9, max: 10 },
  { code: '+977', country: 'Nepal', flag: '🇳🇵', min: 9, max: 10 },
  { code: '+94', country: 'Sri Lanka', flag: '🇱🇰', min: 9, max: 9 },
  { code: '+880', country: 'Bangladesh', flag: '🇧🇩', min: 10, max: 10 },
];

export const DEFAULT_COUNTRY = COUNTRY_CODES[0];

export const phoneDigitsOnly = (v: string) => String(v || '').replace(/\D/g, '');

/** Returns an error message, or null when the number is valid for the chosen country. */
export function phoneError(local: string, country: CountryCode): string | null {
  let d = phoneDigitsOnly(local);
  if (!d) return 'Enter your mobile number.';
  // Accept a leading 0 (trunk prefix) for countries that use one
  if (d.length === country.max + 1 && d.startsWith('0') && country.code !== '+1') d = d.slice(1);
  if (d.length < country.min || d.length > country.max) {
    return country.min === country.max ? `Enter a ${country.min}-digit number for ${country.country}.` : `Enter ${country.min}–${country.max} digits for ${country.country}.`;
  }
  if (country.code === '+91' && !/^[6-9]/.test(d)) return 'Indian mobile numbers start with 6, 7, 8 or 9.';
  return null;
}

/** "+91 9876543210" (no trunk 0), or null when invalid. */
export function formatPhone(local: string, country: CountryCode): string | null {
  if (phoneError(local, country)) return null;
  let d = phoneDigitsOnly(local);
  if (d.length === country.max + 1 && d.startsWith('0')) d = d.slice(1);
  return `${country.code} ${d}`;
}

/** Validates a stored "+CC NNNN" value from user metadata before it is copied to the profile. */
export const isStoredPhone = (v: unknown): v is string => typeof v === 'string' && /^\+\d{1,3} \d{6,12}$/.test(v);
