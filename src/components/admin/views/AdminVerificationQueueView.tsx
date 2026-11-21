import { LawyerVerificationQueue, type LawyerQueueItem } from '@/components/admin/LawyerVerificationQueue';

export function AdminVerificationQueueView({ lawyers = [] }: { lawyers?: LawyerQueueItem[] }) {
  return (
    <div className="admin-page">
      <h1 className="sr-only">Lawyer verification queue</h1>
      <LawyerVerificationQueue lawyers={lawyers} />
    </div>
  );
}
