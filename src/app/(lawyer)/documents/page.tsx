import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Documents' };

/**
 * Lawyer Documents
 * TODO: Fetch documents owned by this lawyer (documents table, owner_id = current user)
 * TODO: Upload documents to Supabase Storage "documents" bucket
 * TODO: Manage document_access_grants (share with specific clients)
 * TODO: Organize by case
 */
export default function LawyerDocumentsPage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Documents</h1>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(lawyer)/documents/page.tsx</code>
        <br />TODO: Document list, upload, access grants, case organization
      </div>
    </main>
  );
}
