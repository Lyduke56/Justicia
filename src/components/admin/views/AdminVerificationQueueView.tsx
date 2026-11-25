import { LawyerVerificationQueue, type LawyerQueueItem } from '@/components/admin/LawyerVerificationQueue';

export function AdminVerificationQueueView({ lawyers = [] }: { lawyers?: LawyerQueueItem[] }) {
  // The queue lays out its own page (same margins as the client and lawyer screens).
  return <LawyerVerificationQueue lawyers={lawyers} />;
}
