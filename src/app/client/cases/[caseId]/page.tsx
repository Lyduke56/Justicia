import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Case Details' };

interface Props { params: Promise<{ caseId: string }> }

/**
 * Case Detail View
 * TODO: Fetch case by id (verify client_id = current user via RLS)
 * TODO: Show case text_content with citations rendering
 * TODO: Version history (version_tag)
 * TODO: Associated documents list (from documents table, case_id = this case)
 * TODO: AI analysis CTA
 */
export default async function CaseDetailPage({ params }: Props) {
  const { caseId } = await params;
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Case Details</h1>
      <p className="text-xs text-muted-foreground font-mono">{caseId}</p>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(client)/cases/[caseId]/page.tsx</code>
        <br />TODO: Case text, citations, version history, linked documents
      </div>
    </main>
  );
}
