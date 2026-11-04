import type { UserRole } from '@/types/database';

export interface AdminUserAccount {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface AdminAuditEntry {
  id: string;
  timestamp: string;
  actor: {
    id: string;
    name: string;
    email: string;
  };
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, unknown>;
}
