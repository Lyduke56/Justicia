import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Settings' };

/**
 * Lawyer Settings
 * TODO: Notification preferences, language, consultation fee settings, payout account
 */
export default function LawyerSettingsPage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(lawyer)/settings/page.tsx</code>
        <br />TODO: Notification prefs, language, fee settings, payout account
      </div>
    </main>
  );
}
