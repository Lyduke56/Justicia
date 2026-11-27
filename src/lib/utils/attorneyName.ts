/** Keep a single professional title when a stored name already includes one. */
export function formatAttorneyName(name: string): string {
  const bareName = name.trim().replace(/^(?:(?:atty\.?|attorney)\s+)+/i, '').trim();
  return bareName ? `Atty. ${bareName}` : 'Atty.';
}

/**
 * A lawyer's display name, always starting with "Atty." (stored names may or may not include
 * it). Falls back to `fallback` (e.g. "your attorney") when no name is known.
 */
export function attorneyNameOr(name: string | null | undefined, fallback: string): string {
  return typeof name === 'string' && name.replace(/^(?:(?:atty\.?|attorney)\s+)+/i, '').trim()
    ? formatAttorneyName(name)
    : fallback;
}
