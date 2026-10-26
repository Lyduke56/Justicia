/**
 * Supabase Database Types — extended for lawyer system
 * Hand-authored. Replace with generated types when ready.
 *   npx supabase gen types typescript --project-id <ID> > src/types/database.ts
 */

export type UserRole = 'client' | 'lawyer' | 'admin';
export type VerificationStatus = 'pending' | 'verified' | 'rejected';
export type LawyerVerificationStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'needs_resubmission';
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

export type UserAccountRow = {
  id: string;
  email: string;
  role: UserRole;
  full_name: string | null;
  verification_status: VerificationStatus;
  mfa_enabled: boolean;
  created_at: string;
};

export type LawyerProfileRow = {
  user_id: string;
  full_name: string;
  roll_number: string;
  ibp_chapter: string | null;
  about: string | null;
  practice_areas: string[] | null;
  languages: string[] | null;
  experience_years: number | null;
  photo_url: string | null;
  is_available: boolean;
  is_visible: boolean;
  bar_passer_year: number | null;
  fee_initial_30min: number | null;
  fee_standard_60min: number | null;
  fee_extended_120min: number | null;
  verification_status: LawyerVerificationStatus;
  admin_notes: string | null;
  rejection_reason: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LawyerPracticeAreaDetailRow = {
  id: string;
  lawyer_id: string;
  area: string;
  description: string | null;
  sort_order: number;
  created_at: string;
};

export type LawyerExperienceRow = {
  id: string;
  lawyer_id: string;
  title: string;
  organization: string | null;
  years: string | null;
  description: string | null;
  sort_order: number;
  created_at: string;
};

export type LawyerServiceRow = {
  id: string;
  lawyer_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
};

export type LawyerEducationRow = {
  id: string;
  lawyer_id: string;
  degree: string;
  school: string | null;
  start_year: number | null;
  end_year: number | null;
  description: string | null;
  sort_order: number;
  created_at: string;
};

export type LawyerCaseSummaryRow = {
  id: string;
  lawyer_id: string;
  title: string;
  practice_area: string | null;
  year: number | null;
  anonymized_summary: string;
  sort_order: number;
  created_at: string;
};

export type LawyerVerificationDocumentRow = {
  id: string;
  lawyer_id: string;
  doc_type: string;
  storage_path: string;
  uploaded_at: string;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  metadata: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
};

export type LawyerFavoriteRow = {
  client_id: string;
  lawyer_id: string;
  created_at: string;
};

export type AuditLogRow = {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

export type EmailOutboxDevRow = {
  id: string;
  to: string;
  subject: string;
  body: string;
  status: string;
  error: string | null;
  created_at: string;
};

export type LegalSourceRow = {
  id: string;
  title: string;
  citation: string;
  type: string;
  status: LegalSourceStatus;
  version: string | null;
  indexed_at: string;
  content: string | null;
};

export type ConversationRow = {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
};

export type MessageRow = {
  id: string;
  conversation_or_thread_id: string;
  sender_id: string;
  content: string;
  attachment_ids: string[] | null;
  sent_at: string;
  role: string | null;
  citations: Record<string, unknown>[] | null;
};

export type ConsultationRow = {
  id: string;
  client_id: string;
  lawyer_id: string;
  scheduled_time: string;
  method: ConsultationMethod;
  status: ConsultationStatus;
  concern_summary: string | null;
};

export type CaseRow = {
  id: string;
  client_id: string;
  lawyer_id: string;
  title: string;
  gr_number: string | null;
  text_content: string | null;
  citations: Record<string, unknown> | null;
  version_tag: string | null;
  status: string;
};

export type DocumentRow = {
  id: string;
  owner_id: string;
  case_id: string | null;
  filename: string;
  version: number;
  visibility_scope: string;
  uploaded_at: string;
};

export type ReviewRow = {
  id: string;
  client_id: string;
  lawyer_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Database shape (used as the generic param for createClient<Database>)
// ---------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      user_accounts: {
        Row: UserAccountRow;
        Insert: Omit<UserAccountRow, 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<UserAccountRow>;
        Relationships: [];
      };
      lawyer_profiles: {
        Row: LawyerProfileRow;
        Insert: Partial<Omit<LawyerProfileRow, 'created_at' | 'updated_at'>> & {
          user_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<LawyerProfileRow>;
        Relationships: [];
      };
      lawyer_practice_areas_detail: {
        Row: LawyerPracticeAreaDetailRow;
        Insert: Omit<LawyerPracticeAreaDetailRow, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<LawyerPracticeAreaDetailRow>;
        Relationships: [];
      };
      lawyer_experience: {
        Row: LawyerExperienceRow;
        Insert: Omit<LawyerExperienceRow, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<LawyerExperienceRow>;
        Relationships: [];
      };
      lawyer_services: {
        Row: LawyerServiceRow;
        Insert: Omit<LawyerServiceRow, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<LawyerServiceRow>;
        Relationships: [];
      };
      lawyer_education: {
        Row: LawyerEducationRow;
        Insert: Omit<LawyerEducationRow, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<LawyerEducationRow>;
        Relationships: [];
      };
      lawyer_case_summaries: {
        Row: LawyerCaseSummaryRow;
        Insert: Omit<LawyerCaseSummaryRow, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<LawyerCaseSummaryRow>;
        Relationships: [];
      };
      lawyer_verification_documents: {
        Row: LawyerVerificationDocumentRow;
        Insert: Omit<LawyerVerificationDocumentRow, 'id' | 'uploaded_at'> & { id?: string; uploaded_at?: string };
        Update: Partial<LawyerVerificationDocumentRow>;
        Relationships: [];
      };
      notifications: {
        Row: NotificationRow;
        Insert: Omit<NotificationRow, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<NotificationRow>;
        Relationships: [];
      };
      lawyer_favorites: {
        Row: LawyerFavoriteRow;
        Insert: Omit<LawyerFavoriteRow, 'created_at'> & { created_at?: string };
        Update: Partial<LawyerFavoriteRow>;
        Relationships: [];
      };
      audit_log: {
        Row: AuditLogRow;
        Insert: Omit<AuditLogRow, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<AuditLogRow>;
        Relationships: [];
      };
      email_outbox_dev: {
        Row: EmailOutboxDevRow;
        Insert: Omit<EmailOutboxDevRow, 'id' | 'created_at' | 'error'> & {
          id?: string;
          created_at?: string;
          error?: string | null;
        };
        Update: Partial<EmailOutboxDevRow>;
        Relationships: [];
      };
      legal_sources: {
        Row: LegalSourceRow;
        Insert: Omit<LegalSourceRow, 'id' | 'indexed_at'> & { id?: string; indexed_at?: string };
        Update: Partial<LegalSourceRow>;
        Relationships: [];
      };
      conversations: {
        Row: ConversationRow;
        Insert: Omit<ConversationRow, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<ConversationRow>;
        Relationships: [];
      };
      messages: {
        Row: MessageRow;
        Insert: Omit<MessageRow, 'id' | 'sent_at'> & { id?: string; sent_at?: string };
        Update: Partial<MessageRow>;
        Relationships: [];
      };
      consultations: {
        Row: ConsultationRow;
        Insert: Omit<ConsultationRow, 'id'> & { id?: string };
        Update: Partial<ConsultationRow>;
        Relationships: [];
      };
      cases: {
        Row: CaseRow;
        Insert: Omit<CaseRow, 'id'> & { id?: string };
        Update: Partial<CaseRow>;
        Relationships: [];
      };
      documents: {
        Row: DocumentRow;
        Insert: Omit<DocumentRow, 'id' | 'uploaded_at'> & { id?: string; uploaded_at?: string };
        Update: Partial<DocumentRow>;
        Relationships: [];
      };
      reviews: {
        Row: ReviewRow;
        Insert: Omit<ReviewRow, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<ReviewRow>;
        Relationships: [];
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
