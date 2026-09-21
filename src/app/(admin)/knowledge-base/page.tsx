import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Knowledge Base' };

/**
 * Legal Knowledge Base Management
 * Source list, indexing status, and versioning.
 * TODO: Fetch legal_sources list (all, paginated)
 * TODO: Filter by type, status (active/outdated/superseded)
 * TODO: Add new source (upload document → trigger ingestion pipeline)
 * TODO: Update source status (mark as superseded)
 * TODO: Show indexed_at, version, embedding status
 * TODO: Trigger re-index for a source
 */
export default function KnowledgeBasePage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Legal Knowledge Base</h1>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(admin)/knowledge-base/page.tsx</code>
        <br />TODO: Source list, status filters, add/update source, trigger re-index
      </div>
    </main>
  );
}
