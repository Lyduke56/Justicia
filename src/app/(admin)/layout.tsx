/**
 * Admin Layout — Dashboard Shell
 * TODO: Build AdminNav with all admin sections
 * TODO: Restrict to role = 'admin' (middleware handles redirect, but add server-side guard here too)
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-72 border-r bg-slate-950 text-slate-100 p-4 hidden md:block" aria-label="Admin navigation">
        <div className="text-sm font-bold mb-6 text-white">Justicia Admin</div>
        <nav className="space-y-1 text-xs text-slate-400">
          <div className="px-3 py-2 rounded-lg bg-slate-800 text-slate-200">🚧 AdminNav placeholder</div>
          {['Dashboard','Users','Lawyers','Reports','Knowledge Base','AI Management','Consultations','Cases','Analytics','Support','Announcements','Settings'].map(item => (
            <div key={item} className="px-3 py-2">{item}</div>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
