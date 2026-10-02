import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Message Thread' };
interface Props { params: Promise<{ threadId: string }> }

/**
 * Lawyer Message Thread
 * TODO: Same thread view as client but from lawyer perspective
 */
export default async function LawyerThreadPage({ params }: Props) {
  const { threadId } = await params;
  return (
    <main className="flex flex-col h-screen p-6 space-y-4">
      <h1 className="text-xl font-semibold">Message Thread</h1>
      <p className="text-xs text-muted-foreground font-mono">{threadId}</p>
      <div className="flex-1 rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(lawyer)/messages/[threadId]/page.tsx</code>
      </div>
    </main>
  );
}
