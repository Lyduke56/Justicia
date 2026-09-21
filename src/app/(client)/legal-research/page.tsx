import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Legal Research' };

/**
 * Legal Research — Search & Browse Landing
 *
 * Entry point for browsing and searching Philippine legal sources
 * (statutes, codal provisions, Supreme Court decisions, IRRs, etc.)
 *
 * TODO: Full-text search against legal_sources table
 * TODO: Filter by type (statute, jurisprudence, administrative issuance)
 * TODO: Filter by status (active, outdated, superseded)
 * TODO: Show recently indexed sources
 * TODO: Link to /legal-research/laws and /legal-research/jurisprudence sub-sections
 */
export default function LegalResearchPage() {
  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Legal Research</h1>
      <p className="text-muted-foreground text-sm">
        Search and browse Philippine statutes, codal provisions, and Supreme Court decisions.
      </p>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <strong>Scaffold placeholder</strong> — <code>src/app/(client)/legal-research/page.tsx</code>
        <br />
        TODO: Search bar, type/status filters, featured categories
      </div>
    </main>
  );
}
