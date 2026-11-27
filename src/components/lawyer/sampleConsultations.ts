import type { LawyerConsultation } from '@/app/actions/consultationActions';
import {
  addDays,
  isScheduled,
  parseIsoDate,
  todayInManila,
  toIsoDate,
  type LawyerDashboardStats,
} from '@/lib/lawyer/dashboardSchedule';

/**
 * Sample records for the signed-out demo preview of the Dashboard and Consultations tabs (the
 * demo session has no database rows). Every status is represented so each tab has examples.
 * Dates are relative to today so the date filter has something to show on any day.
 * Ids start with "demo-", which keeps every action on them read-only.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const LOREM =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.';

interface Seed {
  key: string;
  dayOffset: number;
  start: number; // minutes after midnight, Manila
  status: LawyerConsultation['status'];
  mode?: 'video' | 'audio';
  client: LawyerConsultation['client'];
  title: string;
  description: string;
  shared?: number;
  /** Decline / cancellation reason. */
  reason?: string;
}

const SEEDS: Seed[] = [
  {
    key: 'clyde',
    dayOffset: 0,
    start: 9 * 60,
    status: 'completed',
    client: {
      name: 'Clyde Justine B. Rosal',
      age: 21,
      sex: 'Male',
      address: 'M. Aliganga St., Purok Proper III, Brgy. Tangke, City of Naga, Cebu, Philippines, 6037',
      email: 'clydejustinerosal@gmail.com',
      phone: '+63 998 875 6587',
    },
    title: 'Makati Residential Lease Deposit Dispute & Formal Notice to Vacate',
    description: `${LOREM}\n\n${LOREM}`,
    shared: 2,
  },
  {
    key: 'maria',
    dayOffset: 0,
    start: 15 * 60,
    status: 'confirmed',
    client: {
      name: 'Maria Angela C. Reyes',
      age: 34,
      sex: 'Female',
      address: 'Unit 1502, One Rockwell East Tower, Makati City, Metro Manila, 1210',
      email: 'ma.reyes@email.com',
      phone: '+63 917 890 1234',
    },
    title: 'Employment Non-Compete Clause Enforceability & IP Assignment',
    description:
      'Client requests a review of an executive employment contract containing a two-year nationwide restrictive covenant, and of a clause assigning pre-existing software copyrights to the employer. She wants to know which terms are enforceable under Philippine labor law and how to negotiate them before signing.',
    shared: 1,
  },
  {
    key: 'rafael',
    dayOffset: 0,
    start: 17 * 60,
    status: 'payment_review',
    mode: 'audio',
    client: {
      name: 'Rafael Vincent D. Cruz',
      age: 45,
      sex: 'Male',
      address: '89 Mahogany St., BF Homes, Parañaque City, Metro Manila, 1720',
      email: 'rv.cruz@email.com',
      phone: '+63 928 456 7890',
    },
    title: 'Torrens Title Reconstitution & Boundary Dispute Settlement',
    description:
      'Dispute over conflicting cadastral surveys covering a 450-sqm ancestral lot in Laguna with overlapping transfer certificates of title. The client has uploaded proof of payment for this session.',
  },
  {
    key: 'elena',
    dayOffset: 1,
    start: 10 * 60,
    status: 'confirmed',
    client: {
      name: 'Elena Sofia Mendoza',
      age: 29,
      sex: 'Female',
      address: '45 Emerald Ave., Ortigas Center, Pasig City, 1605',
      email: 'elena.mendoza@email.com',
      phone: '+63 918 333 4455',
    },
    title: 'Judicial Recognition of Foreign Divorce Decree & Property Division',
    description:
      'Petition for judicial recognition of a divorce obtained abroad under Article 26 of the Family Code, with partition of the community property regime.',
    shared: 3,
  },
  {
    key: 'axziel',
    dayOffset: 3,
    start: 13 * 60 + 30,
    status: 'pending_payment',
    client: {
      name: 'Axziel Jay A. Bartolabac',
      age: 28,
      sex: 'Male',
      address: 'Cebu City, Philippines',
      email: 'preview@justicia.ph',
      phone: null,
    },
    title: 'Employment Contract and Non-Compete Review',
    description: 'Client requests a review of an employment contract and guidance on a restrictive covenant.',
  },
  {
    key: 'benideck',
    dayOffset: 8,
    start: 11 * 60,
    status: 'confirmed',
    mode: 'audio',
    client: {
      name: 'Benideck J. Longakit',
      age: 32,
      sex: 'Male',
      address: 'Muntinlupa City, Philippines',
      email: 'preview@justicia.ph',
      phone: null,
    },
    title: 'Constructive Dismissal and Unpaid Commissions',
    description: 'Client seeks advice about unpaid commissions and changes to employment responsibilities.',
  },
  {
    key: 'christopher',
    dayOffset: -6,
    start: 14 * 60,
    status: 'completed',
    client: {
      name: 'Christopher John G. Rubio',
      age: 35,
      sex: 'Male',
      address: 'Pasig City, Philippines',
      email: 'preview@justicia.ph',
      phone: null,
    },
    title: 'Software Licensing and Trademark Notice',
    description: 'Client asks about software licensing terms and a trademark infringement notice.',
  },
  {
    key: 'sofia',
    dayOffset: 2,
    start: 10 * 60,
    status: 'pending',
    client: {
      name: 'Sofia Isabel P. Lim',
      age: 26,
      sex: 'Female',
      address: 'Banilad, Cebu City, Philippines, 6000',
      email: 'sofia.lim@email.com',
      phone: '+63 917 222 3344',
    },
    title: 'Unpaid Final Pay and Illegal Dismissal Complaint',
    description:
      'Client was dismissed without notice after three years of service and has not received her final pay or certificate of employment. She wants to know whether to file a complaint with the NLRC and what evidence to prepare.',
    shared: 2,
  },
  {
    key: 'marco',
    dayOffset: 5,
    start: 15 * 60,
    status: 'pending',
    mode: 'audio',
    client: {
      name: 'Marco Antonio R. Villanueva',
      age: 52,
      sex: 'Male',
      address: 'Lahug, Cebu City, Philippines, 6000',
      email: 'marco.villanueva@email.com',
      phone: null,
    },
    title: 'Extrajudicial Settlement of Estate Among Four Heirs',
    description: 'The heirs disagree on how to divide a family house and two agricultural lots left without a will.',
  },
  {
    key: 'jose',
    dayOffset: -2,
    start: 11 * 60,
    status: 'declined',
    client: {
      name: 'Jose Miguel T. Santos',
      age: 40,
      sex: 'Male',
      address: 'Mandaue City, Cebu, Philippines',
      email: 'preview@justicia.ph',
      phone: null,
    },
    title: 'Maritime Cargo Claim Against a Shipping Line',
    description: 'Client asks about recovering the value of damaged cargo from a domestic shipping line.',
    reason: 'This matter is outside my practice areas. I recommend a lawyer who handles maritime law.',
  },
  {
    key: 'ana',
    dayOffset: 4,
    start: 16 * 60,
    status: 'cancelled',
    client: {
      name: 'Ana Patricia L. Gomez',
      age: 31,
      sex: 'Female',
      address: 'Talisay City, Cebu, Philippines',
      email: 'preview@justicia.ph',
      phone: null,
    },
    title: 'Annulment Grounds and Custody of a Minor Child',
    description: 'Client wants to understand the grounds for annulment and how custody of her five-year-old is decided.',
    reason: 'The client cancelled because the schedule no longer works for her.',
  },
];

