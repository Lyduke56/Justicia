/**
 * Lawyer Layout — Dashboard Shell
 * TODO: Build LawyerNav with: logo, Dashboard, Consultations, Clients, Cases, Documents, Messages, Reviews, Profile, Settings
 * TODO: Verification status banner (if verification_status != 'verified')
 * TODO: Mobile-responsive drawer
 */
export default function LawyerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r bg-muted/30 p-4 hidden md:block" aria-label="Lawyer navigation">
        <div className="text-sm font-bold mb-6">Justicia — Lawyer</div>
        <nav className="space-y-1 text-sm text-muted-foreground">
          <div className="px-3 py-2 rounded-lg bg-muted">🚧 LawyerNav placeholder</div>
          <div className="px-3 py-2">Dashboard</div>
          <div className="px-3 py-2">Consultations</div>
          <div className="px-3 py-2">Clients</div>
          <div className="px-3 py-2">Cases</div>
          <div className="px-3 py-2">Documents</div>
          <div className="px-3 py-2">Messages</div>
          <div className="px-3 py-2">Reviews</div>
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
