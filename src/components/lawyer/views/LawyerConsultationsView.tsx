'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, type Variants } from 'motion/react';
import { useReducedMotionPreference } from '@/components/lawyer/useReducedMotionPreference';
import {
  respondToConsultationAction,
  reviewPaymentAction,
  lawyerCancelConsultationAction,
  getDocumentAccessUrlAction,
} from '@/app/actions/consultationActions';
import type { LawyerConsultation } from '@/app/actions/consultationActions';
import { fetchLive } from '@/lib/live/fetchLive';
import { useLiveRefresh } from '@/components/live/LiveProvider';
import { ConsultationDetailsModal } from '@/components/shared/ConsultationDetailsModal';
import type { ConsultationDetailsModalProps } from '@/components/shared/ConsultationDetailsModal';
import { ConsultationDecisionModal } from '@/components/lawyer/ConsultationDecisionModal';
import type { DecisionMode } from '@/components/lawyer/ConsultationDecisionModal';

const EASE = [0.16, 1, 0.3, 1] as const;
const consultationEntrance: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.14, delayChildren: 0.05 } },
};
const consultationTop: Variants = {
  hidden: { opacity: 0, y: -16, filter: 'blur(5px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.6, ease: EASE } },
};
const consultationColumn: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EASE } },
};

/* ─── Types ────────────────────────────────────────────────────────────────── */

type ConsultationTab = 'all' | 'pending' | 'upcoming' | 'completed' | 'cancelled';
type PeriodFilter = 'all' | 'month' | 'week';
type DetailedConsultation = LawyerConsultation;

const MONTH_LABELS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

function matchesTab(c: DetailedConsultation, tab: ConsultationTab): boolean {
  switch (tab) {
    case 'pending':
      return c.status === 'pending';
    case 'upcoming':
      return c.status === 'pending_payment' || c.status === 'payment_review' || c.status === 'confirmed';
    case 'completed':
      return c.status === 'completed';
    case 'cancelled':
      return c.status === 'cancelled' || c.status === 'declined';
    default:
      return true;
  }
}

/** Today in Asia/Manila as { year, month (0-based), day }. */
function todayPH() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get('year'), month: get('month') - 1, day: get('day') };
}

function matchesPeriod(c: DetailedConsultation, period: PeriodFilter): boolean {
  if (period === 'all') return true;
  const t = todayPH();
  if (period === 'month') return c.year === t.year && c.month === t.month;
  const today = Date.UTC(t.year, t.month, t.day);
  const weekStart = today - new Date(today).getUTCDay() * 86400000;
  const when = Date.UTC(c.year, c.month, c.day);
  return when >= weekStart && when < weekStart + 7 * 86400000;
}

function compactAppointmentTime(timeTag: string): string {
  return timeTag
    .split('•')[0]
    .replace(/:00(?=\s*(?:AM|PM))/gi, '')
    .replace(/[–—]/g, '-')
    .trim();
}

/** Status pill text for the details modal (designs use client-facing wording). */
const DETAIL_STATUS_LABELS: Record<DetailedConsultation['status'], string> = {
  pending: 'PENDING CONFIRMATION',
  pending_payment: 'PENDING PAYMENT',
  payment_review: 'PAYMENT FOR REVIEW',
  confirmed: 'CONFIRMED APPOINTMENT',
  completed: 'COMPLETED',
  declined: 'DECLINED',
  cancelled: 'CANCELLED',
};

const FIGMA_PREVIEW_PARAGRAPH = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
  'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
  'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
].join(' ');
const FIGMA_PREVIEW_DESCRIPTION = `${FIGMA_PREVIEW_PARAGRAPH} ${FIGMA_PREVIEW_PARAGRAPH}\n\n${FIGMA_PREVIEW_PARAGRAPH} Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`;

// The signed-out demo session has no consultation records. Keep its Figma preview
// separate from the signed-in lawyer's real records and server actions.
type PreviewConsultationBase = Pick<
  DetailedConsultation,
  'id' | 'status' | 'statusLabel' | 'client' | 'timeRange' | 'subjectTitle' | 'caseDescription'
>;

