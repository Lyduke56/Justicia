/**
 * Admin Mock Data & Types
 * Comprehensive datasets for the Justicia Admin Portal frontend interface.
 * Represents realistic Philippine legal operations, user accounts, RAG pipeline, and audit trails.
 */

export interface AdminUserAccount {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  role: 'client' | 'lawyer' | 'admin';
  status: 'active' | 'suspended' | 'unverified';
  mfaEnabled: boolean;
  avatarUrl?: string;
  location: string;
  casesCount: number;
  consultationsCount: number;
  createdAt: string;
  lastActiveAt: string;
}

export interface AdminAuditEntry {
  id: string;
  timestamp: string;
  actor: {
    id: string;
    name: string;
    role: 'admin' | 'lawyer' | 'client' | 'system';
    email: string;
  };
  action: string;
  category: 'auth' | 'lawyer_verification' | 'user_management' | 'knowledge_base' | 'ai_config' | 'financial';
  severity: 'low' | 'medium' | 'high' | 'critical';
  targetType: string;
  targetId: string;
  ipAddress: string;
  details: Record<string, unknown>;
}

export interface AdminKnowledgeSource {
  id: string;
  citationId: string;
  title: string;
  category: 'Supreme Court Decision' | 'Republic Act' | 'Civil & Penal Code' | 'Rules of Court' | 'Executive Order' | 'DOJ Circular';
  promulgationDate: string;
  lastIndexedAt: string;
  version: string;
  status: 'indexed' | 'indexing' | 'superseded' | 'queued';
  totalChunks: number;
  fileSizeBytes: number;
  fileFormat: 'PDF' | 'DOCX' | 'TXT';
  tags: string[];
  summary: string;
}

export interface AdminAIConfig {
  assistantEnabled: boolean;
  activeModel: string;
  temperature: number;
  similarityThreshold: number;
  topK: number;
  maxTokens: number;
  systemPrompt: string;
  disclaimerText: string;
  escalationKeywords: string[];
  autoEscalationEnabled: boolean;
}

export interface AdminAISampleQuery {
  id: string;
  timestamp: string;
  userQuery: string;
  matchedCitations: string[];
  confidenceScore: number;
  escalatedToHuman: boolean;
  userRating?: 'helpful' | 'unhelpful';
  flaggedForReview: boolean;
  flagReason?: string;
}

