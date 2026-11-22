'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { cancelConsultationAction } from '@/app/actions/consultationActions';
import { fetchLive } from '@/lib/live/fetchLive';
import { useLiveRefresh } from '@/components/live/LiveProvider';
import {
  getPaymentChannelAction,
  submitPaymentProofAction,
  getDocumentAccessUrlAction,
} from '@/app/actions/consultationActions';
import type { ClientConsultation, PaymentChannel } from '@/app/actions/consultationActions';
import { ConsultationDetailsModal } from '@/components/shared/ConsultationDetailsModal';
import type {
  ConsultationDetailsModalProps,
  DetailsSummary,
} from '@/components/shared/ConsultationDetailsModal';
import type { ViewKey } from '@/components/client/ClientShell';
import { ConsultationsSkeleton } from '@/components/skeletons';
import { RescheduleModal, type RescheduleModalMode } from '@/components/shared/RescheduleModal';

interface ConsultationsViewProps {
  onNavigate?: (view: ViewKey) => void;
}

type Appointment = ClientConsultation;

const MONTH_LABELS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

/** Statuses a client may still cancel. */
const CANCELLABLE_STATUSES = ['pending', 'confirmed', 'awaiting_client_confirmation'];

const DEFAULT_REMINDERS = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
  'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
  'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
];

const DEFAULT_APPOINTMENT: Appointment = {
  id: 'consultation-default-1',
  status: 'CONFIRMED APPOINTMENT',
  rawStatus: 'confirmed',
  day: 23,
  month: 8, // September (0-indexed: 8)
  year: 2026,
  dateStr: 'TODAY, SEPTEMBER 23, 2026',
  timeSlot: '3:00 PM - 4:00 PM • PST, GMT+8',
  scheduledStart: '2026-09-23T15:00:00+08:00',
  communicationMode: 'video',
  lawyerId: '22222222-2222-4222-8222-000000000001',
  lawyerName: 'Atty. Maria Elena Santos, Ll.B.',
  rollNumber: '58942',
  ibpChapter: 'MAKATI',
  practiceAreas: ['Labor & Employment', 'Corporate', 'Civil Law'],
  rating: '4.9 (53 Reviews)',
  experienceYrs: 9,
  ratePerHour: 1500,
  docket: 'SUBJECT MATTER & CASE DOCKET',
  caseTitle: 'Makati Residential Lease Deposit Dispute & Formal Notice to Vacate',
  caseDescription:
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
  meetingLink: 'https://meet.google.com/justicia-consultation',
  attachedFiles: [],
  reminders: DEFAULT_REMINDERS,
  declineReason: null,
  cancellationReason: null,
  dateLong: 'Wednesday, September 23, 2026',
  timeRange: '3:00 PM - 4:00 PM',
  durationLabel: '1 hour',
  payment: {
    state: 'verified',
    proofDocumentId: null,
    proofFileName: null,
    submittedAt: null,
    reviewedAt: null,
    rejectionReason: null,
    sessionFee: 1500,
    platformFee: 150,
    total: 1650,
  },
  reschedule: null,
};

