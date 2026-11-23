/** Keep a single professional title when a stored name already includes one. */
export function formatAttorneyName(name: string): string {
  const bareName = name.trim().replace(/^(?:(?:atty\.?|attorney)\s+)+/i, '').trim();
  return bareName ? `Atty. ${bareName}` : 'Atty.';
}
