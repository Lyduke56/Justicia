import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Announcements' };

/**
 * Announcements
 * TODO: Create/edit/delete platform-wide announcements
 * TODO: Target by role (all users, clients only, lawyers only)
 * TODO: Schedule publish date / expiry
 * TODO: Send as in-app notification and/or email blast
 */
export default function AnnouncementsPage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Announcements</h1>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(admin)/announcements/page.tsx</code>
        <br />TODO: Create/edit announcements, role targeting, schedule, send as notification/email
      </div>
    </main>
  );
}
