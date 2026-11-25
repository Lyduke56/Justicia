/**
 * Client profile extras: city/province, preferred consultation language, preferred contact
 * method and time (profiles columns from supabase/manual/007_profile_fields.sql). Safe on both
 * server and client. (profiles.preferred_language is the interface language, en | fil, and is
 * not used here.)
 */

export const CONSULTATION_LANGUAGES = ['English', 'Filipino', 'Cebuano', 'Ilocano', 'Hiligaynon', 'Waray', 'Kapampangan', 'Bikolano'] as const;

export const CONTACT_METHODS = [
  { value: 'messages', label: 'Justicia messages' },
  { value: 'email', label: 'Email' },
  { value: 'phone_call', label: 'Phone call' },
  { value: 'sms', label: 'Text message (SMS)' },
] as const;

export const CONTACT_TIMES = [
  { value: 'morning', label: 'Mornings (8 AM – 12 NN)' },
  { value: 'afternoon', label: 'Afternoons (12 NN – 5 PM)' },
  { value: 'evening', label: 'Evenings (5 PM – 9 PM)' },
  { value: 'anytime', label: 'Any time' },
] as const;

export type ContactMethod = (typeof CONTACT_METHODS)[number]['value'];
export type ContactTime = (typeof CONTACT_TIMES)[number]['value'];

export interface ProfileExtras {
  avatarUrl: string | null;
  cityProvince: string | null;
  preferredLanguage: string | null;
  contactMethod: ContactMethod | null;
  contactTime: ContactTime | null;
}

export function contactMethodLabel(value: string | null | undefined): string | null {
  return CONTACT_METHODS.find((m) => m.value === value)?.label ?? null;
}

export function contactTimeLabel(value: string | null | undefined): string | null {
  return CONTACT_TIMES.find((t) => t.value === value)?.label ?? null;
}

/** One line for a lawyer: how and when the client prefers to be reached, and in which language. */
export function contactPreferenceLine(extras: Partial<ProfileExtras> | null | undefined): string | null {
  if (!extras) return null;
  const parts = [
    contactMethodLabel(extras.contactMethod) ? `Prefers ${contactMethodLabel(extras.contactMethod)!.toLowerCase()}` : null,
    contactTimeLabel(extras.contactTime) ? contactTimeLabel(extras.contactTime)!.toLowerCase() : null,
    extras.preferredLanguage ? `in ${extras.preferredLanguage}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

/** Profile completeness for the meter (#15): which recommended fields are filled. */
export function profileCompleteness(input: {
  fullName: string;
  phone: string;
  emailVerified: boolean;
  extras: ProfileExtras;
}): { percent: number; missing: string[] } {
  const checks: Array<[boolean, string]> = [
    [!!input.fullName.trim(), 'full name'],
    [input.emailVerified, 'verified email'],
    [!!input.phone.trim(), 'contact number'],
    [!!input.extras.avatarUrl, 'profile photo'],
    [!!input.extras.cityProvince, 'city or province'],
    [!!input.extras.preferredLanguage, 'consultation language'],
    [!!input.extras.contactMethod && !!input.extras.contactTime, 'contact preference'],
  ];
  const done = checks.filter(([ok]) => ok).length;
  return { percent: Math.round((done / checks.length) * 100), missing: checks.filter(([ok]) => !ok).map(([, label]) => label) };
}
