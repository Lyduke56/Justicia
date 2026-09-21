/**
 * Client Layout — Dashboard Shell
 *
 * Wraps all client-facing pages with the persistent navigation sidebar/header.
 *
 * TODO: Build ClientNav component with:
 *   - Justicia logo
 *   - Navigation links (Dashboard, AI Assistant, Find a Lawyer, Consultations, Cases, Documents, Messages)
 *   - User avatar / profile menu
 *   - Notification bell
 *   - Language switcher
 * TODO: Add mobile-responsive drawer navigation
 * TODO: Verify user role is 'client' — redirect if not (middleware handles this too)
 */
export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* TODO: <ClientNav /> */}
      <aside className="w-64 border-r bg-muted/30 p-4 hidden md:block" aria-label="Client navigation">
        <div className="text-sm font-bold mb-6">Justicia</div>
        <nav className="space-y-1 text-sm text-muted-foreground">
          <div className="px-3 py-2 rounded-lg bg-muted">🚧 ClientNav placeholder</div>
          <div className="px-3 py-2">Dashboard</div>
          <div className="px-3 py-2">AI Assistant</div>
          <div className="px-3 py-2">Find a Lawyer</div>
          <div className="px-3 py-2">Consultations</div>
          <div className="px-3 py-2">Cases</div>
          <div className="px-3 py-2">Documents</div>
          <div className="px-3 py-2">Messages</div>
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
