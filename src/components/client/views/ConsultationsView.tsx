'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  AnimatePresence,
  motion,
  MotionConfig,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type PanInfo,
  type Variants,
} from 'motion/react';
import { cancelConsultationAction } from '@/app/actions/consultationActions';
import { fetchLive } from '@/lib/live/fetchLive';
import { useLiveRefresh, useViewActive } from '@/components/live/LiveProvider';
import {
  submitPaymentProofAction,
  getDocumentAccessUrlAction,
} from '@/app/actions/consultationActions';
import type { ClientConsultation, PaymentChannel } from '@/app/actions/consultationActions';
import {
  ConsultationDetailsModal,
  DetailsStatusRow,
  DetailsPersonBanner,
  DetailsCaseBlock,
} from '@/components/shared/ConsultationDetailsModal';
import type {
  ConsultationDetailsModalProps,
  DetailsSummary,
} from '@/components/shared/ConsultationDetailsModal';
import type { ViewKey } from '@/components/client/ClientShell';
import { ScreenLoader } from '@/components/shared/loading';
import { useSubmission } from '@/components/shared/feedback';
import { RescheduleModal, type RescheduleModalMode } from '@/components/shared/RescheduleModal';
import { CancellationRequestModal, type CancellationModalMode } from '@/components/shared/CancellationRequestModal';
import { useConsultationExtras } from '@/components/consultations/useConsultationExtras';
import { usePeopleAvatars } from '@/components/account/avatarStore';
import { getConsultationPaymentChannelAction } from '@/app/actions/lawyerPaymentQrActions';
import { joinOpensLabel, joinState, missedSummary, type ConsultationExtras } from '@/lib/consultations/extras';
import {
  NeuModal,
  NeuButton,
  NeuAlert,
  EmptyState,
  AlertIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  EXTRUDE,
  PhoneIcon,
  SearchIcon,
  VideoIcon,
} from '@/components/shared/neu';

interface ConsultationsViewProps {
  onNavigate?: (view: ViewKey) => void;
}

type Appointment = ClientConsultation;

type SelectedDate = { year: number; month: number; day: number };

const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// ─── Motion ──────────────────────────────────────────────────────────────────
const EASE_OUT = [0.2, 0.8, 0.2, 1] as const;

/** Page cascade: columns, then the cards inside them, rise in one after another. */
const PAGE_STAGGER: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.04 } },
};
const RISE_IN: Variants = {
  hidden: { opacity: 0, y: 22, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 230, damping: 26 } },
};
/** Month title rolls up/down with the browsing direction. */
const TITLE_SWAP: Variants = {
  enter: (d: number) => ({ opacity: 0, y: d * 10 }),
  center: { opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE_OUT } },
  exit: (d: number) => ({ opacity: 0, y: -d * 10, transition: { duration: 0.14 } }),
};
/** Month grid slides sideways with the browsing direction. */
const GRID_SLIDE: Variants = {
  enter: (d: number) => ({ opacity: 0, x: d * 28 }),
  center: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 340, damping: 32 } },
  exit: (d: number) => ({ opacity: 0, x: -d * 28, transition: { duration: 0.14 } }),
};
const LIST_STAGGER: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.03 } },
  exit: { opacity: 0, transition: { duration: 0.12 } },
};
const LIST_ITEM: Variants = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0, transition: { duration: 0.28, ease: EASE_OUT } },
};
/** Appointment card content slides in the direction you paged, its sections cascading. */
const CARD_SLIDE: Variants = {
  enter: (d: number) => ({ opacity: 0, x: d * 48 }),
  center: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring', stiffness: 300, damping: 32, staggerChildren: 0.05, delayChildren: 0.03 },
  },
  exit: (d: number) => ({ opacity: 0, x: -d * 48, transition: { duration: 0.16, ease: 'easeIn' } }),
};
const CARD_POP: Variants = {
  enter: { opacity: 0, scale: 0.92, y: -6 },
  center: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 420, damping: 22 } },
};
const CARD_ITEM: Variants = {
  enter: { opacity: 0, y: 10 },
  center: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE_OUT } },
};

const MONTH_LABELS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

/** Statuses a client may still cancel. */
const CANCELLABLE_STATUSES = ['pending', 'confirmed', 'awaiting_client_confirmation'];

/** A booking's reminders, with missed consultations and open cancellation requests explained. */
function remindersOf(a: ClientConsultation, extras: ConsultationExtras | null): string[] {
  const missed = extras?.attendance.missed;
  if (a.rawStatus === 'confirmed' && missed) {
    return [
      `${missedSummary(missed, 'client', a.lawyerName)} It is marked as a missed consultation.`,
      'You can message the attorney from the Messages tab to talk about what happens next.',
    ];
  }
  const pending = extras?.cancellation.pending;
  if (a.rawStatus === 'confirmed' && pending) {
    return [
      `You asked ${a.lawyerName} to cancel this consultation. It stays booked until they accept.`,
      'If the attorney accepts, your payment is marked for a refund.',
      ...a.reminders.slice(0, 1),
    ];
  }
  if (a.rawStatus === 'confirmed') {
    return [a.reminders[0], 'The Join Meet button opens 1 hour before the session starts.', ...a.reminders.slice(1)].filter(Boolean);
  }
  return a.reminders;
}

/**
 * Wraps the lawyer banner: a light sheen sweeps across it whenever a consultation arrives, and on
 * mouse devices it tilts a few degrees toward the pointer. The sheen sits in its own clipped layer
 * so the banner's raised shadow is never cut off.
 */
function BannerShowcase({ children, sheenKey }: { children: React.ReactNode; sheenKey: string }) {
  const reduce = useReducedMotion();
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const rotateX = useSpring(rx, { stiffness: 220, damping: 18 });
  const rotateY = useSpring(ry, { stiffness: 220, damping: 18 });
  return (
    <motion.div
      className="relative"
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      onPointerMove={(e) => {
        if (reduce || e.pointerType !== 'mouse') return;
        const r = e.currentTarget.getBoundingClientRect();
        ry.set(((e.clientX - r.left) / r.width - 0.5) * 5);
        rx.set(-((e.clientY - r.top) / r.height - 0.5) * 5);
      }}
      onPointerLeave={() => {
        rx.set(0);
        ry.set(0);
      }}
    >
      {children}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[20px] sm:rounded-[22px] overflow-hidden">
        <motion.span
          key={sheenKey}
          initial={{ x: '-140%' }}
          animate={{ x: '320%' }}
          transition={{ duration: 1.15, delay: 0.5, ease: [0.4, 0, 0.2, 1] }}
          className="absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/45 to-transparent"
        />
      </span>
    </motion.div>
  );
}

/** Above this many consultations the pager shows a counter instead of dots. */
const MAX_PAGER_DOTS = 12;

