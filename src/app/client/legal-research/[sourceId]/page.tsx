import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Legal Document' };

interface Props {
  params: Promise<{ sourceId: string }>;
}

/**
 * Legal Source Document Reader
 * Displays the full text of a legal source (statute, decision, etc.)
 * TODO: Fetch from legal_sources table by sourceId
 * TODO: Render formatted text with section navigation (table of contents)
 * TODO: Highlight + copy citation button
 * TODO: "Ask AI about this" CTA linking to ai-assistant with pre-filled context
 * TODO: Show version history and status (active/outdated/superseded)
 */
export default async function LegalSourcePage({ params }: Props) {
  const { sourceId } = await params;
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Legal Source</h1>
      <p className="text-xs text-muted-foreground font-mono">{sourceId}</p>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(client)/legal-research/[sourceId]/page.tsx</code>
        <br />TODO: Full text reader, TOC, citation copy, Ask AI CTA
      </div>
    </main>
  );
}
