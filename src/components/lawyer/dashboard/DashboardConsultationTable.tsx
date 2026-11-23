'use client';

import React from 'react';
import { motion } from 'motion/react';
import type { LawyerConsultation } from '@/app/actions/consultationActions';
import { PhoneIcon, VideoIcon } from '@/components/shared/neu';
import { canMessage, detailStatusTone, isSample } from '../useLawyerConsultationActions';
import { shortDate } from './filter';
import { ROW, ROWS } from '../motion';
import type { ConsultationCardHandlers } from '../LawyerConsultationCard';

/**
 * List view: the filtered consultations as a table. Each row lifts out of the card on hover;
 * clicking it (or "View") opens the details. Below xl the cells stack into a compact block
 * per row, so the table never scrolls sideways.
 */

const SHORT_STATUS: Record<LawyerConsultation['status'], string> = {
  pending: 'Pending',
  pending_payment: 'Pending Payment',
  payment_review: 'Payment Review',
  confirmed: 'Confirmed',
  completed: 'Completed',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

const TONE_BG = {
  caramel: 'bg-[#D49E56]',
  red: 'bg-[#E60000]',
  green: 'bg-[#1FAA00]',
  amber: 'bg-[#C9822B]',
  grey: 'bg-stone-500',
} as const;

function splitRange(range: string): [string, string | null] {
  const [start, end] = range.split(/\s+-\s+/);
  return [start ?? range, end ?? null];
}

export function StatusChip({ status }: { status: LawyerConsultation['status'] }) {
  return (
    <span
      className={`neu-raised-pill inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 font-lora text-[9.5px] font-bold uppercase tracking-wider text-white ${TONE_BG[detailStatusTone(status)]}`}
    >
      {SHORT_STATUS[status]}
    </span>
  );
}

function IconAction({
  label,
  onClick,
  disabled,
  children,
  tone = 'plain',
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  tone?: 'plain' | 'caramel';
}) {
  return (
    <motion.button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      whileHover={disabled ? undefined : { y: -1.5 }}
      whileTap={disabled ? undefined : { scale: 0.88 }}
      className={`grid size-8 shrink-0 place-items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        tone === 'caramel' ? 'neu-btn-caramel bg-[#D49E56] text-[#341512]' : 'neu-raised-sm text-[#5C4535] hover:text-[#C58B3C]'
      }`}
    >
      {children}
    </motion.button>
  );
}

const MessageGlyph = () => (
  <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
  </svg>
);

export function DashboardConsultationTable({
  items,
  showDate,
  today,
  ...h
}: {
  items: LawyerConsultation[];
  showDate: boolean;
  today: string;
} & Pick<ConsultationCardHandlers, 'onDetails' | 'onMessage' | 'onJoin'>) {
  const cols = showDate
    ? 'xl:grid-cols-[92px_104px_minmax(0,1.1fr)_minmax(0,1.5fr)_136px_140px]'
    : 'xl:grid-cols-[104px_minmax(0,1.1fr)_minmax(0,1.6fr)_80px_136px_140px]';

  return (
    <div role="table" aria-label="Scheduled consultations" className="flex flex-col">
      <div
        role="row"
        className={`hidden gap-4 px-4 pb-3 font-lora text-[10px] font-bold uppercase tracking-[0.14em] text-[#C58B3C] xl:grid ${cols}`}
      >
        {showDate && <span role="columnheader">Date</span>}
        <span role="columnheader">Time</span>
        <span role="columnheader">Client</span>
        <span role="columnheader">Matter</span>
        {!showDate && <span role="columnheader">Mode</span>}
        <span role="columnheader">Status</span>
        <span role="columnheader" className="text-right">
          Actions
        </span>
      </div>
      <div className="lawyer-dash-groove mx-2 mb-2 hidden xl:block" aria-hidden />

      <motion.div variants={ROWS} initial="enter" animate="center" role="rowgroup" className="flex flex-col gap-1.5">
        {items.map((c) => {
          const [start, end] = splitRange(c.timeRange);
          const sample = isSample(c);
          const Mode = c.communicationMode === 'audio' ? PhoneIcon : VideoIcon;
          return (
            <motion.div
              key={c.id}
              variants={ROW}
              role="row"
              onClick={() => h.onDetails(c)}
              className={`lawyer-dash-row grid cursor-pointer grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 rounded-[16px] px-4 py-3 xl:gap-y-0 ${cols}`}
            >
              {showDate && (
                <span role="cell" className="order-1 col-span-2 font-lora text-[12.5px] font-semibold text-[#341512] xl:order-none xl:col-span-1">
                  {shortDate(`${c.year}-${String(c.month + 1).padStart(2, '0')}-${String(c.day).padStart(2, '0')}`, today)}
                </span>
              )}
              <span role="cell" className="order-2 col-span-2 flex items-baseline gap-1.5 xl:order-none xl:col-span-1 xl:flex-col xl:gap-0">
                <span className="font-lora text-[14px] font-bold leading-tight text-[#341512]">{start}</span>
                {end && <span className="font-inter text-[10.5px] text-[#7D6855]">to {end}</span>}
              </span>
              <span role="cell" className="order-3 min-w-0 xl:order-none">
                <span className="block truncate font-lora text-[13.5px] font-semibold text-[#341512]">{c.client.name}</span>
                <span className="block truncate font-inter text-[10.5px] text-[#7D6855]">{c.client.email}</span>
              </span>
              <span role="cell" className="order-4 row-span-2 self-start xl:order-none xl:hidden">
                <StatusChip status={c.status} />
              </span>
              <span role="cell" className="order-5 col-span-2 min-w-0 xl:order-none xl:col-span-1">
                <span className="line-clamp-2 font-lora text-[12.5px] leading-snug text-[#3E2A1E] xl:line-clamp-1">{c.subjectTitle}</span>
              </span>
              {!showDate && (
                <span role="cell" className="hidden items-center gap-1.5 font-inter text-[11px] text-[#5C4535] xl:flex">
                  <Mode className="h-3.5 w-3.5 text-[#B07A34]" />
                  {c.communicationMode === 'audio' ? 'Audio' : 'Video'}
                </span>
              )}
              <span role="cell" className="hidden xl:block">
                <StatusChip status={c.status} />
              </span>
              <span role="cell" className="order-6 col-span-2 flex items-center justify-end gap-2 pt-1 xl:order-none xl:col-span-1 xl:pt-0">
                <IconAction label="Message client" onClick={() => h.onMessage(c)} disabled={!canMessage(c)}>
                  <MessageGlyph />
                </IconAction>
                {c.status === 'confirmed' && (
                  <IconAction label={c.meetingLink ? 'Join Meet' : 'The meeting link is not set yet'} onClick={() => h.onJoin(c)} disabled={sample || !c.meetingLink} tone="caramel">
                    <VideoIcon className="h-[15px] w-[15px]" />
                  </IconAction>
                )}
                <motion.button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    h.onDetails(c);
                  }}
                  whileHover={{ y: -1.5 }}
                  whileTap={{ scale: 0.92 }}
                  className="neu-btn-espresso h-8 rounded-full bg-[#4A2E25] px-3.5 font-lora text-[11px] font-semibold text-white hover:brightness-110"
                >
                  View
                </motion.button>
              </span>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
