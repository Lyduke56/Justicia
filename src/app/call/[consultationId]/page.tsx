import type { Metadata } from 'next';
import { ConsultationCallScreen } from '@/components/call/ConsultationCallScreen';

export const metadata: Metadata = { title: 'Consultation Call' };

/**
 * In-app consultation call for the client and the lawyer of a confirmed booking. The proxy only
 * lets signed-in clients and lawyers in; the call actions check that the viewer is one of the
 * two participants and that the join window is open.
 */
export default async function ConsultationCallPage({ params }: { params: Promise<{ consultationId: string }> }) {
  const { consultationId } = await params;
  return <ConsultationCallScreen consultationId={consultationId} />;
}
