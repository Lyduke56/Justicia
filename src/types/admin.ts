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

// ─── Account reports (admin Reports tab) ────────────────────────────────────

export type AdminReportStatus = 'open' | 'under_review' | 'resolved' | 'dismissed' | 'appealed';
export type AdminAccountStatus = 'active' | 'suspended' | 'terminated' | 'pending_deletion';
export type AdminModerationDecision = 'suspension' | 'termination' | 'no_action' | 'warning' | 'content_removed';

export interface AdminReportPerson {
  id: string;
  name: string;
  email: string;
  role: UserRole | 'unknown';
}

export interface AdminReportedAccount extends AdminReportPerson {
  accountStatus: AdminAccountStatus;
  /** ISO end of the current suspension, when suspended. */
  suspendedUntil: string | null;
  /** Upheld suspensions on record (max 3; the next upheld report terminates the account). */
  suspensionCount: number;
  /** Reports against this account that still need a decision. */
  openReportCount: number;
  totalReportCount: number;
}

export interface AdminReportEvidenceFile {
  path: string;
  name: string;
  kind: 'image' | 'pdf' | 'conversation' | 'file';
}

export interface AdminReportItem {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: AdminReportStatus;
  category: string;
  reasonLabel: string;
  details: string;
  reporter: AdminReportPerson;
  target: AdminReportedAccount;
  evidence: AdminReportEvidenceFile[];
  resolution: {
    action: AdminModerationDecision;
    notes: string;
    resolvedAt: string | null;
    adminName: string;
  } | null;
}

export interface AdminReportConversationMessage {
  id: string;
  from: 'reporter' | 'reported' | 'system';
  content: string;
  sentAt: string;
}

export interface AdminReportEvidence {
  files: Array<AdminReportEvidenceFile & { url: string | null }>;
  conversation: AdminReportConversationMessage[] | null;
}