const PREVIEW_CONSULTATION_BASE: PreviewConsultationBase[] = [
  {
    id: 'demo-clyde',
    status: 'confirmed',
    statusLabel: 'CONFIRMED APPOINTMENT',
    client: {
      name: 'Clyde Justine B. Rosal',
      age: 21,
      sex: 'Male',
      address: 'M. Aliganga St., Purok Proper III, Brgy. Tangke, City of Naga, Cebu, Philippines, 6037',
      email: 'clydejustinerosal@gmail.com',
      phone: '+63 998 875 6587',
    },
    timeRange: '9:00 AM - 10:00 AM',
    subjectTitle: 'Makati Residential Lease Deposit Dispute & Formal Notice to Vacate',
    caseDescription: FIGMA_PREVIEW_DESCRIPTION,
  },
  {
    id: 'demo-axziel',
    status: 'pending',
    statusLabel: 'PENDING YOUR APPROVAL',
    client: {
      name: 'Axziel Jay A. Bartolabac',
      age: 28,
      sex: 'Male',
      address: 'Cebu City, Philippines',
      email: 'preview@justicia.ph',
      phone: null,
    },
    timeRange: '10:00 AM - 11:00 AM',
    subjectTitle: 'Employment Contract and Non-Compete Review',
    caseDescription: 'Client requests a review of an employment contract and guidance on a restrictive covenant.',
  },
  {
    id: 'demo-benideck',
    status: 'completed',
    statusLabel: 'COMPLETED',
    client: {
      name: 'Benideck J. Longakit',
      age: 32,
      sex: 'Male',
      address: 'Muntinlupa City, Philippines',
      email: 'preview@justicia.ph',
      phone: null,
    },
    timeRange: '1:00 PM - 2:00 PM',
    subjectTitle: 'Constructive Dismissal and Unpaid Commissions',
    caseDescription: 'Client seeks advice about unpaid commissions and changes to employment responsibilities.',
  },
  {
    id: 'demo-christopher',
    status: 'cancelled',
    statusLabel: 'CANCELLED',
    client: {
      name: 'Christopher John G. Rubio',
      age: 35,
      sex: 'Male',
      address: 'Pasig City, Philippines',
      email: 'preview@justicia.ph',
      phone: null,
    },
    timeRange: '2:00 PM - 3:00 PM',
    subjectTitle: 'Software Licensing and Trademark Notice',
    caseDescription: 'Client asks about software licensing terms and a trademark infringement notice.',
  },
];

const PREVIEW_CONSULTATIONS: DetailedConsultation[] = PREVIEW_CONSULTATION_BASE.map((preview) => ({
  ...preview,
  rawStatus: preview.status,
  dateTag: 'TODAY, SEPTEMBER 23, 2026',
  timeTag: `${preview.timeRange} • PST, GMT+8`,
  day: 23,
  month: 8,
  year: 2026,
  scheduledStart: null,
  communicationMode: 'video',
  clientId: preview.id,
  subjectCategory: 'SUBJECT MATTER & CASE DOCKET',
  fee: 1500,
  attachedFiles: [],
  meetingLink: 'https://meet.justicia.ph',
  declineReason: null,
  cancellationReason: null,
  dateLong: 'Wednesday, September 23, 2026',
  durationLabel: '1 hour',
  lawyerSummary: { name: 'Atty. Maria Santos', rollNumber: '78910', ibpChapter: 'Quezon City' },
  paymentDetails: {
    state: preview.status === 'confirmed' || preview.status === 'completed' ? 'verified' : 'none',
    proofDocumentId: null,
    proofFileName: null,
    submittedAt: null,
    reviewedAt: null,
    rejectionReason: null,
    sessionFee: 1500,
    platformFee: 0,
    total: 1500,
  },
}));

/* ─── Main Component ──────────────────────────────────────────────────────── */

