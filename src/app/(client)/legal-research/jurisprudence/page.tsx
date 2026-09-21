import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Jurisprudence Library' };

/**
 * Jurisprudence Library
 * Browse and search Supreme Court decisions (G.R. numbers, case names, dates).
 * TODO: Paginated list from legal_sources where type = 'jurisprudence'
 * TODO: Search by G.R. number, party names, keywords
 * TODO: Filter by court division, date range, legal topic
 */
export default function JurisprudencePage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Jurisprudence Library</h1>
      <p className="text-muted-foreground text-sm">Supreme Court decisions and case law.</p>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(client)/legal-research/jurisprudence/page.tsx</code>
        <br />TODO: Case list with G.R. numbers, search, date/topic filters
      </div>
    </main>
  );
}