export function ConsultationsView({ onNavigate }: ConsultationsViewProps) {
  const router = useRouter();
  const [dbAppointments, setDbAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState<boolean>(true);
  const [selectedDay, setSelectedDay] = useState<number>(1);

  const appointmentsLoadedRef = useRef(false);
  const loadAppointments = useCallback(() => {
    return fetchLive('client-consultations')
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setDbAppointments(list);
        // Select the first booking's day only on the first load, not on live refreshes.
        if (!appointmentsLoadedRef.current) {
          if (list[0]) {
            setSelectedDay(list[0].day);
          } else {
            setSelectedDay(23);
          }
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
  const [isSwitching, setIsSwitching] = useState<boolean>(false);
  const [reschedule, setReschedule] = useState<{ mode: RescheduleModalMode; id: string } | null>(null);
  const [rescheduleNotice, setRescheduleNotice] = useState<string | null>(null);

  const allAppointments = dbAppointments.length > 0 ? dbAppointments : [DEFAULT_APPOINTMENT];
  const hasAppointments = allAppointments.length > 0;
  const currentAppointment: Appointment | undefined =
    allAppointments[activeAppointmentIndex] || allAppointments[0];

  const handleSelectAppointment = (idx: number) => {
    if (idx === activeAppointmentIndex) return;
    setIsSwitching(true);
    setActiveAppointmentIndex(idx);
    const target = allAppointments[idx];
    if (target) {
      setSelectedDay(target.day);
      setViewMonth(target.month);
      setViewYear(target.year);
    } else {
      setSelectedDay(1);
    }
    setTimeout(() => setIsSwitching(false), 200);
  };

  const rawStatus = currentAppointment?.rawStatus ?? 'pending';
  const isCancelled = rawStatus === 'cancelled';
  // Caramel badge while waiting on the lawyer (pending) or on payment (awaiting_client_confirmation).
  const isPending = rawStatus === 'pending' || rawStatus === 'awaiting_client_confirmation';
  const canCancel = CANCELLABLE_STATUSES.includes(rawStatus);
  const canJoinMeet = rawStatus === 'confirmed';

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
  const [viewMonth, setViewMonth] = useState<number>(() => currentAppointment?.month ?? 8);
  const [viewYear, setViewYear] = useState<number>(() => currentAppointment?.year ?? 2026);

  useEffect(() => {
    if (currentAppointment) {
      setViewMonth(currentAppointment.month);
      setViewYear(currentAppointment.year);
    }
  }, [currentAppointment]);

  const calendarYear = viewYear;
  const calendarMonth = viewMonth;

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
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
  const findAppointmentIndexOnDay = (day: number) =>
    allAppointments.findIndex((a) => a.year === calendarYear && a.month === calendarMonth && a.day === day);

  // Reminders only for bookings on the date chosen in the calendar (de-duplicated).
  const remindersForSelectedDay = Array.from(
    new Set(
      allAppointments
        .filter(
          (a) =>
            a.year === calendarYear &&
            a.month === calendarMonth &&
            a.day === selectedDay &&
            a.rawStatus !== 'cancelled'
        )
        .flatMap((a) => a.reminders)
    )
  );

  const activeReminders =
    remindersForSelectedDay.length > 0
      ? remindersForSelectedDay
      : currentAppointment?.reminders?.length
        ? currentAppointment.reminders
        : DEFAULT_REMINDERS;


  // ─── View Details / Payment modal ─────────────────────────────────────────
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState<boolean>(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [paymentChannel, setPaymentChannel] = useState<PaymentChannel | null>(null);

  const openDetails = () => {
    setDetailsError(null);
    setPaymentFile(null);
    setShowDetailsModal(true);
    if (!paymentChannel) {
      getPaymentChannelAction().then(setPaymentChannel);
    }
  };

  const closeDetails = () => {
    if (submittingPayment) return;
    setShowDetailsModal(false);
    setPaymentFile(null);
    setDetailsError(null);
  };

  const openProof = async (documentId: string) => {
    const res = await getDocumentAccessUrlAction(documentId);
    if ('url' in res && res.url) window.open(res.url, '_blank', 'noopener,noreferrer');
    else setDetailsError(('error' in res && res.error) || 'This file could not be opened.');
  };

  const openMessagesFor = (consultationId: string) => {
    router.push(`/client/messages?thread=${consultationId}`);
  };

  const handleSubmitPayment = async (appointment: Appointment) => {
    if (!paymentFile || submittingPayment) return;
    setSubmittingPayment(true);
    setDetailsError(null);
    try {
      const fd = new FormData();
      fd.append('consultationId', appointment.id);
      fd.append('file', paymentFile);
      const res = await submitPaymentProofAction(fd);
      if (!('consultation' in res) || !res.consultation) {
        setDetailsError(('error' in res && res.error) || 'We could not submit your payment.');
        return;
      }
      const updated = res.consultation;
      setDbAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setPaymentFile(null);
    } catch {
      setDetailsError('We could not submit your payment. Please try again.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const buildDetailsProps = (a: Appointment): ConsultationDetailsModalProps => {
    const isPaymentStage = a.rawStatus === 'awaiting_client_confirmation';
    const isPaid = a.rawStatus === 'confirmed' || a.rawStatus === 'completed';
    const needsPayment = isPaymentStage && (a.payment.state === 'none' || a.payment.state === 'rejected');
    const underReview = isPaymentStage && a.payment.state === 'submitted';

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
    } else if (isPaid && a.rawStatus === 'confirmed') {
      actions = [
        {
          label: 'Cancel',
          variant: 'outline',
          onClick: () => {
            setShowDetailsModal(false);
            setCancelError(null);
            setShowCancelModal(true);
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
          disabled: !a.meetingLink,
          onClick: () => a.meetingLink && window.open(a.meetingLink, '_blank', 'noopener,noreferrer'),
        },
      ];
    }

    const proofId = a.payment.proofDocumentId;
    return {
      dateStr: a.dateStr,
      timeSlot: a.timeSlot,
      statusLabel: a.status,
      statusTone:
        a.rawStatus === 'declined' || a.rawStatus === 'cancelled'
          ? 'grey'
          : needsPayment
            ? 'red'
            : underReview
              ? 'amber'
              : isPaid
                ? 'green'
                : 'caramel',
      person: {
        name: a.lawyerName,
        lines: [
          `Roll No. ${a.rollNumber}  |  IBP ${a.ibpChapter}`,
          a.practiceAreas.join(' • '),
          `★ ${a.rating} • ${a.experienceYrs} yrs practice`,
        ],
        rate: a.ratePerHour,
        // pending-nvonfirmed / confirmed-and-paid show a Message button; payment.png shows the rate.
        onMessage:
          needsPayment || a.rawStatus === 'declined' || a.rawStatus === 'cancelled'
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
          qrImageUrl: paymentChannel?.qrImageUrl ?? null,
          qrCaption: paymentChannel?.caption ?? null,
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
    };
  };

  if (loadingAppointments) {
    return <ConsultationsSkeleton />;
  }

  return (
    <div className="px-8 sm:px-12 lg:px-16 xl:px-20 py-6 sm:py-12 max-w-[1300px] mx-auto space-y-7 sm:space-y-8 bg-[#E5D8CB]">
      {/* ─── Main 2-Column Grid (Exact Reference Images Layout) ───────────── */}
      {!hasAppointments || !currentAppointment ? (
        <div className="neu-raised rounded-[24px] sm:rounded-[28px] p-8 sm:p-12 bg-[#E5D8CB] text-center space-y-4 max-w-xl mx-auto">
          <div className="w-14 h-14 rounded-full neu-raised-highlight flex items-center justify-center mx-auto text-2xl" style={{ backgroundColor: 'rgba(211, 151, 88, 0.3)' }}>
            📅
          </div>
          <h2 className="font-lora text-xl sm:text-2xl font-bold text-[#341512]">No Consultations Scheduled Yet</h2>
          <p className="font-lora text-xs sm:text-sm text-[#5C4535] leading-relaxed">
            You do not have any active or pending consultations in the system. Explore verified Philippine legal practitioners to schedule your confidential consultation session.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                if (onNavigate) onNavigate('lawyers');
                else router.push('/client/lawyers');
              }}
              className="neu-btn-caramel px-6 py-2.5 rounded-[12px] bg-[#D49E56] hover:bg-[#C58B3C] text-[#341512] font-lora text-xs sm:text-sm font-bold transition active:scale-95"
            >
              Find a Lawyer
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row items-start gap-6 lg:gap-7 xl:gap-8">
          {/* ─── Left Column: Calendar & Reminders (Reference Image 1) ─── */}
          <div className="w-full lg:w-[310px] xl:w-[380px] lg:shrink-0 space-y-5 sm:space-y-6">
            {/* 1. Calendar Card (Reference Image 1) */}
            <div className="neu-raised bg-[#E5D8CB] rounded-[24px] sm:rounded-[28px] p-4.5 sm:p-5 space-y-3.5 sm:space-y-4">
              {/* Top Month Badge (Centered Inset Pill with tight navigation arrows) */}
              <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  aria-label="Previous month"
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[#5C4535]/80 hover:text-[#C58B3C] hover:bg-[#DDCFC0]/50 transition-colors font-bold text-sm select-none cursor-pointer"
                >
                  ‹
                </button>
                <div className="neu-recessed rounded-full px-4 sm:px-5 py-1.5 font-lora text-[10.5px] sm:text-[11px] font-bold uppercase tracking-[0.16em] text-[#C58B3C] select-none text-center">
                  {MONTH_LABELS[calendarMonth]} {calendarYear}
                </div>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  aria-label="Next month"
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[#5C4535]/80 hover:text-[#C58B3C] hover:bg-[#DDCFC0]/50 transition-colors font-bold text-sm select-none cursor-pointer"
                >
                  ›
                </button>
              </div>

              {/* Days of week */}
              <div className="grid grid-cols-7 gap-1 text-center font-lora text-[10.5px] sm:text-[11px] font-bold text-[#341512] uppercase tracking-wider pb-0.5">
                <span>SUN</span>
                <span>MON</span>
                <span>TUE</span>
                <span>WED</span>
                <span>THU</span>
                <span>FRI</span>
                <span>SAT</span>
              </div>

              {/* Dates Grid */}
              <div className="grid grid-cols-7 gap-y-2 sm:gap-y-2.5 gap-x-1 text-center font-lora text-xs sm:text-[12.5px]">
                {daysInMonth.map((item, idx) => {
                  if (!item.day) {
                    return <div key={`empty-${idx}`} className="size-7 sm:size-8 mx-auto" />;
                  }
                  const isSelected = item.day === selectedDay;
                  const hasAppointment = findAppointmentIndexOnDay(item.day) !== -1;
                  return (
                    <button
                      key={`day-${item.day}`}
                      type="button"
                      onClick={() => {
                        const aptIdx = findAppointmentIndexOnDay(item.day!);
                        if (aptIdx !== -1) {
                          handleSelectAppointment(aptIdx);
                        } else {
                          setSelectedDay(item.day!);
                        }
                      }}
                      className={`size-7 sm:size-8 mx-auto rounded-full flex items-center justify-center font-lora transition-all relative select-none cursor-pointer ${isSelected
                        ? 'neu-raised-sm bg-[#E5D8CB] font-bold text-[#C58B3C]'
                        : 'font-normal text-[#341512] hover:text-[#C58B3C] hover:bg-[#DDCFC0]/40'
                        }`}
                    >
                      <span>{String(item.day).padStart(2, '0')}</span>
                      {hasAppointment && !isSelected && (
                        <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-[#C58B3C]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. REMINDERS: Card (Warm peach plate, Reference Image 1) */}
            <div
              className="neu-raised-highlight rounded-[24px] sm:rounded-[28px] p-4.5 sm:p-8 space-y-3"
              style={{ backgroundColor: 'rgba(211, 151, 88, 0.3)' }}
            >
              <h3 className="font-lora text-xs sm:text-[18px] font-bold text-[#341512] tracking-wider uppercase mb-1.5">
                REMINDERS:
              </h3>

              <ul className="space-y-2 font-inter text-[10.5px] sm:text-[12px] text-[#3E2A1E] leading-[1.5]">
                {activeReminders.map((reminder, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-[11px] leading-tight select-none mt-0.5 shrink-0 text-[#341512]">•</span>
                    <span>{reminder}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ─── Right Column: Large Appointment Card (Expanded Width, Reference Image 2) ─── */}
          <div className="w-full flex-1 min-w-0 space-y-4 sm:space-y-5">
            <div className="neu-raised bg-[#E5D8CB] rounded-[28px] sm:rounded-[32px] p-5 sm:p-6 lg:p-7 space-y-4 sm:space-y-5">
              {isSwitching ? (
                <div className="space-y-5 animate-in fade-in duration-150 py-1">
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="h-6 w-40 rounded-full neu-skeleton-inset" />
                    <div className="h-6 w-36 rounded-full neu-skeleton-inset" />
                    <div className="h-6 w-32 rounded-full neu-skeleton" />
                  </div>
                  <div className="h-24 rounded-[18px] neu-skeleton-plate" />
                  <div className="space-y-2 pt-1">
                    <div className="h-3 w-36 neu-skeleton-text" />
                    <div className="h-4.5 w-72 neu-skeleton-text" />
                    <div className="space-y-1.5 pt-1">
                      <div className="h-2.5 w-full neu-skeleton-text" />
                      <div className="h-2.5 w-11/12 neu-skeleton-text" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-3 border-t border-[#D1BEA8]/50">
                    <div className="h-8 w-18 rounded-lg neu-skeleton" />
                    <div className="h-8 w-24 rounded-lg neu-skeleton" />
                    <div className="h-8 w-24 rounded-lg neu-skeleton-plate" />
                  </div>
                </div>
              ) : (
                <>
                  {/* Top Pill Header Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                      {/* Date Pill (Debossed) */}
                      <div className="neu-recessed px-3.5 sm:px-4 py-1.5 rounded-full font-lora text-[10px] sm:text-[10.5px] font-bold text-[#5C4535] uppercase tracking-wider select-none">
                        {currentAppointment.dateStr.toUpperCase().startsWith('TODAY')
                          ? currentAppointment.dateStr.toUpperCase()
                          : `TODAY, ${currentAppointment.dateStr.toUpperCase()}`}
                      </div>

                      {/* Time Pill (Debossed) */}
                      <div className="neu-recessed px-3.5 sm:px-4 py-1.5 rounded-full font-lora text-[10px] sm:text-[10.5px] font-bold text-[#5C4535] select-none">
                        {currentAppointment.timeSlot}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div
                      className={`px-3.5 sm:px-4 py-1.5 rounded-full font-lora text-[9px] sm:text-[10px] font-bold tracking-wider uppercase text-white select-none ${isCancelled || rawStatus === 'declined'
                        ? 'bg-red-700 shadow-sm'
                        : isPending
                          ? 'bg-[#D49E56] shadow-sm'
                          : 'neu-badge-green bg-[#27AE60]'
                        }`}
                    >
                      {rawStatus === 'confirmed' ? 'CONFIRMED APPOINTMENT' : currentAppointment.status}
                    </div>
                  </div>

                  {rescheduleNotice && (
                    <div role="status" className="flex items-center justify-between gap-2.5 rounded-[12px] bg-emerald-50 border border-emerald-300 px-3.5 py-2 font-lora text-xs text-emerald-900">
                      <span>{rescheduleNotice}</span>
                      <button type="button" onClick={() => setRescheduleNotice(null)} className="font-semibold hover:underline shrink-0 cursor-pointer">
                        Dismiss
                      </button>
                    </div>
                  )}

                  {currentAppointment.reschedule?.pending && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-[12px] bg-amber-100/90 border border-amber-300 px-3.5 py-2 font-lora text-xs text-amber-900">
                      <span>
                        {currentAppointment.reschedule.pending.byMe
                          ? 'You asked to move this consultation to '
                          : `${currentAppointment.lawyerName} asked to move this consultation to `}
                        <strong>
                          {currentAppointment.reschedule.pending.proposedDateLong}, {currentAppointment.reschedule.pending.proposedTimeRange}
                        </strong>
                        {currentAppointment.reschedule.pending.byMe ? ' — waiting for an answer.' : '.'}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setReschedule({
                            id: currentAppointment.id,
                            mode: currentAppointment.reschedule?.pending?.byMe ? 'withdraw' : 'respond',
                          })
                        }
                        className="font-bold hover:underline shrink-0 self-start sm:self-auto cursor-pointer"
                      >
                        {currentAppointment.reschedule.pending.byMe ? 'Withdraw' : 'Review Request'}
                      </button>
                    </div>
                  )}

                  {/* Inner Lawyer Banner Plate (Reference Image 2) */}
                  <div
                    className="neu-raised-highlight rounded-[18px] sm:rounded-[20px] p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    style={{ backgroundColor: 'rgba(211, 151, 88, 0.3)' }}
                  >
                    <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
                      {/* Circular Avatar */}
                      <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-full border-[2.5px] sm:border-[3px] border-[#341512] flex items-center justify-center shrink-0 select-none">
                        <svg
                          className="w-8 h-8 sm:w-9 sm:h-9 text-[#341512]"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <circle cx="12" cy="8" r="3.8" />
                          <path d="M5 20c0-3.8 3.1-6.5 7-6.5s7 2.7 7 6.5" />
                        </svg>
                      </div>

                      <div className="space-y-0.5 min-w-0">
                        <h4 className="font-lora text-base sm:text-lg font-bold text-[#341512] leading-tight">
                          {currentAppointment.lawyerName}
                        </h4>
                        <p className="font-lora text-[10.5px] sm:text-[11px] text-[#5C4535] font-medium leading-tight">
                          Roll No. {currentAppointment.rollNumber} | IBP {currentAppointment.ibpChapter}
                        </p>
                        <p className="font-lora text-[10.5px] sm:text-[11px] text-[#5C4535] font-medium leading-tight">
                          {currentAppointment.practiceAreas.join(' • ')}
                        </p>
                        <p className="font-lora text-[10.5px] sm:text-[11px] text-[#5C4535] font-medium leading-tight">
                          ★ {currentAppointment.rating} • {currentAppointment.experienceYrs} yrs practice
                        </p>
                      </div>
                    </div>

                    {/* Rate */}
                    <div className="sm:text-right shrink-0">
                      <span className="font-lora text-2xl sm:text-3xl lg:text-[34px] font-bold text-[#341512] leading-none">
                        ₱{currentAppointment.ratePerHour.toLocaleString()}
                      </span>
                      <span className="font-lora text-xs sm:text-sm font-normal text-[#341512] ml-1">/per hour</span>
                    </div>
                  </div>

                  {/* Subject Matter & Case Docket */}
                  <div className="space-y-1.5 pt-0.5">
                    <div className="font-lora font-bold text-[9.5px] sm:text-[10px] text-[#C58B3C] uppercase tracking-wider">
                      {currentAppointment.docket}
                    </div>
                    <h3 className="font-lora text-base sm:text-lg font-bold text-[#341512] leading-snug">
                      {currentAppointment.caseTitle}
                    </h3>
                    <p className="font-lora text-xs sm:text-[12.5px] text-[#3E2A1E] leading-relaxed text-justify">
                      {currentAppointment.caseDescription}
                    </p>
                  </div>

                  {/* Action Buttons Row */}
                  <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                    {/* Cancel Button */}
                    {canCancel && (
                      <button
                        type="button"
                        onClick={() => {
                          setCancelError(null);
                          setShowCancelModal(true);
                        }}
                        className="px-5 sm:px-6 py-2 rounded-[12px] border border-[#341512]/50 bg-[#E5D8CB] font-lora text-xs font-semibold text-[#341512] hover:bg-[#DDCFC0] active:scale-95 transition-all shadow-sm cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}

                    {/* View Details Button */}
                    <button
                      type="button"
                      onClick={openDetails}
                      className="neu-btn-espresso px-5 sm:px-6 py-2 rounded-[12px] bg-[#4A2E25] font-lora text-xs font-semibold text-white transition-all hover:brightness-110 active:scale-95 cursor-pointer"
                    >
                      View Details
                    </button>

                    {/* Join Meet Button */}
                    {canJoinMeet && (
                      <button
                        type="button"
                        onClick={() => setShowMeetModal(true)}
                        className="neu-btn-caramel px-5 sm:px-6 py-2 rounded-[12px] bg-[#D49E56] font-lora text-xs font-bold text-[#341512] flex items-center gap-1.5 transition-all hover:brightness-105 active:scale-95 cursor-pointer"
                      >
                        <svg
                          className="w-3.5 h-3.5 text-[#341512]"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <rect x="2" y="6" width="13" height="12" rx="2" />
                          <path d="M15 10l5-3v10l-5-3" />
                        </svg>
                        <span>Join Meet</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Pagination Controls below appointment card (Reference Image 2) */}
            <div className="flex items-center justify-center gap-5 pt-2 select-none">
              <button
                type="button"
                onClick={() => handleSelectAppointment(Math.max(0, activeAppointmentIndex - 1))}
                disabled={activeAppointmentIndex <= 0}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-[#341512] font-lora text-xl font-bold disabled:opacity-30 transition-all hover:text-[#C58B3C] cursor-pointer disabled:cursor-not-allowed select-none"
                aria-label="Previous consultation"
              >
                ‹
              </button>

              <div className="flex items-center gap-2">
                {Array.from({ length: Math.max(4, allAppointments.length) }).map((_, idx) => {
                  const isActive = idx === activeAppointmentIndex;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        if (idx < allAppointments.length) handleSelectAppointment(idx);
                      }}
                      className={`rounded-full transition-all cursor-pointer ${isActive
                        ? 'w-3 h-3 bg-[#C58B3C]'
                        : 'w-2 h-2 bg-[#341512] hover:bg-[#C58B3C]/80'
                        }`}
                      aria-label={`Go to consultation ${idx + 1}`}
                    />
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() =>
                  handleSelectAppointment(
                    Math.min(allAppointments.length - 1, activeAppointmentIndex + 1)
                  )
                }
                disabled={activeAppointmentIndex >= allAppointments.length - 1}
                className="neu-raised-sm w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#E5D8CB] flex items-center justify-center text-[#341512] font-lora text-xl font-bold disabled:opacity-30 transition-all cursor-pointer disabled:cursor-not-allowed select-none"
                aria-label="Next consultation"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Cancel Consultation Modal ─────────────────────────────────────── */}
      {showCancelModal && currentAppointment && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-5 md:p-6 animate-in fade-in overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-modal-title"
          onClick={() => setShowCancelModal(false)}
        >
          <div
            className="neu-modal outline-[#D39758] relative w-full max-w-[92vw] sm:max-w-md max-h-[82vh] sm:max-h-[78vh] flex flex-col rounded-[24px] p-5 sm:p-6 bg-[#E5D8CB] space-y-3.5 text-center animate-in zoom-in-95 duration-200 shadow-2xl my-auto overflow-y-auto neu-scrollbar-discrete"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="w-11 h-11 rounded-full neu-raised-highlight flex items-center justify-center mx-auto text-lg"
              style={{ backgroundColor: 'rgba(211, 151, 88, 0.3)' }}
            >
              ⚠️
            </div>
            <h3 id="cancel-modal-title" className="font-lora text-base sm:text-lg font-bold text-[#341512]">
              Cancel Scheduled Consultation?
            </h3>
            <p className="font-lora text-xs text-[#5C4535] leading-relaxed">
              Are you sure you want to cancel your session with{' '}
              <strong className="text-[#341512]">{currentAppointment.lawyerName}</strong> scheduled for{' '}
              <strong className="text-[#341512]">{currentAppointment.dateStr}</strong>? Notice will be transmitted to counsel immediately.
            </p>
            {cancelError && (
              <p className="font-lora text-xs font-semibold text-red-800 bg-red-100 border border-red-300 rounded-xl px-3.5 py-2">
                {cancelError}
              </p>
            )}
            <div className="flex items-center justify-center gap-3 pt-1.5">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                disabled={isCancelling}
                className="px-5 py-2 rounded-xl border border-[#341512]/50 bg-[#E5D8CB] font-lora text-xs font-semibold text-[#341512] hover:bg-[#DDCFC0] transition-all disabled:opacity-50 cursor-pointer"
              >
                Keep Consultation
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isCancelling}
                className="px-5 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white font-lora text-xs font-bold shadow-md active:scale-95 transition-all disabled:opacity-60 cursor-pointer"
              >
                {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ─── View Details Modal (pending / payment / confirmed designs) ─── */}
      {showDetailsModal && currentAppointment && (
        <ConsultationDetailsModal {...buildDetailsProps(currentAppointment)} />
      )}

      {/* ─── Reschedule (request / respond / withdraw) ─────────────────────── */}
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

      {/* ─── Join Meet Preview Modal (Neumorphic Design) ───────────────────── */}
      {showMeetModal && currentAppointment && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-5 md:p-6 animate-in fade-in overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="meet-modal-title"
          onClick={() => setShowMeetModal(false)}
        >
          <div
            className="neu-modal outline-[#D39758] relative w-full max-w-[92vw] sm:max-w-lg max-h-[82vh] sm:max-h-[78vh] flex flex-col rounded-[24px] p-4.5 sm:p-6 bg-[#E5D8CB] text-[#341512] space-y-3.5 animate-in zoom-in-95 duration-200 shadow-2xl my-auto overflow-y-auto neu-scrollbar-discrete"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Top Header */}
            <div className="flex items-center justify-between pb-2 border-b border-[#D1BEA8]/50">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                <h3 id="meet-modal-title" className="font-lora text-sm sm:text-base font-bold text-[#341512]">
                  Justicia Video Consultation Room
                </h3>
              </div>
            </div>

            {/* Inset Video Preview Chamber */}
            <div className="neu-recessed aspect-video w-full rounded-2xl bg-[#E5D8CB] flex flex-col items-center justify-center text-center p-4 space-y-2">
              <div className="size-11 rounded-full neu-raised bg-[#E5D8CB] flex items-center justify-center text-lg">
                📹
              </div>
              <div>
                <p className="font-lora font-bold text-xs sm:text-[13px] text-[#341512]">Encrypted Consultation Session</p>
                <p className="font-lora text-[10.5px] text-[#5C4535] mt-0.5">
                  Direct connection with {currentAppointment.lawyerName}
                </p>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-1">
              <span className="font-lora text-xs text-[#5C4535] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                Audio &amp; Video: Ready
              </span>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowMeetModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#341512]/50 bg-[#E5D8CB] font-lora text-xs font-semibold text-[#341512] hover:bg-[#DDCFC0] transition-all cursor-pointer"
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (currentAppointment.meetingLink) {
                      window.open(currentAppointment.meetingLink, '_blank', 'noopener,noreferrer');
                    } else {
                      alert('Your attorney has not shared the Google Meet link yet. It will appear here once available.');
                    }
                    setShowMeetModal(false);
                  }}
                  className="neu-btn-caramel px-5 py-2 rounded-xl bg-[#D49E56] hover:bg-[#C58B3C] text-[#341512] font-lora text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <svg
                    className="w-3.5 h-3.5 text-[#341512]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="2" y="6" width="13" height="12" rx="2" />
                    <path d="M15 10l5-3v10l-5-3" />
                  </svg>
                  <span>Enter Meeting</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default ConsultationsView;