const STATUS_LABELS: Record<LawyerConsultation['status'], string> = {
  pending: 'PENDING YOUR APPROVAL',
  pending_payment: 'PENDING PAYMENT',
  payment_review: 'PAYMENT FOR REVIEW',
  confirmed: 'CONFIRMED APPOINTMENT',
  completed: 'COMPLETED',
  declined: 'DECLINED',
  cancelled: 'CANCELLED',
};

function clock(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(minutes % 60).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}

export function buildSampleConsultations(now: number = Date.now()): LawyerConsultation[] {
  const today = todayInManila(now);
  return SEEDS.map((seed) => {
    const iso = addDays(today, seed.dayOffset);
    const { year, month, day } = parseIsoDate(iso)!;
    const weekday = WEEKDAYS[new Date(Date.UTC(year, month, day)).getUTCDay()];
    const longDate = `${MONTHS[month]} ${day}, ${year}`;
    const timeRange = `${clock(seed.start)} - ${clock(seed.start + 60)}`;
    const startIso = new Date(Date.UTC(year, month, day) + (seed.start - 8 * 60) * 60_000).toISOString();
    const paid = seed.status === 'confirmed' || seed.status === 'completed';
    return {
      id: `demo-${seed.key}`,
      rawStatus: seed.status,
      status: seed.status,
      statusLabel: STATUS_LABELS[seed.status],
      dateTag: `${iso === today ? 'TODAY, ' : ''}${longDate.toUpperCase()}`,
      timeTag: `${timeRange} • PST, GMT+8`,
      day,
      month,
      year,
      scheduledStart: startIso,
      communicationMode: seed.mode ?? 'video',
      clientId: `demo-client-${seed.key}`,
      client: seed.client,
      subjectCategory: 'SUBJECT MATTER & CASE DOCKET',
      subjectTitle: seed.title,
      caseDescription: seed.description,
      fee: 1500,
      attachedFiles: Array.from({ length: seed.shared ?? 0 }, (_, i) => ({
        documentId: `demo-doc-${seed.key}-${i}`,
        name: `Supporting document ${i + 1}.pdf`,
        size: '240 KB',
        mimeType: 'application/pdf',
      })),
      meetingLink: seed.status === 'confirmed' ? `/call/demo-${seed.key}` : null,
      declineReason: seed.status === 'declined' ? seed.reason ?? null : null,
      cancellationReason: seed.status === 'cancelled' ? seed.reason ?? null : null,
      dateLong: `${weekday}, ${longDate}`,
      timeRange,
      durationLabel: '1 hour',
      lawyerSummary: { name: 'Atty. Maria Santos', rollNumber: '78910', ibpChapter: 'Quezon City' },
      paymentDetails: {
        state: paid ? 'verified' : seed.status === 'payment_review' ? 'submitted' : 'none',
        proofDocumentId: null,
        proofFileName: paid || seed.status === 'payment_review' ? 'gcash-receipt.png' : null,
        submittedAt: null,
        reviewedAt: null,
        rejectionReason: null,
        sessionFee: 1500,
        platformFee: 50,
        total: 1550,
      },
      reschedule: null,
    } satisfies LawyerConsultation;
  });
}

/** Figures for the demo KPI cards (the original Figma values). */
export function buildSampleStats(samples: LawyerConsultation[], now: number = Date.now()): LawyerDashboardStats {
  const today = todayInManila(now);
  const { year, month } = parseIsoDate(today)!;
  const todays = samples.filter((c) => isScheduled(c) && toIsoDate(c.year, c.month, c.day) === today);
  return {
    today,
    todayScheduled: todays.length,
    todayUpcoming: todays.filter((c) => c.status !== 'completed' && Date.parse(c.scheduledStart ?? '') > now).length,
    pendingRequests: 13,
    pendingClients: 13,
    year,
    month,
    monthEarnings: 84900,
    previousMonthEarnings: 71950,
    ratingAvg: 4.95,
    ratingCount: 124,
    responseRate: 99,
  };
}
