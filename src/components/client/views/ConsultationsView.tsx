'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  getClientConsultationsAction,
  cancelConsultationAction,
} from '@/app/actions/consultationActions';
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

export function ConsultationsView({ onNavigate }: ConsultationsViewProps) {
  const router = useRouter();
  const [dbAppointments, setDbAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState<boolean>(true);
  const [selectedDay, setSelectedDay] = useState<number>(1);

  useEffect(() => {
    let active = true;
    getClientConsultationsAction()
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data) ? data : [];
        setDbAppointments(list);
        if (list[0]) setSelectedDay(list[0].day);
      })
      .finally(() => {
        if (active) setLoadingAppointments(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const [activeAppointmentIndex, setActiveAppointmentIndex] = useState<number>(0);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);
  const [showMeetModal, setShowMeetModal] = useState<boolean>(false);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState<boolean>(false);

  const allAppointments = dbAppointments;
  const hasAppointments = allAppointments.length > 0;
  const currentAppointment: Appointment | undefined =
    allAppointments[activeAppointmentIndex] || allAppointments[0];

  const handleSelectAppointment = (idx: number) => {
    if (idx === activeAppointmentIndex) return;
    setIsSwitching(true);
    setActiveAppointmentIndex(idx);
    setSelectedDay(allAppointments[idx]?.day || 1);
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

  // Calendar follows the month of the selected consultation.
  const calendarYear = currentAppointment?.year ?? new Date().getFullYear();
  const calendarMonth = currentAppointment?.month ?? new Date().getMonth();
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
        { label: 'Reschedule', variant: 'espresso', onClick: () => openMessagesFor(a.id) },
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
    <div className="max-w-[1240px] mx-auto px-2 sm:px-6 py-6 space-y-6">
      {/* ─── Main 2-Column Grid (Exact Figma Layout) ───────────────────────── */}
      {!hasAppointments || !currentAppointment ? (
        <div className="rounded-[28px] p-12 bg-[#ECE1D2] text-center space-y-4 max-w-xl mx-auto shadow-md">
          <div className="text-4xl">📅</div>
          <h2 className="font-cormorant text-2xl font-bold text-[#34150F]">No Consultations Scheduled Yet</h2>
          <p className="text-xs text-[#7D6855] leading-relaxed">
            You do not have any active or pending consultations in the system. Explore verified Philippine legal practitioners to schedule your confidential consultation session.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                if (onNavigate) onNavigate('lawyers');
                else router.push('/client/lawyers');
              }}
              className="px-6 py-2.5 rounded-2xl bg-[#C58B3C] text-white hover:bg-[#B3792E] text-xs font-bold transition shadow-sm"
            >
              Find a Lawyer
            </button>
          </div>
        </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-7 items-start">
        {/* ─── Left Column: Calendar & Reminders (5 cols) ───────────────────── */}
        <div className="lg:col-span-5 space-y-6">
          {/* 1. Calendar Card */}
          <div
            className="rounded-[28px] p-6 sm:p-7 bg-[#ECE1D2] space-y-5"
            style={{
              boxShadow:
                '12px 12px 30px rgba(182, 155, 130, 0.4), -12px -12px 30px #FFFFFF, 3px 3px 8px rgba(182, 155, 130, 0.2), -3px -3px 8px #FFFFFF',
            }}
          >
            {/* Top Month Badge (Inset Pill) */}
            <div className="flex justify-center">
              <div
                className="px-8 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest text-[#C58B3C]"
                style={{
                  backgroundColor: '#E6D7C3',
                  boxShadow:
                    'inset 2px 2px 5px rgba(165, 140, 115, 0.5), inset -2px -2px 5px rgba(255, 255, 255, 0.95)',
                }}
              >
                {MONTH_LABELS[calendarMonth]} {calendarYear}
              </div>
            </div>

            {/* Days of week */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-[#362519] uppercase tracking-wider pb-1">
              <span>SUN</span>
              <span>MON</span>
              <span>TUE</span>
              <span>WED</span>
              <span>THU</span>
              <span>FRI</span>
              <span>SAT</span>
            </div>

            {/* Dates Grid */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center text-xs">
              {daysInMonth.map((item, idx) => {
                if (!item.day) {
                  return <div key={`empty-${idx}`} className="h-8 w-8" />;
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
                    className={`h-8 w-8 mx-auto rounded-full flex items-center justify-center font-medium text-xs transition-all relative ${
                      isSelected
                        ? 'bg-[#DFC5A4] text-[#C58B3C] font-bold shadow-[inset_1px_1px_3px_rgba(0,0,0,0.18)] scale-105'
                        : 'text-[#3E2A1E] hover:bg-[#DECEB8] hover:text-[#23150F]'
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

          {/* 2. REMINDERS: Card (Warm peach plate) — only when the chosen date has a booking */}
          {remindersForSelectedDay.length > 0 && (
          <div
            className="rounded-[28px] p-6 sm:p-7 space-y-3.5"
            style={{
              backgroundColor: '#DFC5A4',
              boxShadow:
                '10px 12px 28px rgba(165, 135, 105, 0.45), 3px 4px 8px rgba(165, 135, 105, 0.25), -10px -10px 24px rgba(255, 255, 255, 0.95), -3px -3px 6px #FFFFFF',
            }}
          >
            <h3 className="font-cormorant text-base sm:text-lg font-bold text-[#23150F] tracking-wide">
              REMINDERS:
            </h3>

            <ul className="space-y-2 text-xs sm:text-[12.5px] text-[#3E2A1E] leading-relaxed">
              {remindersForSelectedDay.map((reminder, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-[8px] mt-1.5 shrink-0">●</span>
                  <span>{reminder}</span>
                </li>
              ))}
            </ul>
          </div>
          )}
        </div>

        {/* ─── Right Column: Large Appointment Card (7 cols) ────────────────── */}
        <div className="lg:col-span-7 space-y-5">
          <div
            className="rounded-[28px] p-6 sm:p-8 bg-[#ECE1D2] space-y-5"
            style={{
              boxShadow:
                '14px 14px 32px rgba(182, 155, 130, 0.4), -14px -14px 32px #FFFFFF, 3px 3px 8px rgba(182, 155, 130, 0.2), -3px -3px 8px #FFFFFF',
            }}
          >
            {isSwitching ? (
              <div className="space-y-5 animate-in fade-in duration-150 py-1">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="h-7 w-48 rounded-full neu-skeleton-inset" />
                  <div className="h-7 w-40 rounded-full neu-skeleton-inset" />
                  <div className="h-7 w-36 rounded-full neu-skeleton" />
                </div>
                <div className="h-28 rounded-[22px] neu-skeleton-plate" />
                <div className="space-y-2.5 pt-1">
                  <div className="h-3 w-40 neu-skeleton-text" />
                  <div className="h-5 w-80 neu-skeleton-text" />
                  <div className="space-y-2 pt-1">
                    <div className="h-2.5 w-full neu-skeleton-text" />
                    <div className="h-2.5 w-11/12 neu-skeleton-text" />
                    <div className="h-2.5 w-4/5 neu-skeleton-text" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-[#D1BEA8]/60">
                  <div className="h-9 w-20 rounded-xl neu-skeleton" />
                  <div className="h-9 w-28 rounded-xl neu-skeleton" />
                  <div className="h-9 w-28 rounded-xl neu-skeleton-plate" />
                </div>
              </div>
            ) : (
              <>
                {/* Top Pill Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Date Pill (Debossed) */}
              <div
                className="px-4 py-1.5 rounded-full text-[10px] sm:text-[11px] font-bold text-[#5C4535] uppercase tracking-wider"
                style={{
                  backgroundColor: '#E6D7C3',
                  boxShadow:
                    'inset 2px 2px 4px rgba(165, 140, 115, 0.5), inset -2px -2px 4px rgba(255, 255, 255, 0.95)',
                }}
              >
                {currentAppointment.dateStr}
              </div>

              {/* Time Pill (Debossed) */}
              <div
                className="px-4 py-1.5 rounded-full text-[10px] sm:text-[11px] font-bold text-[#5C4535]"
                style={{
                  backgroundColor: '#E6D7C3',
                  boxShadow:
                    'inset 2px 2px 4px rgba(165, 140, 115, 0.5), inset -2px -2px 4px rgba(255, 255, 255, 0.95)',
                }}
              >
                {currentAppointment.timeSlot}
              </div>

              {/* Status Badge (Emerald = confirmed, Caramel = pending, Red = cancelled / declined) */}
              <div
                className={`px-4 py-1.5 rounded-full text-[9px] sm:text-[10px] font-bold tracking-wider uppercase text-white shadow-md ${
                  isCancelled || rawStatus === 'declined'
                    ? 'bg-red-700'
                    : isPending
                      ? 'bg-[#D49E56]'
                      : 'bg-[#27AE60]'
                }`}
                style={{
                  boxShadow:
                    isCancelled || rawStatus === 'declined'
                      ? '0 4px 12px rgba(185, 28, 28, 0.4)'
                      : isPending
                        ? '4px 6px 14px rgba(212, 158, 86, 0.4), -2px -2px 6px rgba(255, 255, 255, 0.25)'
                        : '4px 6px 16px rgba(39, 174, 96, 0.4), -2px -2px 6px rgba(255, 255, 255, 0.25)',
                }}
              >
                {currentAppointment.status}
              </div>
            </div>

            {/* Inner Lawyer Banner Plate */}
            <div
              className="rounded-[22px] p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              style={{
                backgroundColor: '#DFC5A4',
                boxShadow:
                  '6px 8px 18px rgba(165, 135, 105, 0.4), 2px 2px 5px rgba(165, 135, 105, 0.2), -6px -6px 16px rgba(255, 255, 255, 0.9), -2px -2px 4px #FFFFFF',
              }}
            >
              <div className="flex items-center gap-4 sm:gap-5">
                {/* Circular Avatar */}
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-[#362519] flex items-center justify-center shrink-0">
                  <svg
                    className="w-9 h-9 sm:w-11 sm:h-11 text-[#362519]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="8" r="4" />
                    <path d="M5.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6" />
                  </svg>
                </div>

                <div className="space-y-0.5">
                  <h4 className="font-cormorant text-xl sm:text-2xl font-bold text-[#23150F] leading-tight">
                    {currentAppointment.lawyerName}
                  </h4>
                  <p className="text-[11px] sm:text-xs text-[#5C4535] font-medium leading-tight">
                    Roll No. {currentAppointment.rollNumber} | IBP {currentAppointment.ibpChapter}
                  </p>
                  <p className="text-[11px] sm:text-xs text-[#5C4535] font-medium">
                    {currentAppointment.practiceAreas.join(' • ')}
                  </p>
                  <p className="text-[11px] sm:text-xs text-[#5C4535] font-medium">
                    ★ {currentAppointment.rating} • {currentAppointment.experienceYrs} yrs practice
                  </p>
                </div>
              </div>

              {/* Rate */}
              <div className="sm:text-right shrink-0">
                <span className="font-cormorant text-2xl sm:text-3xl font-bold text-[#23150F]">
                  ₱{currentAppointment.ratePerHour.toLocaleString()}
                </span>
                <span className="text-xs sm:text-sm text-[#23150F] font-normal ml-1">/per hour</span>
              </div>
            </div>

            {/* Subject Matter & Case Docket */}
            <div className="space-y-2 pt-1">
              <div className="font-bold text-[10px] sm:text-[11px] text-[#C58B3C] uppercase tracking-wider">
                {currentAppointment.docket}
              </div>
              <h3 className="font-cormorant text-lg sm:text-xl font-bold text-[#23150F] leading-tight">
                {currentAppointment.caseTitle}
              </h3>
              <p className="text-xs sm:text-[13px] text-[#3E2A1E] leading-relaxed text-justify">
                {currentAppointment.caseDescription}
              </p>
            </div>

            {/* Action Buttons Row */}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-[#D1BEA8]/60">
              {/* Cancel Button (only while the booking is still active) */}
              {canCancel && (
              <button
                type="button"
                onClick={() => {
                  setCancelError(null);
                  setShowCancelModal(true);
                }}
                className="px-6 py-2.5 rounded-xl text-xs font-semibold text-[#5C4535] hover:text-[#23150F] transition-all"
                style={{
                  backgroundColor: '#ECE1D2',
                  boxShadow:
                    '4px 4px 10px rgba(182, 155, 130, 0.4), -4px -4px 10px #FFFFFF',
                }}
              >
                Cancel
              </button>
              )}

              {/* View Details Button (Espresso) */}
              <button
                type="button"
                onClick={openDetails}
                className="px-6 py-2.5 rounded-xl text-xs font-semibold text-white transition-all hover:brightness-110"
                style={{
                  backgroundColor: '#4A2E25',
                  boxShadow:
                    '0 6px 16px rgba(74, 46, 37, 0.38), inset 0 1px 1px rgba(255, 255, 255, 0.15)',
                }}
              >
                View Details
              </button>

              {/* Join Meet Button (Caramel Primary) — only once the lawyer has confirmed */}
              {canJoinMeet && (
              <button
                type="button"
                onClick={() => setShowMeetModal(true)}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-[#23150F] flex items-center gap-2 transition-all hover:brightness-105"
                style={{
                  backgroundColor: '#D49E56',
                  boxShadow:
                    '0 6px 16px rgba(212, 158, 86, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.4)',
                }}
              >
                <svg className="w-4 h-4 text-[#23150F]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Join Meet</span>
              </button>
              )}
            </div>
          </>
        )}
      </div>

          {/* Pagination Controls below appointment card */}
          <div className="flex items-center justify-center gap-4 pt-2">
            <button
              type="button"
              onClick={() => handleSelectAppointment(Math.max(0, activeAppointmentIndex - 1))}
              disabled={activeAppointmentIndex <= 0}
              className="w-9 h-9 rounded-full bg-[#ECE1D2] flex items-center justify-center text-[#5C4535] hover:text-[#23150F] disabled:opacity-30 transition-all"
              style={{
                boxShadow:
                  '4px 4px 10px rgba(182, 155, 130, 0.35), -4px -4px 10px #FFFFFF',
              }}
              aria-label="Previous consultation"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="flex items-center gap-2">
              {allAppointments.map((_, idx) => {
                const isActive = idx === activeAppointmentIndex;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectAppointment(idx)}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      isActive ? 'bg-[#C58B3C] scale-125' : 'bg-[#362519] hover:bg-[#C58B3C]'
                    }`}
                    aria-label={`Go to consultation ${idx + 1}`}
                  />
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => handleSelectAppointment(Math.min(allAppointments.length - 1, activeAppointmentIndex + 1))}
              disabled={activeAppointmentIndex >= allAppointments.length - 1}
              className="w-9 h-9 rounded-full bg-[#ECE1D2] flex items-center justify-center text-[#5C4535] hover:text-[#23150F] disabled:opacity-30 transition-all"
              style={{
                boxShadow:
                  '4px 4px 10px rgba(182, 155, 130, 0.35), -4px -4px 10px #FFFFFF',
              }}
              aria-label="Next consultation"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      )}

      {/* ─── Cancel Consultation Modal ─────────────────────────────────────── */}
      {showCancelModal && currentAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div
            className="w-full max-w-md rounded-[28px] p-7 bg-[#ECE1D2] space-y-4 text-center"
            style={{
              boxShadow: '16px 16px 40px rgba(0,0,0,0.25), -8px -8px 24px #FFFFFF',
            }}
          >
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto text-xl">
              ⚠️
            </div>
            <h3 className="font-cormorant text-xl font-bold text-[#23150F]">
              Cancel Scheduled Consultation?
            </h3>
            <p className="text-xs text-[#5C4535] leading-relaxed">
              Are you sure you want to cancel your session with{' '}
              <strong>{currentAppointment.lawyerName}</strong> scheduled for{' '}
              <strong>{currentAppointment.dateStr}</strong>? Notice will be sent to counsel.
            </p>
            {cancelError && (
              <p className="text-xs font-semibold text-red-800 bg-red-100 border border-red-300 rounded-xl px-3 py-2">
                {cancelError}
              </p>
            )}
            <div className="flex items-center justify-center gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                disabled={isCancelling}
                className="px-5 py-2.5 rounded-xl border border-[#C8B59E] text-xs font-semibold text-[#5C4535] disabled:opacity-50"
              >
                Keep Consultation
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isCancelling}
                className="px-5 py-2.5 rounded-xl bg-red-700 text-white text-xs font-semibold shadow-md disabled:opacity-60"
              >
                {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── View Details Modal (pending-nvonfirmed / payment / confirmed-and-paid designs) ─── */}
      {showDetailsModal && currentAppointment && (
        <ConsultationDetailsModal {...buildDetailsProps(currentAppointment)} />
      )}

      {/* ─── Join Meet Preview Modal ────────────────────────────────────────── */}
      {showMeetModal && currentAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div
            className="w-full max-w-lg rounded-[28px] p-7 bg-[#23150F] text-[#ded7cb] space-y-5"
            style={{
              boxShadow: '16px 16px 40px rgba(0,0,0,0.5)',
            }}
          >
            <div className="flex items-center justify-between border-b border-[#352219] pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="font-cormorant text-xl font-bold text-white">
                  Justicia Video Consultation Room
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMeetModal(false)}
                className="text-[#A69584] hover:text-white font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="aspect-video w-full rounded-2xl bg-[#150B07] border border-[#3E271D] flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-16 h-16 rounded-full bg-[#2A1810] border border-[#4A2E25] flex items-center justify-center text-2xl">
                📹
              </div>
              <div>
                <p className="font-medium text-sm text-white">Camera & Microphone Encrypted</p>
                <p className="text-xs text-[#A69584] mt-0.5">
                  End-to-end encrypted connection with {currentAppointment.lawyerName}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-[#A69584]">Audio / Video: Ready</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowMeetModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#3E271D] text-xs text-[#A69584] hover:text-white"
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
                  className="px-6 py-2.5 rounded-xl bg-[#D49E56] hover:bg-[#C58B3C] text-[#23150F] text-xs font-bold shadow-lg"
                >
                  Enter Meeting
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConsultationsView;
