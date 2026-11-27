/**
 * A professional title typed before the name, in any case and repeated any number of times:
 * "Atty.", "Atty", "Att'y", "Attorney", "Attorney-at-Law", "ATTY.Juan", "Atty, …".
 */
const TITLE_PREFIX = /^(?:(?:attorney|att['’]?y)\b\.?(?:[\s-]+at[\s-]+law\b\.?)?[\s.,:-]*)+/i;
/** A law degree typed after the name: "LL.B.", "LL.B", "LLB", "Ll.B." (with or without a comma). */
const DEGREE_SUFFIX = /(?:[\s,]+ll\.?\s*b\b\.?)+[\s,]*$/i;

/**
 * The name alone, without a typed title or law degree ("atty. Juan Dela Cruz, LL.B." →
 * "Juan Dela Cruz"). This is what lawyer registration stores; displays add "Atty." back.
 */
export function bareAttorneyName(name: string): string {
  return name
    .trim()
    .replace(TITLE_PREFIX, '')
    .replace(DEGREE_SUFFIX, '')
    .replace(/[\s,]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A lawyer's name with exactly one "Atty." in front, however the stored name was typed. */
export function formatAttorneyName(name: string): string {
  const bareName = bareAttorneyName(name);
  return bareName ? `Atty. ${bareName}` : 'Atty.';
}

/**
 * A lawyer's display name, always starting with "Atty." (stored names may or may not include
 * it). Falls back to `fallback` (e.g. "your attorney") when no name is known.
 */
export function attorneyNameOr(name: string | null | undefined, fallback: string): string {
  return typeof name === 'string' && bareAttorneyName(name) ? formatAttorneyName(name) : fallback;
}
