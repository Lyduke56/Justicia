/** Where users who are locked out (suspended, terminated, deletion) can reach the Justicia team. */
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@justicia.ph';

/** Days an account stays restorable after the owner asks to delete it. */
export const DELETION_GRACE_DAYS = 7;
