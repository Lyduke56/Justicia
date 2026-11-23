'use client';

import type { ClientConsultation } from '@/app/actions/consultationActions';
import {
  DetailsStatusRow,
  DetailsPersonBanner,
  DetailsCaseBlock,
  type DetailsStatusTone,
} from '@/components/shared/ConsultationDetailsModal';
import { NeuModal, NeuButton, NeuAlert } from '@/components/shared/neu';

/** View model for the booking summary card (client or lawyer perspective). */
export interface ConsultationSummaryData {
  dateStr: string;
  timeSlot: string;
  status: string;
  /** Caramel badge while awaiting action, green once confirmed, red when closed. */
  tone: 'pending' | 'confirmed' | 'closed';
  personName: string;
  personLines: string[];
  rate: number | null;
  docket: string;
  caseTitle: string;
  caseDescription: string;
}

export function clientConsultationToSummary(c: ClientConsultation): ConsultationSummaryData {
  return {
    dateStr: c.dateStr,
    timeSlot: c.timeSlot,
    status: c.status,
    tone:
      c.rawStatus === 'confirmed' || c.rawStatus === 'completed'
        ? 'confirmed'
        : c.rawStatus === 'declined' || c.rawStatus === 'cancelled'
          ? 'closed'
          : 'pending',
    personName: c.lawyerName,
    personLines: [
      `Roll No. ${c.rollNumber}  |  IBP ${c.ibpChapter}`,
      c.practiceAreas.join(' • '),
      `★ ${c.rating} • ${c.experienceYrs} yrs practice`,
    ],
    rate: c.ratePerHour,
    docket: c.docket,
    caseTitle: c.caseTitle,
    caseDescription: c.caseDescription,
  };
}

interface ConsultationSummaryModalProps {
  data: ConsultationSummaryData;
  onClose: () => void;
}

const TONE_MAP: Record<ConsultationSummaryData['tone'], DetailsStatusTone> = {
  pending: 'caramel',
  confirmed: 'green',
  closed: 'red',
};

/**
 * Shown right after a client submits a booking. Uses the same status row, person banner and
 * case block as the View Details modal so the two read as one design.
 */
export function ConsultationSummaryModal({ data, onClose }: ConsultationSummaryModalProps) {
  return (
    <NeuModal
      onClose={onClose}
      size="xl"
      labelledBy="consultation-summary-title"
      footer={
        <NeuButton variant="primary" onClick={onClose} autoFocus>
          Done
        </NeuButton>
      }
    >
      {data.tone === 'pending' && (
        <NeuAlert tone="success" title="Booking request sent">
          {data.personName} will review your request. You&apos;ll be notified once they accept, and payment is only requested
          after that.
        </NeuAlert>
      )}
      <DetailsStatusRow dateStr={data.dateStr} timeSlot={data.timeSlot} statusLabel={data.status} statusTone={TONE_MAP[data.tone]} />
      <DetailsPersonBanner person={{ name: data.personName, lines: data.personLines, rate: data.rate }} />
      <DetailsCaseBlock
        docket={data.docket}
        caseTitle={data.caseTitle}
        caseDescription={data.caseDescription}
        titleId="consultation-summary-title"
      />
    </NeuModal>
  );
}

export default ConsultationSummaryModal;
