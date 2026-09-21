/**
 * i18n — Internationalization Utility
 *
 * Minimal dictionary-based i18n scaffold supporting English (en) and Filipino (fil).
 * TODO: Replace with next-intl or next-i18next for production-grade i18n
 */

export type Locale = 'en' | 'fil';

export const DEFAULT_LOCALE: Locale = 'en';

// ---------------------------------------------------------------------------
// Dictionary type
// ---------------------------------------------------------------------------
type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

const en = {
  common: {
    appName: 'Justicia',
    tagline: 'AI-Powered Philippine Legal Assistance',
    loading: 'Loading…',
    error: 'Something went wrong.',
    save: 'Save',
    cancel: 'Cancel',
    submit: 'Submit',
    back: 'Back',
    next: 'Next',
    confirm: 'Confirm',
    delete: 'Delete',
    edit: 'Edit',
    view: 'View',
    search: 'Search',
    filter: 'Filter',
    logout: 'Log out',
  },
  auth: {
    login: 'Log in',
    register: 'Create Account',
    email: 'Email address',
    password: 'Password',
    forgotPassword: 'Forgot password?',
    verifyEmail: 'Verify your email',
    resetPassword: 'Reset password',
  },
  nav: {
    dashboard: 'Dashboard',
    aiAssistant: 'AI Legal Assistant',
    legalResearch: 'Legal Research',
    lawyers: 'Find a Lawyer',
    consultations: 'Consultations',
    cases: 'Cases',
    documents: 'Documents',
    messages: 'Messages',
    profile: 'Profile',
    settings: 'Settings',
  },
  disclaimer: {
    text: 'The information provided by the AI Legal Assistant is for general informational purposes only and does not constitute legal advice. Please consult a licensed attorney for advice specific to your situation.',
  },
  roles: {
    client: 'Client',
    lawyer: 'Lawyer',
    admin: 'Administrator',
  },
};

export type Dictionary = typeof en;
type PartialDictionary = DeepPartial<Dictionary>;

const fil: PartialDictionary = {
  common: {
    appName: 'Justicia',
    tagline: 'Tulong-Legal sa Pilipinas na Pinapagana ng AI',
    loading: 'Naglo-load…',
    error: 'May nangyaring mali.',
    save: 'I-save',
    cancel: 'Kanselahin',
    submit: 'Isumite',
    back: 'Bumalik',
    next: 'Susunod',
    confirm: 'Kumpirmahin',
    delete: 'Burahin',
    edit: 'I-edit',
    view: 'Tingnan',
    search: 'Maghanap',
    filter: 'I-filter',
    logout: 'Mag-logout',
  },
  auth: {
    login: 'Mag-login',
    register: 'Gumawa ng Account',
    email: 'Email address',
    password: 'Password',
    forgotPassword: 'Nakalimutan ang password?',
    verifyEmail: 'I-verify ang iyong email',
    resetPassword: 'I-reset ang password',
  },
  nav: {
    dashboard: 'Dashboard',
    aiAssistant: 'AI Legal Assistant',
    legalResearch: 'Legal na Pananaliksik',
    lawyers: 'Humanap ng Abogado',
    consultations: 'Mga Konsultasyon',
    cases: 'Mga Kaso',
    documents: 'Mga Dokumento',
    messages: 'Mga Mensahe',
    profile: 'Profile',
    settings: 'Mga Setting',
  },
  disclaimer: {
    text: 'Ang impormasyong ibinibigay ng AI Legal Assistant ay para lamang sa pangkalahatang impormasyon at hindi bumubuo ng legal na payo. Mangyaring kumonsulta sa isang lisensyadong abogado para sa payo na naaangkop sa iyong sitwasyon.',
  },
  roles: {
    client: 'Kliyente',
    lawyer: 'Abogado',
    admin: 'Administrator',
  },
};

// ---------------------------------------------------------------------------
// Dictionaries map
// ---------------------------------------------------------------------------
const dictionaries: Record<Locale, Dictionary | PartialDictionary> = { en, fil };

/**
 * Returns the dictionary for the given locale, falling back to English for
 * any missing keys.
 */
export function getDictionary(locale: Locale = DEFAULT_LOCALE): Dictionary {
  if (locale === 'en') return en;
  // Deep merge: fil overrides en where defined
  return deepMerge(en, dictionaries[locale]) as Dictionary;
}

function deepMerge<T extends object>(base: T, override: DeepPartial<T>): T {
  const result = { ...base };
  for (const key in override) {
    const k = key as keyof T;
    if (override[k] !== undefined) {
      if (typeof override[k] === 'object' && !Array.isArray(override[k])) {
        result[k] = deepMerge(base[k] as object, override[k] as DeepPartial<object>) as T[keyof T];
      } else {
        result[k] = override[k] as T[keyof T];
      }
    }
  }
  return result;
}
