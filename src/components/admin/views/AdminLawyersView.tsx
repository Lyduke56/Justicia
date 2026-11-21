import { LawyerDirectoryTable, type LawyerDirectoryItem } from '@/components/admin/LawyerDirectoryTable';

export function AdminLawyersView({ lawyers = [] }: { lawyers?: LawyerDirectoryItem[] }) {
  return (
    <div className="admin-page">
      <h1 className="sr-only">Lawyer directory</h1>
      <LawyerDirectoryTable lawyers={lawyers} />
    </div>
  );
}
