/**
 * Supabase Database Types
 *
 * Hand-authored typed schema matching supabase/migrations/0001_init.sql.
 * TODO: Replace with auto-generated types via:
 *   npx supabase gen types typescript --project-id <PROJECT_ID> > src/types/database.ts
 */

export type UserRole = 'client' | 'lawyer' | 'admin';
export type VerificationStatus = 'pending' | 'verified' | 'rejected';
export type LegalSourceStatus = 'active' | 'outdated' | 'superseded';
export type ConsultationMethod = 'video' | 'audio';
export type ConsultationStatus =
  | 'pending'
  | 'confirmed'
  | 'awaiting_client_confirmation'
  | 'declined'
  | 'completed'
  | 'cancelled';
export type NotificationChannel = 'in_app' | 'email';

// ---------------------------------------------------------------------------
// Row types (what you get back from SELECT)
// ---------------------------------------------------------------------------

export interface UserAccountRow {
  id: string;
  email: string;
  role: UserRole;
  verification_status: VerificationStatus;
  mfa_enabled: boolean;
  created_at: string;
}

export interface LawyerProfileRow {
  lawyer_id: string; // FK -> user_accounts.id
  verification_status: VerificationStatus;
  bio: string | null;
  practice_areas: string[] | null;
  hourly_rate: number | null;
  consultation_fees: Record<string, unknown> | null; // jsonb
  availability_schedule: Record<string, unknown> | null; // jsonb
  languages: string[] | null;
  location: string | null;
  credentials: Record<string, unknown> | null; // jsonb
}

export interface LegalSourceRow {
  id: string;
  title: string;
  citation: string;
  type: string;
  status: LegalSourceStatus;
  version: string | null;
  indexed_at: string;
}

export interface ConversationRow {
  id: string;
  user_id: string; // FK -> user_accounts.id
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: string;
  conversation_or_thread_id: string;
  sender_id: string; // FK -> user_accounts.id
  content: string;
  attachment_ids: string[] | null;
  sent_at: string;
}

export interface ConsultationRow {
  id: string;
  client_id: string; // FK -> user_accounts.id
  lawyer_id: string; // FK -> user_accounts.id
  scheduled_time: string;
  method: ConsultationMethod;
  status: ConsultationStatus;
  concern_summary: string | null;
}

export interface CaseRow {
  id: string;
  client_id: string; // FK -> user_accounts.id
  lawyer_id: string; // FK -> user_accounts.id
  title: string;
  gr_number: string | null;
  text_content: string | null;
  citations: Record<string, unknown> | null; // jsonb
  version_tag: string | null;
  status: string;
}

export interface DocumentRow {
  id: string;
  owner_id: string; // FK -> user_accounts.id
  case_id: string | null; // FK -> cases.id (nullable)
  filename: string;
  version: number;
  visibility_scope: string;
  uploaded_at: string;
}

export interface DocumentAccessGrantRow {
  document_id: string; // FK -> documents.id
  grantee_id: string; // FK -> user_accounts.id
  access_level: string;
}

export interface ReviewRow {
  id: string;
  client_id: string; // FK -> user_accounts.id
  lawyer_id: string; // FK -> user_accounts.id
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface ReportRow {
  id: string;
  reporter_id: string; // FK -> user_accounts.id
  target_type: string;
  target_id: string;
  reason: string;
  status: string;
  resolution_notes: string | null;
}

export interface PaymentRow {
  id: string;
  consultation_id: string; // FK -> consultations.id
  payer_id: string; // FK -> user_accounts.id
  payee_id: string; // FK -> user_accounts.id
  amount: number;
  status: string;
  masked_card_last4: string | null;
}

export interface NotificationRow {
  id: string;
  user_id: string; // FK -> user_accounts.id
  type: string;
  channel: NotificationChannel;
  read_status: boolean;
  created_at: string;
}

export interface SupportTicketRow {
  id: string;
  submitter_id: string; // FK -> user_accounts.id
  category: string;
  status: string;
  assigned_admin_id: string | null; // FK -> user_accounts.id
  created_at: string;
}

export interface AuditLogEntryRow {
  id: string;
  actor_id: string; // FK -> user_accounts.id
  actor_role: UserRole;
  action: string;
  target_type: string;
  target_id: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Database shape (used as the generic param for createClient<Database>)
// ---------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      user_accounts: {
        Row: UserAccountRow;
        Insert: Omit<UserAccountRow, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<UserAccountRow>;
      };
      lawyer_profiles: {
        Row: LawyerProfileRow;
        Insert: LawyerProfileRow;
        Update: Partial<LawyerProfileRow>;
      };
      legal_sources: {
        Row: LegalSourceRow;
        Insert: Omit<LegalSourceRow, 'id' | 'indexed_at'> & { id?: string; indexed_at?: string };
        Update: Partial<LegalSourceRow>;
      };
      conversations: {
        Row: ConversationRow;
        Insert: Omit<ConversationRow, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<ConversationRow>;
      };
      messages: {
        Row: MessageRow;
        Insert: Omit<MessageRow, 'id' | 'sent_at'> & { id?: string; sent_at?: string };
        Update: Partial<MessageRow>;
      };
      consultations: {
        Row: ConsultationRow;
        Insert: Omit<ConsultationRow, 'id'> & { id?: string };
        Update: Partial<ConsultationRow>;
      };
      cases: {
        Row: CaseRow;
        Insert: Omit<CaseRow, 'id'> & { id?: string };
        Update: Partial<CaseRow>;
      };
      documents: {
        Row: DocumentRow;
        Insert: Omit<DocumentRow, 'id' | 'uploaded_at'> & { id?: string; uploaded_at?: string };
        Update: Partial<DocumentRow>;
      };
      document_access_grants: {
        Row: DocumentAccessGrantRow;
        Insert: DocumentAccessGrantRow;
        Update: Partial<DocumentAccessGrantRow>;
      };
      reviews: {
        Row: ReviewRow;
        Insert: Omit<ReviewRow, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<ReviewRow>;
      };
      reports: {
        Row: ReportRow;
        Insert: Omit<ReportRow, 'id'> & { id?: string };
        Update: Partial<ReportRow>;
      };
      payments: {
        Row: PaymentRow;
        Insert: Omit<PaymentRow, 'id'> & { id?: string };
        Update: Partial<PaymentRow>;
      };
      notifications: {
        Row: NotificationRow;
        Insert: Omit<NotificationRow, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<NotificationRow>;
      };
      support_tickets: {
        Row: SupportTicketRow;
        Insert: Omit<SupportTicketRow, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<SupportTicketRow>;
      };
      audit_log_entries: {
        Row: AuditLogEntryRow;
        Insert: Omit<AuditLogEntryRow, 'id'> & { id?: string };
        Update: Partial<AuditLogEntryRow>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      verification_status: VerificationStatus;
      legal_source_status: LegalSourceStatus;
      consultation_method: ConsultationMethod;
      consultation_status: ConsultationStatus;
      notification_channel: NotificationChannel;
    };
  };
}
