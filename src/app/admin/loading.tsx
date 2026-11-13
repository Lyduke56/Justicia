export default function AdminLoading() {
  return (
    <div className="admin-page" role="status" aria-label="Loading administration page" aria-busy="true">
      <span className="sr-only">Loading administration page…</span>
      <div aria-hidden="true" className="space-y-4">
        <div className="admin-skeleton h-3 w-32" />
        <div className="admin-skeleton h-9 w-64 max-w-full" />
        <div className="admin-skeleton h-4 w-96 max-w-full" />
      </div>
      <div aria-hidden="true" className="grid gap-6 lg:grid-cols-3">
        {[0, 1, 2].map((item) => <div key={item} className="admin-card space-y-6 p-6"><div className="admin-skeleton h-4 w-32" /><div className="admin-inset p-5"><div className="admin-skeleton h-8 w-16" /></div></div>)}
      </div>
      <div aria-hidden="true" className="admin-card space-y-6 p-7">
        <div className="admin-skeleton h-6 w-48 max-w-full" />
        {[0, 1, 2].map((item) => <div key={item} className="admin-inset flex items-center justify-between gap-5 p-5"><div className="admin-skeleton h-4 w-1/2" /><div className="admin-skeleton h-8 w-20" /></div>)}
      </div>
    </div>
  );
}
