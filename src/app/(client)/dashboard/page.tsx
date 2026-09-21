import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Dashboard' };

/**
 * Client Dashboard (Home)
 *
 * The main landing screen for authenticated clients after login.
 * Shows a summary overview of their account activity.
 *
 * TODO: Fetch active consultations (status: pending | confirmed)
 * TODO: Fetch recent AI conversation list
 * TODO: Show quick-action cards (Start AI Chat, Find a Lawyer, My Cases)
 * TODO: Show upcoming consultation countdown/details
 * TODO: Show unread message count
 * TODO: Show notifications panel
 */
export default function ClientDashboardPage() {
  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Welcome back</h1>
      <p className="text-muted-foreground">Here&apos;s a summary of your legal activity.</p>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <strong>Scaffold placeholder</strong> — <code>src/app/(client)/dashboard/page.tsx</code>
        <br />
        TODO: Quick-action cards, upcoming consultations, recent AI chats, notifications
      </div>
      <nav aria-label="Quick links" className="flex flex-wrap gap-3">
        <Link href="/ai-assistant" className="px-4 py-2 rounded-lg border text-sm hover:bg-muted transition">AI Assistant</Link>
        <Link href="/lawyers" className="px-4 py-2 rounded-lg border text-sm hover:bg-muted transition">Find a Lawyer</Link>
        <Link href="/consultations" className="px-4 py-2 rounded-lg border text-sm hover:bg-muted transition">My Consultations</Link>
        <Link href="/cases" className="px-4 py-2 rounded-lg border text-sm hover:bg-muted transition">My Cases</Link>
      </nav>
    </main>
  );
}
