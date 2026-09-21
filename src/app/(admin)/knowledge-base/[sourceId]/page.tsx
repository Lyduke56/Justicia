import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Legal Source' };
interface Props { params: Promise<{ sourceId: string }> }

/**
 * Legal Source Detail (Admin)
 * TODO: Edit source metadata (title, citation, type, status, version)
 * TODO: View full text / embedded chunks
 * TODO: Trigger re-embed
 * TODO: Version history
 */
export default async function AdminSourceDetailPage({ params }: Props) {
  const { sourceId } = await params;
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Legal Source</h1>
      <p className="text-xs text-muted-foreground font-mono">{sourceId}</p>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(admin)/knowledge-base/[sourceId]/page.tsx</code>
      </div>
    </main>
  );
}
