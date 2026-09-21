import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'My Documents' };

/**
 * Documents
 * Manage personal and case-related documents.
 * TODO: Fetch documents where owner_id = current user (from Supabase Storage + documents table)
 * TODO: Upload new document (POST to Supabase Storage "documents" bucket → insert documents row)
 * TODO: Show: filename, version, visibility_scope, case linkage, uploaded_at
 * TODO: Document access grants management (share with lawyer)
 * TODO: Download / preview documents
 * TODO: Version history per document
 */
export default function DocumentsPage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">My Documents</h1>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(client)/documents/page.tsx</code>
        <br />TODO: Document list, upload, access grants, versioning
      </div>
    </main>
  );
}
