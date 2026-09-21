import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Settings' };

/**
 * Client Settings
 * TODO: Notification preferences (in_app, email toggles per notification type)
 * TODO: Language preference (EN / Filipino)
 * TODO: Privacy settings
 * TODO: Connected accounts / OAuth providers
 * TODO: Session management (active sessions, sign out all)
 */
export default function SettingsPage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(client)/settings/page.tsx</code>
        <br />TODO: Notification prefs, language, privacy, sessions
      </div>
    </main>
  );
}
