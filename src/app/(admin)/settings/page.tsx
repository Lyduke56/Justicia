import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'System Settings' };

/**
 * Admin Settings — General / System Configuration
 * TODO: Platform name, logo, contact email, support URL
 * TODO: Maintenance mode toggle
 * TODO: Feature flags (enable/disable AI assistant, payment, conferencing)
 * TODO: Default consultation fees, cancellation policy
 */
export default function AdminSettingsPage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">System Settings</h1>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(admin)/settings/page.tsx</code>
        <br />TODO: Platform config, maintenance mode, feature flags, default policies
      </div>
    </main>
  );
}