export function LawyerConsultationsView({
  lawyerUserId,
}: {
  lawyerUserId?: string;
  lawyerName?: string;
} = {}) {
  const router = useRouter();
  const reduceMotion = useReducedMotionPreference();
  const [dbConsultations, setDbConsultations] = useState<DetailedConsultation[]>([]);
  const [loadingConsultations, setLoadingConsultations] = useState(true);
  const [activeTab, setActiveTab] = useState<ConsultationTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>(
    lawyerUserId?.startsWith('demo-') ? 'month' : 'all'
  );
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [decision, setDecision] = useState<{ mode: DecisionMode; id: string } | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [decisionSubmitting, setDecisionSubmitting] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Fetch the signed-in lawyer's consultations (identity is resolved server-side).
  const loadConsultations = useCallback(() => {
    return fetchLive('lawyer-consultations')
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setDbConsultations(list);
        setSelectedAppointmentId((current) =>
          current && list.some((c) => c.id === current) ? current : list[0]?.id ?? null
        );
      })
      .catch(() => {
        // Keep showing the last loaded list; the next live refresh retries.
      })
      .finally(() => setLoadingConsultations(false));
  }, []);

  useEffect(() => {
    loadConsultations();
  }, [loadConsultations, lawyerUserId]);

  // New requests, payments and cancellations appear without reopening the tab.
  useLiveRefresh(['consultations', 'payments'], loadConsultations, { fallbackMs: 30000 });

  const isDemoPreview = !!lawyerUserId?.startsWith('demo-') && !loadingConsultations && dbConsultations.length === 0;
  const consultations = isDemoPreview ? PREVIEW_CONSULTATIONS : dbConsultations;

  const dateKey = (c: { year: number; month: number; day: number }) => `${c.year}-${c.month}-${c.day}`;

  // Filter by status tab, client name search, calendar date and period
  const appointmentsToDisplay = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return consultations.filter(
      (c) =>
        matchesTab(c, activeTab) &&
        (!q || c.client.name.toLowerCase().includes(q)) &&
        (!selectedDateKey || dateKey(c) === selectedDateKey) &&
        (activeTab !== 'pending' || isDemoPreview || matchesPeriod(c, periodFilter))
    );
  }, [consultations, activeTab, searchQuery, selectedDateKey, periodFilter, isDemoPreview]);

  const selectedConsultation: DetailedConsultation | null = useMemo(
    () =>
      appointmentsToDisplay.find((c) => c.id === selectedAppointmentId) ||
      appointmentsToDisplay[0] ||
      null,
    [appointmentsToDisplay, selectedAppointmentId]
  );

  const carouselIndex = selectedConsultation
    ? Math.max(0, appointmentsToDisplay.findIndex((c) => c.id === selectedConsultation.id))
    : 0;
  const goToIndex = (idx: number) => {
    const target = appointmentsToDisplay[idx];
    if (target) setSelectedAppointmentId(target.id);
  };

  // Calendar follows the selected consultation's month (or the current month).
  const today = todayPH();
  const calendarYear = selectedConsultation?.year ?? today.year;
  const calendarMonth = selectedConsultation?.month ?? today.month;
  const calendarCells = useMemo(() => {
    const cells: Array<number | null> = [];
    const firstWeekday = new Date(calendarYear, calendarMonth, 1).getDay();
    const totalDays = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(d);
    return cells;
  }, [calendarYear, calendarMonth]);
  const daysWithConsultations = useMemo(
    () => new Set(consultations.filter((c) => matchesTab(c, activeTab)).map(dateKey)),
    [consultations, activeTab]
  );

  const openDecision = (mode: DecisionMode, id: string) => {
    if (id.startsWith('demo-')) return;
    setDecisionError(null);
    setDecision({ mode, id });
  };

  const handleDecision = async (value?: string) => {
    if (!decision) return;
    setDecisionSubmitting(true);
    setDecisionError(null);
    try {
      const { mode, id } = decision;
      const res =
        mode === 'approve' || mode === 'decline'
          ? await respondToConsultationAction(id, mode === 'approve' ? 'approved' : 'rejected', value)
          : mode === 'confirm_payment'
            ? await reviewPaymentAction(id, 'confirm', { meetingLink: value })
            : mode === 'decline_payment'
              ? await reviewPaymentAction(id, 'reject', { reason: value })
              : await lawyerCancelConsultationAction(id, value ?? '');
      if (!('success' in res) || !res.success) {
        setDecisionError(('error' in res && res.error) || 'We could not update this consultation.');
        return;
      }
      setDecision(null);
      setShowDetails(false);
      await loadConsultations();
    } catch {
      setDecisionError('We could not update this consultation. Please try again.');
    } finally {
      setDecisionSubmitting(false);
    }
  };

  const openMessages = (consultationId: string) => {
    if (consultationId.startsWith('demo-')) return;
    router.push(`/lawyer/messages?thread=${consultationId}`);
  };

  const decisionTarget = decision ? consultations.find((c) => c.id === decision.id) : null;

  const openProof = async (documentId: string) => {
    const res = await getDocumentAccessUrlAction(documentId);
    if ('url' in res && res.url) window.open(res.url, '_blank', 'noopener,noreferrer');
    else setDetailsError(('error' in res && res.error) || 'This file could not be opened.');
  };

  /** View Details modal per status (pending-nvonfirmed / pending-payment / confirmed-and-paid designs). */
  const buildDetailsProps = (c: DetailedConsultation): ConsultationDetailsModalProps => {
    const close = () => {
      setShowDetails(false);
      setDetailsError(null);
    };
    const paid = c.status === 'confirmed' || c.status === 'completed';
    const hasSummary = paid || c.status === 'pending_payment' || c.status === 'payment_review';
    const pd = c.paymentDetails;

    let notice: ConsultationDetailsModalProps['notice'] = null;
    if (c.declineReason) notice = { tone: 'red', title: 'Reason for Declining', text: c.declineReason };
    else if (c.cancellationReason) notice = { tone: 'red', title: 'Reason for Cancellation', text: c.cancellationReason };
    else if (c.status === 'pending_payment' && pd.state === 'rejected' && pd.rejectionReason) {
      notice = { tone: 'amber', title: 'You declined the previous proof of payment', text: pd.rejectionReason };
    }

    let actions: ConsultationDetailsModalProps['actions'] = [{ label: 'Close', variant: 'caramel', onClick: close }];
    if (c.status === 'payment_review') {
      actions = [
        { label: 'Decline', variant: 'outline', onClick: () => openDecision('decline_payment', c.id) },
        { label: 'Confirm Payment', variant: 'caramel', onClick: () => openDecision('confirm_payment', c.id) },
      ];
    } else if (c.status === 'confirmed') {
      actions = [
        { label: 'Cancel', variant: 'outline', onClick: () => openDecision('cancel', c.id) },
        { label: 'Reschedule', variant: 'espresso', onClick: () => openMessages(c.id) },
        {
          label: 'Join Meet',
          variant: 'caramel',
          icon: 'video',
          disabled: !c.meetingLink,
          onClick: () => {
            if (c.meetingLink) window.open(c.meetingLink, '_blank', 'noopener,noreferrer');
          },
        },
      ];
    }
    if (c.id.startsWith('demo-')) actions = [{ label: 'Close', variant: 'caramel', onClick: close }];

    const proofId = pd.proofDocumentId;
    const modeLine = c.communicationMode === 'video' ? 'Video Consultation (Google Meet)' : 'Audio Call (Google Meet)';
    return {
      dateStr: c.dateTag,
      timeSlot: c.timeTag,
      statusLabel: DETAIL_STATUS_LABELS[c.status],
      statusTone:
        c.status === 'pending_payment'
          ? 'red'
          : c.status === 'payment_review'
            ? 'amber'
            : paid
              ? 'green'
              : c.status === 'pending'
                ? 'caramel'
                : 'grey',
      person: {
        name: c.client.name,
        lines: [
          'Age: ' + (c.client.age ?? 'Not provided') + '  |  Sex: ' + (c.client.sex ?? 'Not provided'),
          c.client.address ?? modeLine,
          c.client.email + '  |  ' + (c.client.phone ?? 'No phone on file'),
        ],
        onMessage: c.id.startsWith('demo-') || c.status === 'declined' || c.status === 'cancelled' ? undefined : () => openMessages(c.id),
      },
      docket: c.subjectCategory,
      caseTitle: c.subjectTitle,
      caseDescription: c.caseDescription,
      notice,
      summary: hasSummary
        ? {
            title: c.status === 'pending_payment' ? 'Booking Summary' : 'Payment Summary',
            lawyerName: c.lawyerSummary.name,
            lawyerMeta: 'Roll No. ' + c.lawyerSummary.rollNumber + '  |  IBP ' + c.lawyerSummary.ibpChapter,
            modeLabel: c.communicationMode === 'video' ? 'Video Conference' : 'Audio Call',
            modeMeta: 'Platform: Google Meet  |  Duration: ' + c.durationLabel,
            dateLong: c.dateLong,
            timeRange: c.timeRange,
            sessionFee: pd.sessionFee,
            platformFee: pd.platformFee,
            total: pd.total,
          }
        : null,
      proof:
        (c.status === 'payment_review' || paid) && pd.proofFileName
          ? { fileName: pd.proofFileName, onOpen: proofId ? () => openProof(proofId) : undefined }
          : null,
      error: detailsError,
      actions,
      onClose: close,
    };
  };

  const tabs: { key: ConsultationTab; label: string; count: number }[] = [
    { key: 'all',       label: 'All Inquires',       count: isDemoPreview ? 50 : consultations.length },
    { key: 'pending',   label: 'Pending Approval',   count: isDemoPreview ? 17 : consultations.filter((c) => matchesTab(c, 'pending')).length },
    { key: 'upcoming',  label: 'Upcoming',           count: isDemoPreview ? 33 : consultations.filter((c) => matchesTab(c, 'upcoming')).length },
    { key: 'completed', label: 'Completed',          count: isDemoPreview ? 39 : consultations.filter((c) => matchesTab(c, 'completed')).length },
    { key: 'cancelled', label: 'Cancelled',          count: isDemoPreview ? 3 : consultations.filter((c) => matchesTab(c, 'cancelled')).length },
  ];

  return (
    <motion.div
      variants={consultationEntrance}
      initial={reduceMotion ? false : 'hidden'}
      animate="show"
      className="lawyer-consultations p-6 sm:p-9 lg:p-10 max-w-7xl mx-auto space-y-7"
    >
      {/* ── Top Status Tabs & Search Section ─────────────────────────────────── */}
      <motion.div data-lawyer-motion variants={consultationTop} className="space-y-4">
        {/* Status Tab Pills */}
        <div className="lawyer-consultations-tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                aria-pressed={isActive}
                className="lawyer-consultations-tab active:scale-[0.98] motion-reduce:transition-none"
              >
                {tab.label} ({tab.count})
              </button>
            );
          })}
        </div>

        {/* Search & Filter Controls Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Debossed Search Input */}
          <div className="flex-1 max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Client Name"
              className="lawyer-consultations-search-input neu-inset rounded-2xl px-5 py-3 text-xs w-full text-[#381F17] placeholder-[#8C7A6B] focus:outline-none"
            />
          </div>

          {/* Raised Search Button */}
          <button
            type="button"
            className="lawyer-consultations-search-button flex items-center cursor-pointer"
          >
            <Image src="/figma-consultations-search.svg" width={14} height={14} loading="eager" alt="" aria-hidden="true" />
            <span>Search</span>
          </button>

          {/* Specialization Filter Dropdown */}
          <div className="relative">
            <select className="lawyer-consultations-area-filter appearance-none neu-inset rounded-2xl pl-5 pr-10 py-3 text-xs font-semibold text-[#381F17] focus:outline-none cursor-pointer">
              <option>Labor & Employment</option>
              <option>Corporate & Commercial</option>
              <option>Real Property & Land Titles</option>
              <option>Family & Civil Status</option>
              <option>Intellectual Property</option>
            </select>
            <Image className="lawyer-consultations-area-arrow" src="/figma-consultations-dropdown.svg" width={26} height={26} loading="eager" alt="" aria-hidden="true" />
          </div>
        </div>
      </motion.div>

      {/* ── Two-Column Main Content Layout ──────────────────────────────────── */}
      <motion.div variants={consultationEntrance} className="grid grid-cols-1 xl:grid-cols-[330px_1fr] gap-8 items-start">
        {/* ── Left Column: Calendar & Appointments List ─────────────────────── */}
        <motion.div data-lawyer-motion variants={consultationColumn} className="w-full xl:w-[330px] space-y-6 shrink-0">
          {/* Extruded "Upcoming Consultations" heading pill */}
          <div className="lawyer-consultations-heading-pill neu-plate rounded-full px-7 py-2.5 text-xs sm:text-sm font-bold text-[#381F17] inline-flex items-center">
            Upcoming Consultations
          </div>

          {/* Mini Calendar Widget */}
          <div className="neu-card-md rounded-[26px] p-5 space-y-4" data-weeks={Math.ceil(calendarCells.length / 7)}>
            {/* Month header pill */}
            <div className="lawyer-consultations-month-pill neu-inset-sm rounded-full py-1.5 px-6 text-xs font-bold uppercase tracking-wider text-[#C58B3C] text-center w-fit mx-auto">
              {MONTH_LABELS[calendarMonth]} {calendarYear}
            </div>

            {/* Days of Week Header */}
            <div className="grid grid-cols-7 text-center text-[10px] font-bold text-[#7D6855] tracking-wider">
              <span>SUN</span>
              <span>MON</span>
              <span>TUE</span>
              <span>WED</span>
              <span>THU</span>
              <span>FRI</span>
              <span>SAT</span>
            </div>

            {/* Calendar Days Grid */}
            <div className="grid grid-cols-7 text-center text-xs font-medium text-[#34150F] gap-y-2.5 items-center">
              {calendarCells.map((day, idx) => {
                if (!day) return <span key={`empty-${idx}`} />;
                const key = `${calendarYear}-${calendarMonth}-${day}`;
                const hasConsultation = daysWithConsultations.has(key);
                const isFiltered = selectedDateKey === key;
                const isSelectedDay =
                  !!selectedConsultation &&
                  selectedConsultation.year === calendarYear &&
                  selectedConsultation.month === calendarMonth &&
                  selectedConsultation.day === day;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!hasConsultation && !isFiltered}
                    onClick={() => setSelectedDateKey(isFiltered ? null : key)}
                    title={hasConsultation ? (isFiltered ? 'Show all dates' : 'Show consultations on this date') : undefined}
                    aria-pressed={hasConsultation ? isFiltered : undefined}
                    data-current={isSelectedDay}
                    data-filtered={isFiltered}
                    className="lawyer-consultations-calendar-day relative w-7 h-7 rounded-full flex items-center justify-center mx-auto"
                  >
                    {String(day).padStart(2, '0')}
                    {hasConsultation && !isSelectedDay && !isFiltered && (
                      <span className="lawyer-consultations-calendar-dot" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* List of Appointments Container (Warm Peach Plate) */}
          <div className="neu-plate rounded-[24px] p-5 space-y-3">
            <h4 className="text-xs sm:text-sm font-bold text-[#381F17] text-center pb-1">
              List of Appointments
            </h4>

            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
              {appointmentsToDisplay.length === 0 ? (
                <div className="p-4 text-center text-xs text-[#7D6855]">
                  No consultations in this category.
                </div>
              ) : (
                appointmentsToDisplay.map((apt) => {
                  const isSelected = selectedConsultation?.id === apt.id;
                  return (
                    <button
                      key={apt.id}
                      type="button"
                      onClick={() => setSelectedAppointmentId(apt.id)}
                      aria-label={`${apt.client.name}, ${apt.timeTag}, ${apt.statusLabel}`}
                      aria-pressed={isSelected}
                      data-selected={isSelected}
                      title={`${apt.client.name} · ${apt.statusLabel}`}
                      className="lawyer-consultations-appointment-pill"
                    >
                      <span className="lawyer-consultations-appointment-name">
                        {apt.client.name}
                      </span>
                      <span className="lawyer-consultations-appointment-time">
                        {compactAppointmentTime(apt.timeRange || apt.timeTag)}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

        </motion.div>

        {/* ── Right Column: Consultation Detail Hero Card ───────────────────── */}
        <motion.div data-lawyer-motion variants={consultationColumn} className="flex-1 min-w-0 space-y-6">
          <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            data-lawyer-motion
            key={loadingConsultations ? 'loading' : selectedConsultation?.id ?? 'empty'}
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion || loadingConsultations ? undefined : { opacity: 0, y: -10 }}
            transition={{ duration: reduceMotion ? 0 : 0.32, ease: EASE }}
            className="space-y-6"
          >
          {!selectedConsultation ? (
            <div className="neu-card rounded-[36px] sm:rounded-[40px] p-10 text-center space-y-2">
              <h3 className="font-cormorant text-2xl font-bold text-[#381F17]">
                {loadingConsultations ? 'Loading consultations...' : 'No consultations to show'}
              </h3>
              {!loadingConsultations && (
                <p className="text-xs text-[#685042]">
                  New consultation requests from clients will appear here for your approval.
                </p>
              )}
            </div>
          ) : (
          <>
          {/* Authentic Neumorphic Consultation Card (Exact User Spec) */}
          <div className="neu-card rounded-[36px] sm:rounded-[40px] p-7 sm:p-9 lg:p-11 space-y-7">
            {/* Top Badges Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="lawyer-consultations-date-pill neu-inset-sm rounded-full px-5 py-2 text-[11px] font-bold tracking-wider text-[#4A3227] uppercase">
                  {selectedConsultation.dateTag}
                </div>
                <div className="lawyer-consultations-time-pill neu-inset-sm rounded-full px-5 py-2 text-[11px] font-semibold text-[#4A3227]">
                  {selectedConsultation.timeTag}
                </div>
              </div>

              <div
                className="lawyer-consultations-status-pill shrink-0 self-start sm:self-auto"
                data-status={selectedConsultation.status}
              >
                {selectedConsultation.status === 'pending'
                  ? 'PENDING YOUR APPROVAL'
                  : selectedConsultation.status === 'confirmed'
                    ? 'CONFIRMED APPOINTMENT'
                    : selectedConsultation.statusLabel}
              </div>
            </div>

            {/* Client Profile Sub-Card (Extruded Warm Peach Plate) */}
            <div className="neu-plate rounded-[26px] p-6 sm:p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-center gap-5 sm:gap-6 min-w-0">
                {/* Custom Avatar Icon matching Figma mockup */}
                <div className="shrink-0">
                  <Image src="/figma-consultations-avatar.svg" width={96} height={96} loading="eager" alt="" aria-hidden="true" />
                </div>

                <div className="space-y-0.5 min-w-0">
                  <h4 className="font-cormorant text-2xl sm:text-[27px] font-bold text-[#381F17] leading-tight">
                    {selectedConsultation.client.name}
                  </h4>
                  <p className="text-xs font-medium text-[#685042] pt-0.5">
                    Age: {selectedConsultation.client.age ?? 'Not provided'} <span className="mx-1 text-[#8C7A6B]">|</span> Sex: {selectedConsultation.client.sex ?? 'Not provided'}
                  </p>
                  <p className="text-xs text-[#685042] leading-relaxed pt-0.5">
                    {selectedConsultation.client.address ?? (selectedConsultation.communicationMode === 'video' ? 'Video Consultation (Google Meet)' : 'Audio Call (Google Meet)')}
                  </p>
                  <p className="text-xs text-[#685042] pt-0.5">
                    {selectedConsultation.client.email} <span className="mx-1 text-[#8C7A6B]">|</span> {selectedConsultation.client.phone ?? 'No phone on file'}
                  </p>
                </div>
              </div>

              {/* Monolithic Extruded Message Button on Peach Plate */}
              <button
                type="button"
                onClick={() => openMessages(selectedConsultation.id)}
                aria-disabled={isDemoPreview}
                title={isDemoPreview ? 'Sample consultation — messaging is unavailable' : undefined}
                className="lawyer-consultations-message-pill neu-btn-peach rounded-full px-8 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-[#4E3227] tracking-wide shrink-0 self-start md:self-center cursor-pointer hover:brightness-105 transition-all"
              >
                Message
              </button>
            </div>


            {/* Subject Matter & Description */}
            <div className="space-y-1.5 pt-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#C58B3C]">
                {selectedConsultation.subjectCategory}
              </p>
              <h3 className="font-cormorant text-2xl sm:text-[28px] font-bold text-[#381F17] leading-snug">
                {selectedConsultation.subjectTitle}
              </h3>
              <div className="space-y-3 pt-1">
                <p className="text-xs sm:text-[13px] text-[#665246] leading-relaxed whitespace-pre-line">
                  {selectedConsultation.caseDescription}
                </p>
                {selectedConsultation.declineReason && (
                  <p className="text-xs sm:text-[13px] text-red-800 leading-relaxed">
                    <strong>Decline reason:</strong> {selectedConsultation.declineReason}
                  </p>
                )}
              </div>
            </div>

            {/* Bottom Action Row */}
            <div className="pt-2 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {isDemoPreview ? (
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#C58B3C]">
                  THIS CLIENT HAS SHARED THEIR DOCUMENTS WITH YOU. <span className="underline">View Documents</span>
                </p>
              ) : selectedConsultation.attachedFiles.length > 0 ? (
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#C58B3C]">
                  THIS CLIENT HAS SHARED {selectedConsultation.attachedFiles.length} DOCUMENT{selectedConsultation.attachedFiles.length === 1 ? '' : 'S'} WITH YOU.{' '}
                  <span
                    onClick={() => router.push('/lawyer/documents')}
                    className="underline cursor-pointer hover:text-[#99431E] transition-colors font-bold"
                  >
                    View Client Documents Vault
                  </span>
                </p>
              ) : (
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#8C7A6B]">
                  NO DOCUMENTS WERE SHARED FOR THIS CONSULTATION.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                {selectedConsultation.status === 'pending' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => openDecision('decline', selectedConsultation.id)}
                      aria-disabled={isDemoPreview}
                      title={isDemoPreview ? 'Sample consultation — actions are unavailable' : undefined}
                      className="lawyer-consultations-cancel-pill neu-btn rounded-2xl border-[1.5px] border-[#55382D] bg-[#ECE1D2] px-6 py-2.5 text-xs sm:text-sm font-semibold text-[#381F17] shadow-[2px_2px_6px_rgba(180,155,130,0.25)] hover:bg-red-50 hover:text-red-700 transition-all cursor-pointer disabled:opacity-50"
                    >
                      Decline
                    </button>

                    <button
                      type="button"
                      onClick={() => { setDetailsError(null); setShowDetails(true); }}
                      className="lawyer-consultations-details-pill neu-btn-espresso rounded-2xl px-6 py-2.5 text-xs sm:text-sm font-semibold text-white transition-all cursor-pointer hover:brightness-110"
                    >
                      View Details
                    </button>

                    <button
                      type="button"
                      onClick={() => openDecision('approve', selectedConsultation.id)}
                      aria-disabled={isDemoPreview}
                      title={isDemoPreview ? 'Sample consultation — actions are unavailable' : undefined}
                      className="lawyer-consultations-approve-pill px-7 py-2.5 rounded-2xl bg-[#23150F] hover:bg-[#381F17] text-[#ded7cb] text-xs sm:text-sm font-bold shadow-md transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      <span>Approve Consultation</span>
                    </button>
                  </>
                ) : (
                  <>
                    {selectedConsultation.status === 'confirmed' ? (
                      <button
                        type="button"
                        onClick={() => openDecision('cancel', selectedConsultation.id)}
                        aria-disabled={isDemoPreview}
                        title={isDemoPreview ? 'Sample consultation — actions are unavailable' : undefined}
                        className="lawyer-consultations-cancel-pill neu-btn rounded-2xl border-[1.5px] border-[#55382D] bg-[#ECE1D2] px-6 py-2.5 text-xs sm:text-sm font-semibold text-[#381F17] cursor-pointer"
                      >
                        Cancel
                      </button>
                    ) : (selectedConsultation.status === 'pending_payment' ||
                      selectedConsultation.status === 'payment_review' ||
                      selectedConsultation.status === 'completed') && (
                      <button
                        type="button"
                        onClick={() => openMessages(selectedConsultation.id)}
                        aria-disabled={isDemoPreview}
                        title={isDemoPreview ? 'Sample consultation — messaging is unavailable' : undefined}
                        className="lawyer-consultations-details-pill neu-btn-espresso rounded-2xl px-6 py-2.5 text-xs sm:text-sm font-semibold text-white transition-all cursor-pointer hover:brightness-110 flex items-center gap-2"
                      >
                        <span>💬</span>
                        <span>Message Channel</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => { setDetailsError(null); setShowDetails(true); }}
                      className="lawyer-consultations-details-pill neu-btn-espresso rounded-2xl px-6 py-2.5 text-xs sm:text-sm font-semibold text-white transition-all cursor-pointer"
                    >
                      View Details
                    </button>

                    {selectedConsultation.status === 'confirmed' && selectedConsultation.meetingLink && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!selectedConsultation.id.startsWith('demo-'))
                            window.open(selectedConsultation.meetingLink!, '_blank', 'noopener,noreferrer');
                        }}
                        aria-disabled={isDemoPreview}
                        title={isDemoPreview ? 'Sample consultation — meeting is unavailable' : undefined}
                        className="lawyer-consultations-join-pill flex items-center cursor-pointer"
                      >
                        <Image src="/figma-consultations-video.svg" width={22} height={22} loading="eager" alt="" aria-hidden="true" />
                        <span>Join Meet</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Carousel Controls (Matching Figma Mockup) */}
          <div className="lawyer-consultations-carousel-controls flex items-center justify-center gap-6 pt-2">
            <button
              type="button"
              onClick={() => goToIndex(carouselIndex > 0 ? carouselIndex - 1 : appointmentsToDisplay.length - 1)}
              disabled={appointmentsToDisplay.length <= 1}
              className="lawyer-consultations-prev-pill neu-btn w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold text-[#381F17] hover:text-[#C58B3C] cursor-pointer disabled:opacity-40"
              aria-label="Previous"
            >
              <Image src="/figma-consultations-prev.svg" width={49} height={49} loading="eager" alt="" aria-hidden="true" />
            </button>

            <div className="flex items-center gap-2.5">
              {appointmentsToDisplay.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => goToIndex(i)}
                  aria-label={`Go to consultation ${i + 1}`}
                  className={`rounded-full transition-all duration-300 motion-reduce:transition-none ${
                    i === carouselIndex
                      ? 'w-[14px] h-[14px] bg-[#D39758]'
                      : 'w-2.5 h-2.5 bg-[#341512]'
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => goToIndex(carouselIndex < appointmentsToDisplay.length - 1 ? carouselIndex + 1 : 0)}
              disabled={appointmentsToDisplay.length <= 1}
              className="lawyer-consultations-next-pill neu-btn w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold text-[#381F17] hover:text-[#C58B3C] cursor-pointer disabled:opacity-40"
              aria-label="Next"
            >
              <Image src="/figma-consultations-next.svg" width={49} height={49} loading="eager" alt="" aria-hidden="true" />
            </button>
          </div>
          </>
          )}
          </motion.div>
          </AnimatePresence>
        </motion.div>
      </motion.div>

      <motion.div data-lawyer-motion variants={consultationColumn} className="lawyer-consultations-pending-header flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <button type="button" onClick={() => setActiveTab('pending')} className="lawyer-consultations-pending-pill neu-plate rounded-full text-[#381F17]">
          Pending Approval for Consultations
        </button>
        <select
          aria-label="Filter pending consultations by period"
          value={periodFilter}
          onChange={(e) => {
            setPeriodFilter(e.target.value as PeriodFilter);
            setActiveTab('pending');
          }}
          className="lawyer-consultations-period-pill neu-inset-sm text-[#381F17]"
        >
          <option value="all">Filter By: All</option>
          <option value="month">Filter By: Month</option>
          <option value="week">Filter By: Week</option>
        </select>
        <Image className="lawyer-consultations-period-arrow" src="/figma-consultations-dropdown.svg" width={26} height={26} loading="eager" alt="" aria-hidden="true" />
      </motion.div>

      {/* View Details (design1) */}
      {showDetails && selectedConsultation && (
        <ConsultationDetailsModal {...buildDetailsProps(selectedConsultation)} />
      )}

      {/* Approve / Decline confirmation (design2) */}
      {decision && decisionTarget && (
        <ConsultationDecisionModal
          key={`${decision.mode}-${decision.id}`}
          mode={decision.mode}
          clientName={decisionTarget.client.name}
          when={`${decisionTarget.dateTag.replace('TODAY, ', '')} (${decisionTarget.timeTag})`}
          submitting={decisionSubmitting}
          error={decisionError}
          onCancel={() => !decisionSubmitting && setDecision(null)}
          onConfirm={handleDecision}
        />
      )}

    </motion.div>
  );
}

export default LawyerConsultationsView;
