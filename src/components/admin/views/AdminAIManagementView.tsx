import { AdminFeatureStatus } from '@/components/admin/AdminFeatureStatus';
import { SparklesIcon } from '@/components/admin/AdminIcons';

export function AdminAIManagementView() {
  return <AdminFeatureStatus
    eyebrow="Administration"
    title="AI management"
    description="The assistant is configured in application code. Administrative controls for its behavior are not connected yet."
    icon={<SparklesIcon className="h-6 w-6" />}
    items={['Review actual assistant usage and errors.', 'Update model and prompt settings with a saved audit trail.', 'Manage escalation rules and test changes before publishing.']}
  />;
}
