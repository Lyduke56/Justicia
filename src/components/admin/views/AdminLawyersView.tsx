import { LawyerDirectoryTable, type LawyerDirectoryItem } from '@/components/admin/LawyerDirectoryTable';

export function AdminLawyersView({ lawyers = [] }: { lawyers?: LawyerDirectoryItem[] }) {
  // The directory lays out its own page (same margins as the client and lawyer screens).
  return <LawyerDirectoryTable lawyers={lawyers} />;
}
