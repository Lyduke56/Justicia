/** Personal preferences only; never use user-editable metadata for authorization. */
export function accountPreferences(metadata: Record<string, unknown> | undefined) {
  const value = metadata?.justicia_preferences;
  const preferences = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return { consultationNotifications: preferences.consultationNotifications !== false };
}
