import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Law Library' };

/**
 * Law Library
 * Browse and search Philippine statutes and codes (e.g. Civil Code, Labor Code, etc.)
 * TODO: Paginated list from legal_sources where type = 'statute'
 * TODO: Alphabetical index, search, filter by legal area
 */
export default function LawsPage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Law Library</h1>
      <p className="text-muted-foreground text-sm">Philippine statutes, codes, and enacted legislation.</p>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(client)/legal-research/laws/page.tsx</code>
        <br />TODO: Paginated statute list, search, legal area filter
      </div>
    </main>
  );
}
