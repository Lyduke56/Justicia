import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Case' };
interface Props { params: Promise<{ caseId: string }> }

/**
 * Lawyer Case Detail
 * TODO: Edit case: title, gr_number, text_content, citations, status, version_tag
 * TODO: Linked documents (documents table, case_id = this case)
 * TODO: Upload case documents
 * TODO: Version history (increment version_tag on save)
 * TODO: Client read access via document_access_grants
 */
export default async function LawyerCaseDetailPage({ params }: Props) {
  const { caseId } = await params;
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Case</h1>
      <p className="text-xs text-muted-foreground font-mono">{caseId}</p>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(lawyer)/cases/[caseId]/page.tsx</code>
      </div>
    </main>
  );
}