export function ConsultationsView({ onNavigate }: ConsultationsViewProps) {
  const router = useRouter();
  const [dbAppointments, setDbAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState<boolean>(true);
  // Full date (not just the day number) so the highlight doesn't repeat in every month browsed.
  const [selectedDate, setSelectedDate] = useState<SelectedDate>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
  });

  const appointmentsLoadedRef = useRef(false);
  const loadAppointments = useCallback(() => {
    return fetchLive('client-consultations')
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setDbAppointments(list);
        // Select the first booking's day only on the first load, not on live refreshes.
        if (!appointmentsLoadedRef.current) {
          if (list[0]) setSelectedDate({ year: list[0].year, month: list[0].month, day: list[0].day });
        }
        appointmentsLoadedRef.current = true;
      })
      .catch(() => {
        // Keep the bookings already on screen; the next refresh retries.
      })
      .finally(() => setLoadingAppointments(false));
  }, []);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  // Approvals, payment confirmations and Meet links appear without reopening the tab.
  useLiveRefresh(['consultations', 'payments'], loadAppointments, { fallbackMs: 30000 });
  const [activeAppointmentIndex, setActiveAppointmentIndex] = useState<number>(0);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);
  const [showMeetModal, setShowMeetModal] = useState<boolean>(false);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  /** +1 when moving to a later consultation / month, -1 when moving back (drives slide direction). */
  const [slideDir, setSlideDir] = useState<number>(1);
  const [monthDir, setMonthDir] = useState<number>(1);
  /** False until the calendar card has risen in; the first day-wave waits for it. */
  const [calendarIntroDone, setCalendarIntroDone] = useState<boolean>(false);

  // The portal keeps tabs mounted (and preloads them hidden), so mounting alone doesn't mean the
  // user is looking. Each time this tab becomes visible, bump a key that remounts the animated
  // layout so the entrance plays again. Data, selection and calendar month live in this
  // component and are kept. (State adjusted during render, React's pattern for reacting to a
  // changed value without an effect.)
  const isViewActive = useViewActive();
  const [wasViewActive, setWasViewActive] = useState<boolean>(isViewActive);
  const [entranceKey, setEntranceKey] = useState<number>(0);
  if (isViewActive !== wasViewActive) {
    setWasViewActive(isViewActive);
    if (isViewActive) {
      setEntranceKey((k) => k + 1);
      setCalendarIntroDone(false);
    }
  }
  const [reschedule, setReschedule] = useState<{ mode: RescheduleModalMode; id: string } | null>(null);
  const [rescheduleNotice, setRescheduleNotice] = useState<string | null>(null);

  const allAppointments = dbAppointments;
  const hasAppointments = allAppointments.length > 0;
  const currentAppointment: Appointment | undefined =
    allAppointments[activeAppointmentIndex] || allAppointments[0];

  const handleSelectAppointment = (idx: number) => {
    if (idx === activeAppointmentIndex) return;
    setSlideDir(idx > activeAppointmentIndex ? 1 : -1);
    setActiveAppointmentIndex(idx);
    const target = allAppointments[idx];
    if (target) {
      setSelectedDate({ year: target.year, month: target.month, day: target.day });
      const delta = target.year * 12 + target.month - (viewYear * 12 + viewMonth);
      if (delta !== 0) setMonthDir(delta > 0 ? 1 : -1);
      setViewMonth(target.month);
      setViewYear(target.year);
    }
  };

  // Attendance (join window, missed) and cancellation requests for paid bookings.
  const { extrasFor, now, joinMeeting, reload: reloadExtras } = useConsultationExtras();
  // Attorneys' profile photos (cards and View Details), kept live.
  const lawyerPhotos = usePeopleAvatars(allAppointments.map((a) => a.lawyerId));
  const [cancelRequest, setCancelRequest] = useState<{ mode: CancellationModalMode; id: string } | null>(null);
  const [cancelNotice, setCancelNotice] = useState<string | null>(null);

  const rawStatus = currentAppointment?.rawStatus ?? 'pending';
  const currentExtras = extrasFor(currentAppointment?.id);
  const currentJoin = joinState(currentExtras?.attendance, now);
  const currentMissed = currentExtras?.attendance.missed ?? null;
  // Paid (confirmed) bookings are cancelled by request, until the session starts.
  const canCancel =
    rawStatus === 'confirmed'
      ? !currentMissed && currentJoin !== 'ended' && (currentExtras ? currentExtras.cancellation.canRequest : true)
      : CANCELLABLE_STATUSES.includes(rawStatus);
  const canJoinMeet = rawStatus === 'confirmed' && !currentMissed && currentJoin !== 'ended';

  /** Cancel: paid bookings send a request to the attorney; others cancel right away. */
  const startCancel = (a: Appointment) => {
    setCancelError(null);
    if (a.rawStatus === 'confirmed') setCancelRequest({ mode: 'request', id: a.id });
    else setShowCancelModal(true);
  };

  /** The client may join from 1 hour before the start until the end. */
  const enterMeeting = (a: Appointment) => {
    if (!a.meetingLink || joinState(extrasFor(a.id)?.attendance, now) === 'not_yet') return;
    joinMeeting(a.id, a.meetingLink);
  };

  const handleConfirmCancel = async () => {
    if (!currentAppointment || isCancelling) return;
    setIsCancelling(true);
    setCancelError(null);
    try {
      const res = await cancelConsultationAction(currentAppointment.id);
      if (!('success' in res) || !res.success) {
        setCancelError(('error' in res && res.error) || 'We could not cancel this consultation.');
        return;
      }
      const cancelledId = currentAppointment.id;
      setDbAppointments((prev) =>
        prev.map((a) => (a.id === cancelledId ? { ...a, rawStatus: 'cancelled', status: 'CANCELLED' } : a))
      );
      setShowCancelModal(false);
    } catch {
      setCancelError('We could not cancel this consultation. Please try again.');
    } finally {
      setIsCancelling(false);
    }
  };

  // Calendar follows the month of the selected consultation, but allows explicit month browsing.
  const [viewMonth, setViewMonth] = useState<number>(() => currentAppointment?.month ?? new Date().getMonth());
  const [viewYear, setViewYear] = useState<number>(() => currentAppointment?.year ?? new Date().getFullYear());

  useEffect(() => {
    if (currentAppointment) {
      setViewMonth(currentAppointment.month);
      setViewYear(currentAppointment.year);
    }
  }, [currentAppointment]);

  const calendarYear = viewYear;
  const calendarMonth = viewMonth;

  const handlePrevMonth = () => {
    setMonthDir(-1);
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    setMonthDir(1);
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const daysInMonth = useMemo(() => {
    const slots: Array<{ day: number | null }> = [];
    const firstWeekday = new Date(calendarYear, calendarMonth, 1).getDay();
    const totalDays = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    for (let i = 0; i < firstWeekday; i++) slots.push({ day: null });
    for (let d = 1; d <= totalDays; d++) slots.push({ day: d });
    return slots;
  }, [calendarYear, calendarMonth]);
  const bookedDayTitle = (day: number) =>
    allAppointments
      .filter((a) => a.year === calendarYear && a.month === calendarMonth && a.day === day)
      .map((a) => `${a.lawyerName} · ${a.timeRange}`)
      .join('\n');
  const findAppointmentIndexOnDay = (day: number) =>
    allAppointments.findIndex((a) => a.year === calendarYear && a.month === calendarMonth && a.day === day);

  // Reminders for bookings on the date chosen in the calendar (de-duplicated).
  const activeReminders = Array.from(
    new Set(
      allAppointments
        .filter(
          (a) =>
            a.year === selectedDate.year &&
            a.month === selectedDate.month &&
            a.day === selectedDate.day &&
            a.rawStatus !== 'cancelled'
        )
        .flatMap((a) => remindersOf(a, extrasFor(a.id)))
    )
  );
  const selectedDateLabel = new Date(selectedDate.year, selectedDate.month, selectedDate.day).toLocaleDateString(
    'en-PH',
    { weekday: 'long', month: 'long', day: 'numeric' }
  );
  const selectedDateKey = `${selectedDate.year}-${selectedDate.month}-${selectedDate.day}`;
  const today = new Date();
  const isTodayCell = (day: number) =>
    calendarYear === today.getFullYear() && calendarMonth === today.getMonth() && day === today.getDate();
  const jumpToToday = () => {
    const delta = today.getFullYear() * 12 + today.getMonth() - (viewYear * 12 + viewMonth);
    if (delta !== 0) setMonthDir(delta > 0 ? 1 : -1);
    setViewMonth(today.getMonth());
    setViewYear(today.getFullYear());
    setSelectedDate({ year: today.getFullYear(), month: today.getMonth(), day: today.getDate() });
  };


  // ─── View Details / Payment modal ─────────────────────────────────────────
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  // Proof-of-payment upload: the details dialog morphs into the submission card while it runs.
  const paymentSubmission = useSubmission();
  const submittingPayment = paymentSubmission.processing;
  const [detailsError, setDetailsError] = useState<string | null>(null);
  // The QR to pay each booking with: the attorney's own payment QR, else the platform QR.
  const [paymentChannels, setPaymentChannels] = useState<Record<string, PaymentChannel>>({});

  const openDetails = () => {
    setDetailsError(null);
    setPaymentFile(null);
    setShowDetailsModal(true);
    const target = currentAppointment;
    if (target && target.rawStatus === 'awaiting_client_confirmation') {
      // Re-read each time: the attorney may have changed their QR, and the image link is short-lived.
      getConsultationPaymentChannelAction(target.id)
        .then((channel) => setPaymentChannels((prev) => ({ ...prev, [target.id]: channel })))
        .catch(() => undefined);
    }
  };

  const closeDetails = () => {
    if (submittingPayment) return;
    setShowDetailsModal(false);
    setPaymentFile(null);
    setDetailsError(null);
    paymentSubmission.reset();
  };

  const openProof = async (documentId: string) => {
    const res = await getDocumentAccessUrlAction(documentId);
    if ('url' in res && res.url) window.open(res.url, '_blank', 'noopener,noreferrer');
    else setDetailsError(('error' in res && res.error) || 'This file could not be opened.');
  };

  const openMessagesFor = (consultationId: string) => {
    // The shell keeps this screen mounted after switching tabs, and the details modal is
    // portalled to <body>, so it has to be closed here or it stays over the Messages screen.
    closeDetails();
    router.push(`/client/messages?thread=${consultationId}`);
  };

  const handleSubmitPayment = async (appointment: Appointment) => {
    if (!paymentFile || submittingPayment) return;
    const file = paymentFile;
    setDetailsError(null);
    const result = await paymentSubmission.run(async () => {
      const fd = new FormData();
      fd.append('consultationId', appointment.id);
      fd.append('file', file);
      const res = await submitPaymentProofAction(fd);
      if (!('consultation' in res) || !res.consultation) {
        return { ok: false, error: ('error' in res && res.error) || 'We could not submit your payment.' };
      }
      const updated = res.consultation;
      setDbAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setPaymentFile(null);
      return { ok: true };
    });
    // Shown in the details sheet if they go back to it with "Review Payment".
    if (result && !result.ok) setDetailsError(result.error);
  };

  const buildDetailsProps = (a: Appointment): ConsultationDetailsModalProps => {
    const isPaymentStage = a.rawStatus === 'awaiting_client_confirmation';
    const isPaid = a.rawStatus === 'confirmed' || a.rawStatus === 'completed';
    const needsPayment = isPaymentStage && (a.payment.state === 'none' || a.payment.state === 'rejected');
    const underReview = isPaymentStage && a.payment.state === 'submitted';
    // Attendance and cancellation requests (confirmed bookings only).
    const ax = a.rawStatus === 'confirmed' ? extrasFor(a.id) : null;
    const missed = ax?.attendance.missed ?? null;
    const join = joinState(ax?.attendance, now);
    const sessionOver = !!missed || join === 'ended';
    const cancelPending = ax?.cancellation.pending ?? null;
    const cancelLast =
      ax?.cancellation.last && ax.cancellation.last.byMe && ax.cancellation.last.recent && ['declined', 'expired'].includes(ax.cancellation.last.status)
        ? ax.cancellation.last
        : null;

    const summary: DetailsSummary = {
      title: isPaid || underReview ? 'Payment Summary' : 'Booking Summary',
      lawyerName: a.lawyerName,
      lawyerMeta: `Roll No. ${a.rollNumber}  |  IBP ${a.ibpChapter}`,
      modeLabel: a.communicationMode === 'video' ? 'Video Conference' : 'Audio Call',
      modeMeta: `Platform: Google Meet  |  Duration: ${a.durationLabel}`,
      dateLong: a.dateLong,
      timeRange: a.timeRange,
      sessionFee: a.payment.sessionFee,
      platformFee: a.payment.platformFee,
      total: a.payment.total,
    };

    let notice: ConsultationDetailsModalProps['notice'] = null;
    if (a.declineReason) notice = { tone: 'red', title: 'Reason for Declining', text: a.declineReason };
    else if (a.cancellationReason) notice = { tone: 'red', title: 'Reason for Cancellation', text: a.cancellationReason };
    else if (needsPayment && a.payment.state === 'rejected' && a.payment.rejectionReason) {
      notice = {
        tone: 'red',
        title: 'Your previous proof of payment was declined',
        text: `${a.payment.rejectionReason}\nPlease pay using the QR code and upload a new proof of payment.`,
      };
    } else if (underReview) {
      notice = {
        tone: 'amber',
        title: 'Payment under review',
        text: 'Your attorney is verifying your proof of payment. The Google Meet link will be shared once confirmed.',
      };
    } else if (missed) {
      notice = { tone: 'red', title: 'Missed consultation', text: missedSummary(missed, 'client', a.lawyerName) };
    } else if (cancelPending) {
      notice = {
        tone: 'amber',
        title: 'Cancellation request sent',
        text: `You asked ${a.lawyerName} to cancel this consultation. It stays booked until they accept.\nYour reason: ${cancelPending.reason}`,
      };
    } else if (cancelLast && !a.reschedule?.pending) {
      notice = {
        tone: 'red',
        title: cancelLast.status === 'declined' ? 'Your cancellation request was declined' : 'Your cancellation request lapsed',
        text:
          cancelLast.status === 'declined'
            ? `${a.lawyerName} declined it, so the consultation stays booked.${cancelLast.responseReason ? `\nReason: ${cancelLast.responseReason}` : ''}`
            : `${a.lawyerName} didn't answer before the session started, so the consultation stayed booked.`,
      };
    } else if (a.reschedule?.pending) {
      const p = a.reschedule.pending;
      notice = p.byMe
        ? {
          tone: 'amber',
          title: 'Reschedule request sent',
          text: `You asked to move this consultation to ${p.proposedDateLong}, ${p.proposedTimeRange}. Waiting for ${a.lawyerName} to answer.`,
        }
        : {
          tone: 'amber',
          title: `${a.lawyerName} asked to reschedule`,
          text: `Proposed new time: ${p.proposedDateLong}, ${p.proposedTimeRange}.
Reason: ${p.reason}`,
        };
    } else if (a.reschedule?.last?.byMe && a.reschedule.last.recent && ['declined', 'expired'].includes(a.reschedule.last.status)) {
      const last = a.reschedule.last;
      notice = {
        tone: 'red',
        title: last.status === 'declined' ? 'Your reschedule request was declined' : 'Your reschedule request expired',
        text: `${last.proposedLabel} was not confirmed, so the original schedule stays.${last.responseReason ? `
Reason: ${last.responseReason}` : ''}`,
      };
    }

    if (!notice && join === 'not_yet' && ax?.attendance.joinOpensAt && a.meetingLink) {
      notice = {
        tone: 'amber',
        title: `Join opens ${joinOpensLabel(ax.attendance.joinOpensAt, now).includes(' at ') ? 'on ' : 'at '}${joinOpensLabel(ax.attendance.joinOpensAt, now)}`,
        text: 'You can join the meeting from 1 hour before the scheduled start.',
      };
    }

    const close = { label: 'Close', variant: 'caramel' as const, onClick: closeDetails };
    let actions: ConsultationDetailsModalProps['actions'] = [close];
    if (needsPayment) {
      actions = [
        { label: 'Cancel', variant: 'outline', onClick: closeDetails, disabled: submittingPayment },
        {
          label: submittingPayment ? 'Submitting...' : 'Submit Payment',
          variant: 'caramel',
          onClick: () => handleSubmitPayment(a),
          disabled: !paymentFile || submittingPayment,
        },
      ];
    } else if (isPaid && a.rawStatus === 'confirmed' && !sessionOver) {
      actions = [
        {
          label: cancelPending ? 'Withdraw Cancellation' : 'Cancel',
          variant: 'outline',
          disabled: !cancelPending && !!ax && !ax.cancellation.canRequest,
          onClick: () => {
            setShowDetailsModal(false);
            setCancelError(null);
            setCancelRequest({ mode: cancelPending ? 'withdraw' : 'request', id: a.id });
          },
        },
        {
          label: a.reschedule?.pending ? (a.reschedule.pending.byMe ? 'Withdraw Request' : 'Review Request') : 'Reschedule',
          variant: 'espresso',
          disabled: !a.reschedule?.pending && !a.reschedule?.canRequest,
          onClick: () => {
            setShowDetailsModal(false);
            setReschedule({
              id: a.id,
              mode: a.reschedule?.pending ? (a.reschedule.pending.byMe ? 'withdraw' : 'respond') : 'request',
            });
          },
        },
        {
          label: 'Join Meet',
          variant: 'caramel',
          icon: 'video',
          disabled: !a.meetingLink || join === 'not_yet',
          onClick: () => enterMeeting(a),
        },
      ];
    }

    const proofId = a.payment.proofDocumentId;
    return {
      dateStr: a.dateStr,
      timeSlot: a.timeSlot,
      statusLabel: missed ? 'MISSED CONSULTATION' : a.status,
      statusTone:
        a.rawStatus === 'declined' || a.rawStatus === 'cancelled'
          ? 'grey'
          : missed
            ? 'red'
            : needsPayment
            ? 'red'
            : underReview
              ? 'amber'
              : isPaid
                ? 'green'
                : 'caramel',
      person: {
        name: a.lawyerName,
        photo: lawyerPhotos[a.lawyerId] ?? null,
        lines: [
          `Roll No. ${a.rollNumber}  |  IBP ${a.ibpChapter}`,
          a.practiceAreas.join(' • '),
          `★ ${a.rating} • ${a.experienceYrs} yrs practice`,
        ],
        rate: a.ratePerHour,
        // "Pending Payment" shows the lawyer's rate (as do declined/cancelled bookings, which have
        // no conversation to open); "Pending Confirmation", "Confirmed Appointment" and the other
        // active states show a Message button that opens this consultation's thread.
        onMessage:
          a.status === 'PENDING PAYMENT' || a.rawStatus === 'declined' || a.rawStatus === 'cancelled'
            ? undefined
            : () => openMessagesFor(a.id),
      },
      docket: a.docket,
      caseTitle: a.caseTitle,
      caseDescription: a.caseDescription,
      notice,
      summary: isPaymentStage || isPaid ? summary : null,
      payment: needsPayment
        ? {
          qrImageUrl: paymentChannels[a.id]?.qrImageUrl ?? null,
          qrCaption: paymentChannels[a.id]?.caption ?? null,
          file: paymentFile,
          onFileChange: (file) => {
            setDetailsError(null);
            setPaymentFile(file);
          },
          disabled: submittingPayment,
        }
        : null,
      proof:
        (underReview || isPaid) && a.payment.proofFileName
          ? { fileName: a.payment.proofFileName, onOpen: proofId ? () => openProof(proofId) : undefined }
          : null,
      error: detailsError,
      actions,
      onClose: closeDetails,
      submission: {
        phase: paymentSubmission.phase,
        error: paymentSubmission.error,
        onRetry: paymentSubmission.reset,
        processing: { title: 'Submitting your payment', message: `Sending your proof of payment to ${a.lawyerName}.` },
        success: {
          title: 'Payment submitted',
          message: `${a.lawyerName} will check your payment and confirm the appointment. The Google Meet link is shared once it's confirmed.`,
        },
        failure: { title: "We couldn't submit your payment", retryLabel: 'Review Payment' },
      },
    };
  };

  /** Swipe / drag the appointment card sideways to move to the next or previous consultation. */
  const handleCardDragEnd = (_: unknown, info: PanInfo) => {
    const swipe = info.offset.x + info.velocity.x * 0.2;
    if (swipe < -90 && activeAppointmentIndex < allAppointments.length - 1) {
      handleSelectAppointment(activeAppointmentIndex + 1);
    } else if (swipe > 90 && activeAppointmentIndex > 0) {
      handleSelectAppointment(activeAppointmentIndex - 1);
    }
  };

  // ← / → page through consultations when no dialog is open and focus isn't in a text field.
  const anyModalOpen = showCancelModal || showDetailsModal || showMeetModal || reschedule !== null || cancelRequest !== null;
  useEffect(() => {
    if (anyModalOpen || allAppointments.length < 2) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
      if (e.key === 'ArrowRight' && activeAppointmentIndex < allAppointments.length - 1) {
        handleSelectAppointment(activeAppointmentIndex + 1);
      } else if (e.key === 'ArrowLeft' && activeAppointmentIndex > 0) {
        handleSelectAppointment(activeAppointmentIndex - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (loadingAppointments) {
    return <ScreenLoader variant="page" />;
  }

  // Same data the View Details modal renders, so the booking card's top section matches it.
  const cardDetails = currentAppointment ? buildDetailsProps(currentAppointment) : null;

  return (
    <MotionConfig reducedMotion="user">
    <div className="px-8 sm:px-12 lg:px-16 xl:px-20 py-6 sm:py-12 max-w-[1300px] mx-auto space-y-7 sm:space-y-8 bg-[#E5D8CB]">
      {/* ─── Main 2-Column Grid ───────────── */}
      {!hasAppointments || !currentAppointment ? (
        <motion.div
          key={`empty-${entranceKey}`}
          initial={{ opacity: 0, y: 22, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 240, damping: 24 }}
        >
          <EmptyState
            variant="card"
            className="my-6 sm:my-10"
            icon={<CalendarIcon />}
            title="No Consultations Yet"
            description="You have no active or pending consultations. Browse verified Philippine lawyers to book a confidential session."
            action={
              <NeuButton
                variant="primary"
                icon={<SearchIcon className="w-4 h-4" />}
                onClick={() => {
                  if (onNavigate) onNavigate('lawyers');
                  else router.push('/client/lawyers');
                }}
              >
                Find a Lawyer
              </NeuButton>
            }
          />
        </motion.div>
      ) : (
        <motion.div
          key={`layout-${entranceKey}`}
          className="flex flex-col lg:flex-row items-start gap-6 lg:gap-7 xl:gap-8"
          variants={PAGE_STAGGER}
          initial="hidden"
          animate="show"
        >
          {/* ─── Left Column: Calendar & Reminders ─── */}
          {/* lg+: same one-screen height as the right column; the calendar keeps its natural
              height and the reminders card takes the rest, scrolling inside if it overflows. */}
          <motion.div
            variants={PAGE_STAGGER}
            className="w-full lg:w-[310px] xl:w-[360px] lg:shrink-0 flex flex-col gap-5 lg:h-[calc(100dvh-10rem)] lg:min-h-[34rem]"
          >
            {/* 1. Calendar */}
            <motion.div
              variants={EXTRUDE}
              onAnimationComplete={() => setCalendarIntroDone(true)}
              className="neu-raised bg-[#E5D8CB] rounded-[24px] sm:rounded-[26px] p-4 sm:p-5 shrink-0"
            >
              {/* Month header: title left, controls right */}
              <div className="flex items-center justify-between gap-2 mb-3.5">
                <div className="min-w-0 leading-none overflow-hidden">
                  <AnimatePresence mode="popLayout" initial={false} custom={monthDir}>
                    <motion.div
                      key={`${calendarYear}-${calendarMonth}`}
                      custom={monthDir}
                      variants={TITLE_SWAP}
                      initial="enter"
                      animate="center"
                      exit="exit"
                    >
                      <p className="font-lora text-lg sm:text-xl font-bold text-[#341512] capitalize truncate">
                        {MONTH_LABELS[calendarMonth].toLowerCase()}
                      </p>
                      <p className="font-lora text-[11px] font-bold tracking-[0.2em] text-[#C58B3C] mt-1">{calendarYear}</p>
                    </motion.div>
                  </AnimatePresence>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <motion.button
                    type="button"
                    onClick={jumpToToday}
                    whileHover={{ y: -1.5 }}
                    whileTap={{ scale: 0.92 }}
                    className="neu-raised-sm h-7 px-3 rounded-full font-lora text-[10.5px] font-bold uppercase tracking-wider text-[#5C4535] hover:text-[#C58B3C] transition-colors cursor-pointer select-none"
                  >
                    Today
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={handlePrevMonth}
                    aria-label="Previous month"
                    whileHover={{ x: -2 }}
                    whileTap={{ scale: 0.86 }}
                    className="neu-raised-sm size-7 rounded-full flex items-center justify-center text-[#5C4535] hover:text-[#C58B3C] transition-colors cursor-pointer"
                  >
                    <ChevronLeftIcon className="w-3.5 h-3.5" />
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={handleNextMonth}
                    aria-label="Next month"
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.86 }}
                    className="neu-raised-sm size-7 rounded-full flex items-center justify-center text-[#5C4535] hover:text-[#C58B3C] transition-colors cursor-pointer"
                  >
                    <ChevronRightIcon className="w-3.5 h-3.5" />
                  </motion.button>
                </div>
              </div>

              {/* Recessed date well: the month grid slides in the direction you browse */}
              <div className="neu-recessed rounded-[18px] px-2 sm:px-2.5 py-2.5 overflow-hidden">
                <div className="grid grid-cols-7 text-center font-inter text-[10px] font-semibold uppercase text-[#9E8E7D] pb-1.5">
                  {WEEKDAY_INITIALS.map((d, i) => (
                    <span key={i}>{d}</span>
                  ))}
                </div>
                <div className="relative">
                  <AnimatePresence mode="popLayout" initial={false} custom={monthDir}>
                    <motion.div
                      key={`${calendarYear}-${calendarMonth}`}
                      custom={monthDir}
                      variants={GRID_SLIDE}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      className="grid grid-cols-7 gap-y-1.5 text-center"
                    >
                      {daysInMonth.map((item, idx) => {
                        if (!item.day) {
                          return <div key={`empty-${idx}`} className="h-7" />;
                        }
                        const day = item.day;
                        // Diagonal wave: cells further down-right arrive a touch later.
                        const waveDelay = (calendarIntroDone ? 0.02 : 0.35) + (Math.floor(idx / 7) + (idx % 7)) * 0.018;
                        const isSelected =
                          day === selectedDate.day &&
                          calendarMonth === selectedDate.month &&
                          calendarYear === selectedDate.year;
                        const isToday = isTodayCell(day);
                        const hasAppointment = findAppointmentIndexOnDay(day) !== -1;
                        return (
                          <motion.div
                            key={`day-${day}`}
                            initial={{ opacity: 0, scale: 0.4 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: 'spring', stiffness: 420, damping: 20, delay: waveDelay }}
                          >
                          <motion.button
                            type="button"
                            onClick={() => {
                              const aptIdx = findAppointmentIndexOnDay(day);
                              if (aptIdx !== -1) handleSelectAppointment(aptIdx);
                              setSelectedDate({ year: calendarYear, month: calendarMonth, day });
                            }}
                            whileHover={isSelected ? undefined : { scale: 1.12 }}
                            whileTap={{ scale: 0.88 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                            aria-label={`${MONTH_LABELS[calendarMonth].toLowerCase()} ${day}${hasAppointment ? ', has a consultation' : ''}`}
                            title={hasAppointment ? bookedDayTitle(day) : undefined}
                            aria-pressed={isSelected}
                            aria-current={isToday ? 'date' : undefined}
                            className={`relative mx-auto size-7 rounded-full flex items-center justify-center font-inter text-[11.5px] select-none cursor-pointer transition-colors ${isSelected
                              ? 'font-bold text-[#341512]'
                              : hasAppointment
                                ? 'neu-day-booked font-bold text-[#B07A34]'
                                : 'font-normal text-[#5C4535] hover:bg-[#D39758]/15'
                              } ${
                              // outline, not ring: rings are box-shadows and the day classes' own
                              // box-shadow would replace them on booked/selected days.
                              isToday ? 'outline-[1.5px] outline-solid outline-[#C58B3C] outline-offset-2' : ''}`}
                          >
                            {/* The caramel selection glides from day to day. */}
                            {isSelected && (
                              <motion.span
                                layoutId="calendar-selected-day"
                                transition={{ type: 'spring', stiffness: 520, damping: 34 }}
                                className="absolute inset-0 rounded-full neu-btn-caramel"
                              />
                            )}
                            <span className="relative leading-none">{day}</span>
                          </motion.button>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-4 pt-3 font-inter text-[10px] text-[#7D6855] select-none">
                <span className="flex items-center gap-1.5">
                  <span className="neu-day-booked w-3 h-3 rounded-full" /> Consultation
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full neu-btn-caramel bg-[#D49E56]" /> Selected
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full outline-[1.5px] outline-solid outline-[#C58B3C]" /> Today
                </span>
              </div>
            </motion.div>

            {/* 2. Reminders */}
            <motion.div
              variants={EXTRUDE}
              // Same shadow and lighting as the calendar card (.neu-raised); the inline style
              // keeps the caramel fill, since .neu-raised sets its own background colour.
              className="neu-raised rounded-[24px] sm:rounded-[26px] p-4 sm:p-5 flex flex-col gap-4 sm:gap-5 lg:flex-1 lg:min-h-0"
              style={{ backgroundColor: 'rgba(211, 151, 88, 0.3)' }}
            >
              <div className="flex items-center gap-3 shrink-0">
                {/* The bell gives a little ring whenever the chosen date changes. */}
                <motion.div
                  key={`bell-${selectedDateKey}`}
                  initial={{ rotate: 0 }}
                  animate={{ rotate: [0, -16, 13, -9, 6, 0] }}
                  transition={{ duration: 0.6, ease: 'easeInOut' }}
                  style={{ transformOrigin: '50% 15%' }}
                  className="neu-btn-banner size-9 rounded-full flex items-center justify-center shrink-0 text-[#341512]"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 01-3.46 0" />
                  </svg>
                </motion.div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-lora text-base sm:text-[17px] font-bold text-[#341512] leading-tight">Reminders</h3>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.p
                      key={selectedDateKey}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18 }}
                      className="font-inter text-[11px] text-[#5C4535] truncate"
                    >
                      {selectedDateLabel}
                    </motion.p>
                  </AnimatePresence>
                </div>
                <AnimatePresence>
                  {activeReminders.length > 0 && (
                    <motion.span
                      key={`count-${activeReminders.length}`}
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 520, damping: 20 }}
                      className="neu-inset-banner shrink-0 min-w-7 h-6 px-2.5 rounded-full text-[#5C4535] font-inter text-[11px] font-bold flex items-center justify-center"
                    >
                      {activeReminders.length}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              <AnimatePresence mode="wait" initial={false}>
                {activeReminders.length === 0 ? (
                  <motion.div
                    key={`empty-${selectedDateKey}`}
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.2 }}
                    className="flex-1 flex flex-col items-center justify-center text-center gap-1 py-4"
                  >
                    <p className="font-lora text-sm font-semibold text-[#5C4535]">Nothing scheduled</p>
                    <p className="font-inter text-[11px] text-[#7D6855]">No reminders for this date.</p>
                  </motion.div>
                ) : (
                  <motion.ul
                    key={`list-${selectedDateKey}`}
                    variants={LIST_STAGGER}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    className="flex-1 min-h-0 overflow-y-auto neu-scrollbar-discrete -mr-2 pr-3 pl-1.5 divide-y divide-dotted divide-[#B8946E]/60"
                  >
                    {activeReminders.map((reminder, idx) => (
                      <motion.li key={idx} variants={LIST_ITEM} className="flex items-start gap-2.5 py-2.5 first:pt-0 last:pb-0">
                        {/* Bullet centred on the first text line (12px × leading-snug ≈ 16.5px tall). */}
                        <span aria-hidden="true" className="mt-[5.5px] w-1.5 h-1.5 shrink-0 rounded-full bg-[#B07A34]" />
                        <span className="font-inter text-[11.5px] sm:text-[12px] leading-snug text-[#3E2A1E]">{reminder}</span>
                      </motion.li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>

          {/* ─── Right Column: Appointment Card ─── */}
          {/* lg+: exactly one screen tall (100dvh − 4rem shell header − 6rem page padding) so the
              card and its pagination are both visible; the description absorbs the leftover space. */}
          <motion.div
            variants={PAGE_STAGGER}
            className="w-full flex-1 min-w-0 flex flex-col gap-4 sm:gap-5 lg:h-[calc(100dvh-10rem)] lg:min-h-[34rem]"
          >
            <motion.div
              variants={EXTRUDE}
              className="neu-raised bg-[#E5D8CB] rounded-[28px] sm:rounded-[32px] p-5 sm:p-6 lg:p-7 flex flex-col lg:flex-1 lg:min-h-0 overflow-hidden"
            >
              {/* Switching consultations slides the content in the direction you moved. */}
              <AnimatePresence mode="wait" initial={false} custom={slideDir}>
                <motion.div
                  key={currentAppointment.id}
                  custom={slideDir}
                  variants={CARD_SLIDE}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  drag={allAppointments.length > 1 ? 'x' : false}
                  dragDirectionLock
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.22}
                  onDragEnd={handleCardDragEnd}
                  // lg+ scrolls, and a scroll box clips at its edges: -m-5 p-5 gives the raised
                  // pills / banner / buttons 20px all round for their shadows (they reach ~18px)
                  // without moving anything. The card's p-7 has room for it.
                  className="flex flex-col gap-4 sm:gap-5 lg:flex-1 lg:min-h-0 min-w-0 touch-pan-y lg:overflow-y-auto lg:overflow-x-hidden neu-scrollbar-discrete lg:-m-5 lg:p-5"
                >
                  {/* Top section mirrors the View Details modal (shared components) */}
                  <motion.div variants={CARD_POP} className="shrink-0">
                    <DetailsStatusRow {...cardDetails!} fit />
                  </motion.div>

                  <AnimatePresence initial={false}>
                    {rescheduleNotice && (
                      <NeuAlert key="reschedule-notice" tone="success" onDismiss={() => setRescheduleNotice(null)} className="shrink-0">
                        {rescheduleNotice}
                      </NeuAlert>
                    )}

                    {cancelNotice && (
                      <NeuAlert key="cancel-notice" tone="success" onDismiss={() => setCancelNotice(null)} className="shrink-0">
                        {cancelNotice}
                      </NeuAlert>
                    )}

                    {currentAppointment.rawStatus === 'confirmed' && currentExtras?.cancellation.pending && (
                      <NeuAlert
                        key="cancel-pending"
                        tone="warning"
                        className="shrink-0"
                        title="Cancellation request sent"
                        action={
                          <NeuButton size="sm" variant="secondary" onClick={() => setCancelRequest({ mode: 'withdraw', id: currentAppointment.id })}>
                            Withdraw
                          </NeuButton>
                        }
                      >
                        Waiting for {currentAppointment.lawyerName} to accept. The consultation stays booked until then.
                      </NeuAlert>
                    )}

                    {currentAppointment.rawStatus === 'confirmed' &&
                      !currentExtras?.cancellation.pending &&
                      currentExtras?.cancellation.last?.status === 'declined' &&
                      currentExtras.cancellation.last.byMe &&
                      currentExtras.cancellation.last.recent && (
                        <NeuAlert key="cancel-declined" tone="error" className="shrink-0" title="Cancellation request declined">
                          {currentAppointment.lawyerName} declined it, so the consultation stays booked.
                          {currentExtras.cancellation.last.responseReason ? ` Reason: ${currentExtras.cancellation.last.responseReason}` : ''}
                        </NeuAlert>
                      )}

                    {currentAppointment.reschedule?.pending && (
                      <NeuAlert
                        key="reschedule-pending"
                        tone="warning"
                        className="shrink-0"
                        title={currentAppointment.reschedule.pending.byMe ? 'Reschedule request sent' : 'Reschedule requested'}
                        action={
                          <NeuButton
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              setReschedule({
                                id: currentAppointment.id,
                                mode: currentAppointment.reschedule?.pending?.byMe ? 'withdraw' : 'respond',
                              })
                            }
                          >
                            {currentAppointment.reschedule.pending.byMe ? 'Withdraw' : 'Review'}
                          </NeuButton>
                        }
                      >
                        {currentAppointment.reschedule.pending.byMe
                          ? 'You asked to move this consultation to '
                          : `${currentAppointment.lawyerName} asked to move this consultation to `}
                        <strong className="font-semibold">
                          {currentAppointment.reschedule.pending.proposedDateLong}, {currentAppointment.reschedule.pending.proposedTimeRange}
                        </strong>
                        {currentAppointment.reschedule.pending.byMe ? '. Waiting for an answer.' : '.'}
                      </NeuAlert>
                    )}
                  </AnimatePresence>

                  <motion.div variants={CARD_ITEM} className="shrink-0 min-w-0">
                    <BannerShowcase sheenKey={currentAppointment.id}>
                      <DetailsPersonBanner person={cardDetails!.person} />
                    </BannerShowcase>
                  </motion.div>
                  <motion.div variants={CARD_ITEM} className="flex-1 min-h-0 min-w-0 flex flex-col">
                    <DetailsCaseBlock {...cardDetails!} onSeeMore={openDetails} />
                  </motion.div>

                  {/* Action Buttons Row */}
                  <motion.div variants={CARD_ITEM} className="shrink-0 flex flex-wrap items-center justify-end gap-3 pt-2">
                    {/* Cancel Button */}
                    {canCancel && (
                      <button
                        type="button"
                        onClick={() => startCancel(currentAppointment)}
                        className="px-5 sm:px-6 py-2 rounded-[12px] border border-[#341512]/50 bg-[#E5D8CB] font-lora text-xs font-semibold text-[#341512] hover:bg-[#DDCFC0] hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-200 shadow-sm cursor-pointer motion-reduce:transform-none"
                      >
                        Cancel
                      </button>
                    )}

                    {/* View Details Button */}
                    <button
                      type="button"
                      onClick={openDetails}
                      className="neu-btn-espresso px-5 sm:px-6 py-2 rounded-[12px] bg-[#4A2E25] font-lora text-xs font-semibold text-white transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 cursor-pointer motion-reduce:transform-none"
                    >
                      View Details
                    </button>

                    {/* Join Meet Button: a soft beacon pulses once the Meet link is ready */}
                    {canJoinMeet && (
                      <button
                        type="button"
                        onClick={() => setShowMeetModal(true)}
                        className="neu-btn-caramel relative px-5 sm:px-6 py-2 rounded-[12px] bg-[#D49E56] font-lora text-xs font-bold text-[#341512] flex items-center gap-1.5 transition-all duration-200 hover:brightness-105 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 cursor-pointer motion-reduce:transform-none"
                      >
                        {currentAppointment.meetingLink && currentJoin !== 'not_yet' && (
                          <span aria-hidden="true" className="absolute -top-1 -right-1 size-2.5">
                            <span className="neu-beacon absolute inset-0 rounded-full bg-[#1FAA00]" />
                            <span className="absolute inset-0 rounded-full bg-[#1FAA00] ring-2 ring-[#E5D8CB]" />
                          </span>
                        )}
                        <VideoIcon className="w-3.5 h-3.5 text-[#341512]" />
                        <span>Join Meet</span>
                      </button>
                    )}
                  </motion.div>
                </motion.div>
              </AnimatePresence>
            </motion.div>

            {/* Pagination: the caramel dot glides to the active consultation. Swiping the card and ← / → keys also work. */}
            <motion.div variants={RISE_IN} className="shrink-0 flex items-center justify-center gap-5 select-none">
              <motion.button
                type="button"
                onClick={() => handleSelectAppointment(Math.max(0, activeAppointmentIndex - 1))}
                disabled={activeAppointmentIndex <= 0}
                whileHover={activeAppointmentIndex <= 0 ? undefined : { x: -2 }}
                whileTap={activeAppointmentIndex <= 0 ? undefined : { scale: 0.86 }}
                className="neu-raised-sm size-8 sm:size-9 rounded-full bg-[#E5D8CB] flex items-center justify-center text-[#341512] hover:text-[#C58B3C] transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                aria-label="Previous consultation"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </motion.button>

              {/* Long lists show "3 / 24" instead of dots, so the pager never runs past the column. */}
              {allAppointments.length > MAX_PAGER_DOTS ? (
                <span className="min-w-[4.5rem] text-center font-inter text-xs font-semibold tabular-nums text-[#5C4535]">
                  {activeAppointmentIndex + 1} / {allAppointments.length}
                </span>
              ) : (
              <div className="flex min-w-0 flex-wrap items-center justify-center gap-2.5" role="tablist" aria-label="Consultations">
                {allAppointments.map((a, idx) => {
                  const isActive = idx === activeAppointmentIndex;
                  return (
                    <motion.button
                      key={a.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => handleSelectAppointment(idx)}
                      whileHover={{ scale: 1.3 }}
                      whileTap={{ scale: 0.85 }}
                      className="relative size-3 flex items-center justify-center cursor-pointer"
                      aria-label={`Consultation ${idx + 1} of ${allAppointments.length}`}
                    >
                      <span className="size-2 rounded-full bg-[#341512]/80" />
                      {isActive && (
                        <motion.span
                          layoutId="consultation-pager-dot"
                          transition={{ type: 'spring', stiffness: 480, damping: 32 }}
                          className="absolute inset-0 rounded-full bg-[#C58B3C] shadow-[0_0_0_3px_rgba(197,139,60,0.18)]"
                        />
                      )}
                    </motion.button>
                  );
                })}
              </div>
              )}

              <motion.button
                type="button"
                onClick={() => handleSelectAppointment(Math.min(allAppointments.length - 1, activeAppointmentIndex + 1))}
                disabled={activeAppointmentIndex >= allAppointments.length - 1}
                whileHover={activeAppointmentIndex >= allAppointments.length - 1 ? undefined : { x: 2 }}
                whileTap={activeAppointmentIndex >= allAppointments.length - 1 ? undefined : { scale: 0.86 }}
                className="neu-raised-sm size-8 sm:size-9 rounded-full bg-[#E5D8CB] flex items-center justify-center text-[#341512] hover:text-[#C58B3C] transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                aria-label="Next consultation"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </motion.button>
            </motion.div>
            <p className="sr-only" aria-live="polite">
              Showing consultation {activeAppointmentIndex + 1} of {allAppointments.length}
            </p>
          </motion.div>
        </motion.div>
      )}

      {/* ─── Cancel Consultation Modal ─────────────────────────────────────── */}
      <AnimatePresence>
      {showCancelModal && currentAppointment && (
        <NeuModal
          key="cancel-modal"
          onClose={() => setShowCancelModal(false)}
          dismissible={!isCancelling}
          size="sm"
          icon={<AlertIcon className="w-5 h-5" />}
          iconTone="danger"
          title="Cancel this consultation?"
          subtitle="The attorney is notified right away. This can't be undone."
          footer={
            <>
              <NeuButton variant="secondary" onClick={() => setShowCancelModal(false)} disabled={isCancelling}>
                Keep Consultation
              </NeuButton>
              <NeuButton variant="danger" onClick={handleConfirmCancel} loading={isCancelling}>
                {isCancelling ? 'Cancelling…' : 'Cancel Consultation'}
              </NeuButton>
            </>
          }
        >
          <div className="neu-raised bg-[#E5D8CB] rounded-[22px] p-4 sm:p-5 space-y-3">
            <p className="font-lora text-base font-bold text-[#341512] leading-tight">{currentAppointment.lawyerName}</p>
            <div className="border-t border-dotted border-[#C8B59E] pt-3 space-y-2 font-inter text-xs sm:text-[13px] text-[#3E2A1E]">
              <p className="flex items-center gap-2.5">
                <CalendarIcon className="w-4 h-4 text-[#C58B3C] shrink-0" />
                {currentAppointment.dateLong}
              </p>
              <p className="flex items-center gap-2.5">
                <ClockIcon className="w-4 h-4 text-[#C58B3C] shrink-0" />
                {currentAppointment.timeRange}
              </p>
            </div>
          </div>
          {currentAppointment.payment.state === 'verified' && (
            <NeuAlert tone="info">Your payment was confirmed, so cancelling marks it for a refund.</NeuAlert>
          )}
          {cancelError && <NeuAlert tone="error">{cancelError}</NeuAlert>}
        </NeuModal>
      )}
      </AnimatePresence>

      {/* ─── View Details Modal (pending / payment / confirmed designs) ─── */}
      <AnimatePresence>
        {showDetailsModal && currentAppointment && (
          <ConsultationDetailsModal key="details-modal" {...buildDetailsProps(currentAppointment)} />
        )}
      </AnimatePresence>

      {/* ─── Reschedule (request / respond / withdraw) ─────────────────────── */}
      <AnimatePresence>
      {reschedule &&
        (() => {
          const target = allAppointments.find((x) => x.id === reschedule.id);
          if (!target || !target.reschedule) return null;
          return (
            <RescheduleModal
              key={`${reschedule.mode}-${reschedule.id}`}
              mode={reschedule.mode}
              consultationId={target.id}
              counterpartName={target.lawyerName}
              currentLabel={`${target.dateLong} · ${target.timeRange}`}
              currentStart={target.scheduledStart}
              pending={target.reschedule.pending}
              remaining={target.reschedule.remaining}
              onClose={() => setReschedule(null)}
              onDone={(message) => {
                setReschedule(null);
                setRescheduleNotice(message);
                void loadAppointments();
              }}
            />
          );
        })()}
      </AnimatePresence>

      {/* ─── Cancellation request for a paid booking (request / withdraw) ──── */}
      {(() => {
        const target = cancelRequest ? allAppointments.find((x) => x.id === cancelRequest.id) : undefined;
        return (
          <CancellationRequestModal
            open={!!cancelRequest && !!target}
            mode={cancelRequest?.mode ?? 'request'}
            consultationId={target?.id ?? ''}
            counterpartName={target?.lawyerName ?? ''}
            dateLong={target?.dateLong ?? ''}
            timeRange={target?.timeRange ?? ''}
            requestReason={target ? extrasFor(target.id)?.cancellation.pending?.reason : null}
            onClose={() => setCancelRequest(null)}
            onDone={(message) => {
              setCancelRequest(null);
              setCancelNotice(message);
              void reloadExtras();
              void loadAppointments();
            }}
          />
        );
      })()}

      {/* ─── Join Meet Preview Modal (Neumorphic Design) ───────────────────── */}
      <AnimatePresence>
      {showMeetModal && currentAppointment && (
        <NeuModal
          key="meet-modal"
          onClose={() => setShowMeetModal(false)}
          size="md"
          icon={currentAppointment.communicationMode === 'audio' ? <PhoneIcon className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}
          title={currentAppointment.communicationMode === 'audio' ? 'Join Audio Call' : 'Join Video Consultation'}
          subtitle={`Your session with ${currentAppointment.lawyerName} opens in Google Meet in a new tab.`}
          footer={
            <>
              <NeuButton variant="secondary" onClick={() => setShowMeetModal(false)}>
                Not Yet
              </NeuButton>
              <NeuButton
                variant="primary"
                disabled={!currentAppointment.meetingLink || currentJoin === 'not_yet'}
                icon={<VideoIcon className="w-4 h-4" />}
                onClick={() => {
                  if (!currentAppointment.meetingLink || currentJoin === 'not_yet') return;
                  enterMeeting(currentAppointment);
                  setShowMeetModal(false);
                }}
              >
                Enter Meeting
              </NeuButton>
            </>
          }
        >
          {/* Recessed "room" preview */}
          <div className="neu-recessed rounded-[24px] aspect-[16/8] w-full flex flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="relative neu-raised-sm size-14 rounded-full flex items-center justify-center text-[#C58B3C]">
              {currentAppointment.meetingLink && currentJoin !== 'not_yet' && (
                <span aria-hidden="true" className="neu-beacon absolute inset-0 rounded-full border-2 border-[#1FAA00]/50" />
              )}
              {currentAppointment.communicationMode === 'audio' ? <PhoneIcon className="w-6 h-6" /> : <VideoIcon className="w-6 h-6" />}
            </div>
            <div className="space-y-1">
              <p className="font-lora text-sm sm:text-base font-bold text-[#341512]">{currentAppointment.lawyerName}</p>
              <p className="font-inter text-[11.5px] sm:text-xs text-[#5C4535]">
                {currentAppointment.dateLong} · {currentAppointment.timeRange}
              </p>
            </div>
          </div>

          {currentAppointment.meetingLink && currentJoin === 'not_yet' && currentExtras?.attendance.joinOpensAt ? (
            <NeuAlert
              tone="warning"
              title={`Join opens ${joinOpensLabel(currentExtras.attendance.joinOpensAt, now).includes(' at ') ? 'on ' : 'at '}${joinOpensLabel(currentExtras.attendance.joinOpensAt, now)}`}
            >
              You can enter the meeting from 1 hour before the scheduled start. Come back then to join.
            </NeuAlert>
          ) : currentAppointment.meetingLink ? (
            <NeuAlert tone="success" title="Meeting link ready">
              Join a few minutes early and check your {currentAppointment.communicationMode === 'audio' ? 'microphone and speakers' : 'camera and microphone'}.
            </NeuAlert>
          ) : (
            <NeuAlert tone="warning" title="Link not shared yet">
              Your attorney hasn&apos;t added the Google Meet link. It will appear here once it&apos;s available.
            </NeuAlert>
          )}
        </NeuModal>
      )}
      </AnimatePresence>
    </div>
    </MotionConfig>
  );
}

export default ConsultationsView;
