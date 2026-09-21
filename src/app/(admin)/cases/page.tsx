import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Cases' };

/**
 * Admin Cases Overview
 * TODO: All cases (admin view), filter by status, lawyer, client
 * TODO: Manual case status override
 */
export default function AdminCasesPage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">All Cases</h1>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(admin)/cases/page.tsx</code>
      </div>
    </main>
  );
}