export interface AdminSystemSettings {
  platformName: string;
  contactEmail: string;
  hotline: string;
  maintenanceMode: boolean;
  maintenanceNotice: string;
  consultationFeeMin: number;
  consultationFeeMax: number;
  platformCommissionPercent: number;
  freeTrialConsultationsAllowed: number;
  requireMfaForAdmins: boolean;
  sessionTimeoutMinutes: number;
  maxFailedLoginsBeforeLock: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. MOCK USER ACCOUNTS
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_ADMIN_USERS: AdminUserAccount[] = [
  {
    id: 'usr-cl-01',
    fullName: 'Clyde Justine Rosal',
    email: 'clyde@justicia.ph',
    phone: '+63 917 555 0101',
    role: 'client',
    status: 'active',
    mfaEnabled: true,
    location: 'Makati City, Metro Manila',
    casesCount: 3,
    consultationsCount: 5,
    createdAt: '2026-08-15T09:20:00Z',
    lastActiveAt: '2026-10-30T13:05:00Z',
  },
  {
    id: 'usr-lw-02',
    fullName: 'Atty. Maria Clara Santos',
    email: 'atty.santos@santoslaw.ph',
    phone: '+63 918 888 2304',
    role: 'lawyer',
    status: 'active',
    mfaEnabled: true,
    location: 'Ortigas Center, Pasig City',
    casesCount: 14,
    consultationsCount: 38,
    createdAt: '2026-07-02T11:45:00Z',
    lastActiveAt: '2026-10-30T12:50:00Z',
  },
  {
    id: 'usr-lw-03',
    fullName: 'Atty. Jose Maria De Leon',
    email: 'jm.deleon@dlexlaw.ph',
    phone: '+63 920 345 6789',
    role: 'lawyer',
    status: 'active',
    mfaEnabled: false,
    location: 'Cebu City, Central Visayas',
    casesCount: 8,
    consultationsCount: 19,
    createdAt: '2026-07-20T14:10:00Z',
    lastActiveAt: '2026-10-29T16:20:00Z',
  },
  {
    id: 'usr-ad-01',
    fullName: 'Atty. Eleanor Vance (System Admin)',
    email: 'admin@justicia.ph',
    phone: '+63 917 111 9999',
    role: 'admin',
    status: 'active',
    mfaEnabled: true,
    location: 'Taguig, Bonifacio Global City',
    casesCount: 0,
    consultationsCount: 0,
    createdAt: '2026-01-10T08:00:00Z',
    lastActiveAt: '2026-10-30T13:12:00Z',
  },
  {
    id: 'usr-cl-04',
    fullName: 'Bianca Ramos-Tan',
    email: 'bianca.tan@gmail.com',
    phone: '+63 922 777 4411',
    role: 'client',
    status: 'active',
    mfaEnabled: false,
    location: 'Davao City, Davao del Sur',
    casesCount: 1,
    consultationsCount: 2,
    createdAt: '2026-09-04T10:15:00Z',
    lastActiveAt: '2026-10-28T09:40:00Z',
  },
  {
    id: 'usr-lw-05',
    fullName: 'Atty. Ramon M. Bautista',
    email: 'bautista.counsel@gmail.com',
    phone: '+63 919 456 7812',
    role: 'lawyer',
    status: 'unverified',
    mfaEnabled: false,
    location: 'Quezon City, Metro Manila',
    casesCount: 0,
    consultationsCount: 0,
    createdAt: '2026-10-29T18:00:00Z',
    lastActiveAt: '2026-10-30T04:12:00Z',
  },
  {
    id: 'usr-cl-06',
    fullName: 'Fernando Alcantara',
    email: 'fernando.alcantara@outlook.com',
    phone: '+63 916 234 5678',
    role: 'client',
    status: 'suspended',
    mfaEnabled: false,
    location: 'Iloilo City, Western Visayas',
    casesCount: 0,
    consultationsCount: 1,
    createdAt: '2026-08-30T16:30:00Z',
    lastActiveAt: '2026-10-15T08:11:00Z',
  },
  {
    id: 'usr-ad-02',
    fullName: 'Mark Angelo Villanueva (Compliance Officer)',
    email: 'compliance@justicia.ph',
    phone: '+63 917 222 3344',
    role: 'admin',
    status: 'active',
    mfaEnabled: true,
    location: 'Mandaluyong City, Metro Manila',
    casesCount: 0,
    consultationsCount: 0,
    createdAt: '2026-03-12T09:00:00Z',
    lastActiveAt: '2026-10-30T11:20:00Z',
  },
  {
    id: 'usr-cl-07',
    fullName: 'Kristine Joy Mendoza',
    email: 'kj.mendoza@yahoo.com',
    phone: '+63 928 987 6543',
    role: 'client',
    status: 'active',
    mfaEnabled: true,
    location: 'Baguio City, Benguet',
    casesCount: 2,
    consultationsCount: 3,
    createdAt: '2026-09-18T13:22:00Z',
    lastActiveAt: '2026-10-30T07:15:00Z',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 2. MOCK SECURITY AUDIT LOG ENTRIES
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_ADMIN_AUDIT_LOGS: AdminAuditEntry[] = [
  {
    id: 'aud-8891',
    timestamp: '2026-10-30T12:45:10Z',
    actor: {
      id: 'usr-ad-01',
      name: 'Atty. Eleanor Vance',
      role: 'admin',
      email: 'admin@justicia.ph',
    },
    action: 'lawyer.verification.approved',
    category: 'lawyer_verification',
    severity: 'medium',
    targetType: 'lawyer_profile',
    targetId: 'usr-lw-02',
    ipAddress: '120.28.184.22 (BGC, Taguig)',
    details: {
      lawyer_name: 'Atty. Maria Clara Santos',
      roll_number: '54821',
      ibp_chapter: 'Pasig-San Juan-Mandaluyong',
      decision: 'approved',
    },
  },
  {
    id: 'aud-8890',
    timestamp: '2026-10-30T11:30:25Z',
    actor: {
      id: 'usr-ad-02',
      name: 'Mark Angelo Villanueva',
      role: 'admin',
      email: 'compliance@justicia.ph',
    },
    action: 'ai.prompt_updated',
    category: 'ai_config',
    severity: 'high',
    targetType: 'ai_settings',
    targetId: 'cfg-gemini-legal',
    ipAddress: '112.198.114.65 (Mandaluyong City)',
    details: {
      model: 'gemini-3.8-flash',
      param_changed: 'similarity_threshold',
      old_value: 0.70,
      new_value: 0.75,
      reason: 'Reduced hallucination margin on Labor Code citations',
    },
  },
  {
    id: 'aud-8889',
    timestamp: '2026-10-30T10:14:00Z',
    actor: {
      id: 'usr-cl-06',
      name: 'Fernando Alcantara',
      role: 'client',
      email: 'fernando.alcantara@outlook.com',
    },
    action: 'auth.failed_login_burst',
    category: 'auth',
    severity: 'critical',
    targetType: 'user_account',
    targetId: 'usr-cl-06',
    ipAddress: '49.144.18.90 (Iloilo City)',
    details: {
      attempts: 6,
      lockoutDurationMinutes: 15,
      autoSuspended: true,
      reason: 'Repeated bad credentials triggered anti-brute force policy',
    },
  },
  {
    id: 'aud-8888',
    timestamp: '2026-10-30T08:52:19Z',
    actor: {
      id: 'usr-ad-01',
      name: 'Atty. Eleanor Vance',
      role: 'admin',
      email: 'admin@justicia.ph',
    },
    action: 'knowledge_base.document_ingested',
    category: 'knowledge_base',
    severity: 'low',
    targetType: 'legal_source',
    targetId: 'src-ra-11996',
    ipAddress: '120.28.184.22 (BGC, Taguig)',
    details: {
      title: 'Republic Act No. 11996 (Eddie Garcia Law)',
      total_chunks: 142,
      embedding_dim: 768,
      vector_table: 'legal_corpus_embeddings',
    },
  },
  {
    id: 'aud-8887',
    timestamp: '2026-10-29T19:40:02Z',
    actor: {
      id: 'usr-ad-01',
      name: 'Atty. Eleanor Vance',
      role: 'admin',
      email: 'admin@justicia.ph',
    },
    action: 'lawyer.verification.needs_resubmission',
    category: 'lawyer_verification',
    severity: 'medium',
    targetType: 'lawyer_profile',
    targetId: 'usr-lw-05',
    ipAddress: '120.28.184.22 (BGC, Taguig)',
    details: {
      lawyer_name: 'Atty. Ramon M. Bautista',
      roll_number: '61209',
      notes: 'Please attach updated 2026 IBP Chapter Official Receipt or Certificate of Good Standing.',
    },
  },
  {
    id: 'aud-8886',
    timestamp: '2026-10-29T15:22:45Z',
    actor: {
      id: 'usr-sys',
      name: 'Automated System Monitor',
      role: 'system',
      email: 'system@justicia.ph',
    },
    action: 'financial.consultation_escrow_released',
    category: 'financial',
    severity: 'low',
    targetType: 'consultation_payment',
    targetId: 'pay-cs-9821',
    ipAddress: '10.0.4.12 (Internal AWS/Supabase)',
    details: {
      consultation_id: 'c-3810',
      client_id: 'usr-cl-01',
      lawyer_id: 'usr-lw-02',
      amount_php: 2500,
      fee_deducted_php: 250,
      payout_status: 'completed',
    },
  },
  {
    id: 'aud-8885',
    timestamp: '2026-10-29T12:05:10Z',
    actor: {
      id: 'usr-cl-07',
      name: 'Kristine Joy Mendoza',
      role: 'client',
      email: 'kj.mendoza@yahoo.com',
    },
    action: 'auth.mfa_enabled',
    category: 'auth',
    severity: 'low',
    targetType: 'user_account',
    targetId: 'usr-cl-07',
    ipAddress: '119.93.20.140 (Baguio City)',
    details: {
      mfa_type: 'TOTP',
      app: 'Google Authenticator',
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 3. MOCK KNOWLEDGE BASE SOURCES
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_ADMIN_KNOWLEDGE_SOURCES: AdminKnowledgeSource[] = [
  {
    id: 'src-ra-386',
    citationId: 'RA 386 / Civil Code',
    title: 'Civil Code of the Philippines (Republic Act No. 386)',
    category: 'Civil & Penal Code',
    promulgationDate: '1949-06-18',
    lastIndexedAt: '2026-10-15T04:20:00Z',
    version: '2026.1-consolidated',
    status: 'indexed',
    totalChunks: 2140,
    fileSizeBytes: 4890000,
    fileFormat: 'PDF',
    tags: ['Obligations & Contracts', 'Property', 'Succession', 'Torts'],
    summary: 'Primary substantive civil law framework governing contracts, family relations, property title transfers, and damages in the Philippines.',
  },
  {
    id: 'src-sc-gr-234142',
    citationId: 'G.R. No. 234142',
    title: 'Tan-Andal v. Andal (Psychological Incapacity Standards)',
    category: 'Supreme Court Decision',
    promulgationDate: '2021-05-11',
    lastIndexedAt: '2026-10-22T08:00:00Z',
    version: 'En Banc Landmark',
    status: 'indexed',
    totalChunks: 188,
    fileSizeBytes: 620000,
    fileFormat: 'PDF',
    tags: ['Article 36', 'Family Code', 'Nullity of Marriage', 'Psychological Incapacity'],
    summary: 'Landmark En Banc jurisprudence redefining psychological incapacity under Art. 36 of Family Code as legal rather than strictly medical/psychiatric illness.',
  },
  {
    id: 'src-pd-442',
    citationId: 'PD 442 / Labor Code',
    title: 'Labor Code of the Philippines (Presidential Decree No. 442, As Amended)',
    category: 'Republic Act',
    promulgationDate: '1974-05-01',
    lastIndexedAt: '2026-10-18T14:10:00Z',
    version: '2026.3-DOLE-updated',
    status: 'indexed',
    totalChunks: 1420,
    fileSizeBytes: 3450000,
    fileFormat: 'PDF',
    tags: ['Labor Standards', 'Illegal Dismissal', 'Severance Pay', 'NLRC Procedures'],
    summary: 'Codified labor laws governing employment contracts, employer-employee relationships, just & authorized causes for termination, and dispute resolution.',
  },
  {
    id: 'src-sc-am-19-10-20',
    citationId: 'A.M. No. 19-10-20-SC',
    title: '2019 Proposed Amendments to the 1997 Rules of Civil Procedure',
    category: 'Rules of Court',
    promulgationDate: '2019-10-15',
    lastIndexedAt: '2026-10-25T11:30:00Z',
    version: 'Effective May 1, 2020',
    status: 'indexed',
    totalChunks: 890,
    fileSizeBytes: 2100000,
    fileFormat: 'PDF',
    tags: ['Rules of Court', 'Pleadings', 'Service of Summons', 'Pre-Trial'],
    summary: 'Comprehensive procedural rules governing civil actions in first and second level courts in the Philippines, including electronic filing and video conference hearings.',
  },
  {
    id: 'src-ra-11996',
    citationId: 'RA 11996',
    title: 'Eddie Garcia Law (Protection of Workers in Movie and Television Industry)',
    category: 'Republic Act',
    promulgationDate: '2024-05-24',
    lastIndexedAt: '2026-10-30T08:52:00Z',
    version: '1.0-IRR-pending',
    status: 'indexed',
    totalChunks: 142,
    fileSizeBytes: 410000,
    fileFormat: 'PDF',
    tags: ['Entertainment Law', 'Working Hours', 'Occupational Safety', 'Independent Contractors'],
    summary: 'Protects film and television production industry workers, mandating humane working hours, emergency insurance coverage, and formal contracting standards.',
  },
  {
    id: 'src-ra-10173',
    citationId: 'RA 10173 / DPA',
    title: 'Data Privacy Act of 2012 (Republic Act No. 10173)',
    category: 'Republic Act',
    promulgationDate: '2012-08-15',
    lastIndexedAt: '2026-10-12T03:00:00Z',
    version: 'NPC Circular 2023-compliant',
    status: 'indexed',
    totalChunks: 310,
    fileSizeBytes: 890000,
    fileFormat: 'PDF',
    tags: ['NPC', 'Privacy Compliance', 'Data Subject Rights', 'Breach Notifications'],
    summary: 'Governs processing of all personal data, obligations of personal information controllers, and rights of Philippine data subjects.',
  },
  {
    id: 'src-sc-am-22-04-05',
    citationId: 'A.M. No. 22-04-05-SC',
    title: 'Code of Professional Responsibility and Accountability (CPRA)',
    category: 'Rules of Court',
    promulgationDate: '2023-04-11',
    lastIndexedAt: '2026-10-20T09:15:00Z',
    version: 'Enacted April 2023',
    status: 'indexed',
    totalChunks: 220,
    fileSizeBytes: 540000,
    fileFormat: 'PDF',
    tags: ['Ethics', 'Lawyer Conduct', 'Social Media Guidelines', 'Client Funds'],
    summary: 'Modernized judicial ethical code for Philippine attorneys, establishing strict guidelines for social media conduct, conflict of interest, and fiduciary duties.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 4. MOCK AI MANAGEMENT CONFIG & SAMPLES
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_ADMIN_AI_CONFIG: AdminAIConfig = {
  assistantEnabled: true,
  activeModel: 'Google Gemini 3.8 Flash (High-Fidelity Legal Reasoning)',
  temperature: 0.2,
  similarityThreshold: 0.75,
  topK: 5,
  maxTokens: 2048,
  systemPrompt: `You are Justicia AI, a specialized Philippine Legal Intelligence Assistant developed strictly for informative and research guidance.
You provide clear, accurate, and objective summaries of Philippine statutes (Republic Acts, Civil Code, Revised Penal Code, Labor Code) and Supreme Court jurisprudence.

Core Guidelines:
1. Ground every claim on verifiable Philippine law or Supreme Court decisions.
2. Quote exact article numbers or G.R. docket numbers when available.
3. NEVER provide definitive formal legal representation or tell a user "you have won your case."
4. If a scenario involves imminent physical danger, criminal arrest, or complex litigation, trigger the consultation referral protocol to a verified Philippine attorney.
5. Always append the mandatory Justicia Legal Disclaimer.`,
  disclaimerText: 'Paalala: Ang impormasyong ibinigay ng Justicia AI ay para sa pagsasaliksik at kaalamang legal lamang at hindi kapalit ng pormal na payong legal mula sa isang rehistradong abogado ng Integrated Bar of the Philippines.',
  escalationKeywords: [
    'kulong',
    'arrest warrant',
    'pulis',
    'physical abuse',
    'VAWC',
    'habeas corpus',
    'emergency injunction',
    'writ of amparo',
    'pending hearing tomorrow',
  ],
  autoEscalationEnabled: true,
};

export const MOCK_ADMIN_AI_QUERIES: AdminAISampleQuery[] = [
  {
    id: 'qry-1092',
    timestamp: '2026-10-30T12:55:00Z',
    userQuery: 'Puwede ba akong tanggalin sa trabaho nang walang separation pay kung na-retrench ang company?',
    matchedCitations: ['Labor Code Art. 298 (Authorized Causes)', 'DOLE D.O. 147-15'],
    confidenceScore: 0.94,
    escalatedToHuman: false,
    userRating: 'helpful',
    flaggedForReview: false,
  },
  {
    id: 'qry-1091',
    timestamp: '2026-10-30T11:40:12Z',
    userQuery: 'May hearing ako bukas ng umaga sa RTC Manila for ejectment, anong kailangan kong dalhin?',
    matchedCitations: ['A.M. No. 19-10-20-SC (Rules of Civil Procedure)', 'Rule 70 Forcible Entry'],
    confidenceScore: 0.72,
    escalatedToHuman: true,
    userRating: 'helpful',
    flaggedForReview: true,
    flagReason: 'Urgent hearing tomorrow; AI recommended immediate consultation booking with verified counsel.',
  },
  {
    id: 'qry-1090',
    timestamp: '2026-10-30T09:18:44Z',
    userQuery: 'Ano ang requirement para sa annulment dahil sa psychological incapacity pagkatapos ng Tan-Andal ruling?',
    matchedCitations: ['G.R. No. 234142 (Tan-Andal v. Andal)', 'Family Code Art. 36'],
    confidenceScore: 0.98,
    escalatedToHuman: false,
    userRating: 'helpful',
    flaggedForReview: false,
  },
  {
    id: 'qry-1089',
    timestamp: '2026-10-29T21:05:30Z',
    userQuery: 'Binantaan ako ng landlord ko na ipapa-barangay ako at puputulan ng kuryente dahil delay ako ng 1 month.',
    matchedCitations: ['Rent Control Act (RA 9653)', 'Civil Code Lease Provisions', 'Barangay Justice System (LGC)'],
    confidenceScore: 0.89,
    escalatedToHuman: false,
    flaggedForReview: false,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 5. MOCK SYSTEM SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_ADMIN_SETTINGS: AdminSystemSettings = {
  platformName: 'Justicia Philippines — The Sovereign Legal Marketplace',
  contactEmail: 'support@justicia.ph',
  hotline: '+63 (02) 8888-JUST (5878)',
  maintenanceMode: false,
  maintenanceNotice: 'The platform is undergoing scheduled database maintenance. Service will resume shortly.',
  consultationFeeMin: 500,
  consultationFeeMax: 15000,
  platformCommissionPercent: 10,
  freeTrialConsultationsAllowed: 0,
  requireMfaForAdmins: true,
  sessionTimeoutMinutes: 30,
  maxFailedLoginsBeforeLock: 5,
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. MOCK LAWYERS & VERIFICATION QUEUE
// ─────────────────────────────────────────────────────────────────────────────

export interface AdminMockLawyerItem {
  user_id: string;
  email: string;
  full_name: string;
  roll_number: string;
  ibp_chapter: string;
  bar_passer_year: number;
  about: string;
  practice_areas: string[];
  languages: string[];
  experience_years: number;
  fee_initial_30min: number;
  fee_standard_60min: number;
  fee_extended_120min: number;
  verification_status: string;
  is_visible: boolean;
  is_available: boolean;
  admin_notes: string | null;
  rejection_reason: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  created_at: string;
}

export const MOCK_ADMIN_LAWYERS: AdminMockLawyerItem[] = [
  {
    user_id: 'usr-lw-02',
    email: 'atty.santos@santoslaw.ph',
    full_name: 'Atty. Maria Clara Santos',
    roll_number: '54821',
    ibp_chapter: 'Pasig-San Juan-Mandaluyong',
    bar_passer_year: 2014,
    about: 'Specializing in Family Law, Estate Planning, and Civil Litigation with over a decade of practice before the trial and appellate courts.',
    practice_areas: ['Family Law', 'Estate Planning', 'Civil Litigation', 'Corporate Law'],
    languages: ['Filipino', 'English'],
    experience_years: 12,
    fee_initial_30min: 1500,
    fee_standard_60min: 2500,
    fee_extended_120min: 4500,
    verification_status: 'approved',
    is_visible: true,
    is_available: true,
    admin_notes: null,
    rejection_reason: null,
    submitted_at: '2026-07-02T11:45:00Z',
    reviewed_at: '2026-07-03T10:00:00Z',
    created_at: '2026-07-02T11:45:00Z',
  },
  {
    user_id: 'usr-lw-03',
    email: 'jm.deleon@dlexlaw.ph',
    full_name: 'Atty. Jose Maria De Leon',
    roll_number: '59144',
    ibp_chapter: 'Cebu City Chapter',
    bar_passer_year: 2017,
    about: 'Cebu-based maritime and commercial law practitioner assisting local enterprises and seafarers with labor standards and maritime arbitration.',
    practice_areas: ['Labor Law', 'Maritime Law', 'Commercial Law'],
    languages: ['Cebuano', 'Filipino', 'English'],
    experience_years: 9,
    fee_initial_30min: 1200,
    fee_standard_60min: 2200,
    fee_extended_120min: 4000,
    verification_status: 'approved',
    is_visible: true,
    is_available: true,
    admin_notes: null,
    rejection_reason: null,
    submitted_at: '2026-07-20T14:10:00Z',
    reviewed_at: '2026-07-21T09:30:00Z',
    created_at: '2026-07-20T14:10:00Z',
  },
  {
    user_id: 'usr-lw-05',
    email: 'bautista.counsel@gmail.com',
    full_name: 'Atty. Ramon M. Bautista',
    roll_number: '61209',
    ibp_chapter: 'Quezon City Chapter',
    bar_passer_year: 2019,
    about: 'Criminal defense counsel focusing on bail hearings, preliminary investigation, and white-collar compliance.',
    practice_areas: ['Criminal Law', 'Cybercrime', 'Litigation'],
    languages: ['Filipino', 'English'],
    experience_years: 7,
    fee_initial_30min: 1000,
    fee_standard_60min: 1800,
    fee_extended_120min: 3500,
    verification_status: 'pending',
    is_visible: false,
    is_available: false,
    admin_notes: 'Credential submission pending IBP verification check.',
    rejection_reason: null,
    submitted_at: '2026-10-29T18:00:00Z',
    reviewed_at: null,
    created_at: '2026-10-29T18:00:00Z',
  },
  {
    user_id: 'usr-lw-08',
    email: 'counsel.valdez@valdezlegal.ph',
    full_name: 'Atty. Katrina Isabel Valdez',
    roll_number: '63412',
    ibp_chapter: 'Makati City Chapter',
    bar_passer_year: 2021,
    about: 'Intellectual property and tech startup specialist representing software companies on licensing, patents, and trademark disputes.',
    practice_areas: ['Intellectual Property', 'Corporate Law', 'Tech Startups'],
    languages: ['English', 'Filipino'],
    experience_years: 5,
    fee_initial_30min: 1800,
    fee_standard_60min: 3000,
    fee_extended_120min: 5500,
    verification_status: 'pending',
    is_visible: false,
    is_available: false,
    admin_notes: null,
    rejection_reason: null,
    submitted_at: '2026-10-30T09:15:00Z',
    reviewed_at: null,
    created_at: '2026-10-30T09:15:00Z',
  },
  {
    user_id: 'usr-lw-09',
    email: 'atty.gerardo.lim@gmail.com',
    full_name: 'Atty. Gerardo P. Lim',
    roll_number: '52188',
    ibp_chapter: 'Davao City Chapter',
    bar_passer_year: 2012,
    about: 'Agrarian reform, land title disputes, and ancestral domain legal assistance across Mindanao.',
    practice_areas: ['Agrarian Reform', 'Property Law', 'Civil Litigation'],
    languages: ['Cebuano', 'Filipino', 'English'],
    experience_years: 14,
    fee_initial_30min: 1500,
    fee_standard_60min: 2500,
    fee_extended_120min: 4500,
    verification_status: 'approved',
    is_visible: true,
    is_available: true,
    admin_notes: null,
    rejection_reason: null,
    submitted_at: '2026-08-10T10:00:00Z',
    reviewed_at: '2026-08-11T14:20:00Z',
    created_at: '2026-08-10T10:00:00Z',
  },
];

