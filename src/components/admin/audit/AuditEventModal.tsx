'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronRightIcon, NeuButton, NeuModal } from '@/components/shared/neu';
import { TONE_COLOR, stamp, timeAgo } from '../overview/activity';
import { ActivityIcon } from '../overview/OverviewIcons';
import { CAPS } from '../table/kit';
import { formatDetail, humanize, targetLink, type AuditRow } from './model';

/**
 * One audit event in the shared neumorphic modal: who did what to which record and when, the
 * recorded details as a readable list, the raw record on request, and a link to the target.
 */

function Cell({ label, children, mono = false }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="admin-dossier-cell min-w-0 rounded-[14px] px-4 py-3">
      <dt className={`text-[9.5px] text-[#8A6A4C] ${CAPS}`}>{label}</dt>
      <dd className={`mt-1 text-[13.5px] font-semibold leading-snug text-[#341512] [overflow-wrap:anywhere] ${mono ? 'font-inter tabular-nums' : 'font-lora'}`}>{children}</dd>
    </div>
  );
}

export function AuditEventModal({ row, onClose }: { row: AuditRow; onClose: () => void }) {
  const { entry, line } = row;
  const [now] = useState(() => Date.now());
  const [showRaw, setShowRaw] = useState(false);
  const at = stamp(entry.timestamp, now);
  const details = Object.entries(entry.details ?? {});
  const link = targetLink(entry);

  return (
    <NeuModal
      onClose={onClose}
      size="lg"
      title={line.title}
      subtitle={
        <span className="inline-flex flex-wrap items-center gap-2">
          <span className={`text-[10px] text-[#8A6A4C] ${CAPS}`}>{line.category}</span>
          <span className="font-inter text-[11.5px] tabular-nums text-[#7D6855]">{entry.action}</span>
        </span>
      }
      icon={
        <span style={{ color: TONE_COLOR[line.tone] }}>
          <ActivityIcon name={line.icon} className="h-5 w-5" />
        </span>
      }
      footer={
        <>
          {link && (
            <Link
              href={link.href}
              onClick={onClose}
              className="neu-raised-sm inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-[#E5D8CB] px-5 font-lora text-xs font-bold text-[#341512] transition-[translate,color] duration-200 hover:-translate-y-0.5 hover:text-[#A8742E] sm:text-sm"
            >
              {link.label}
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </Link>
          )}
          <NeuButton variant="primary" onClick={onClose}>
            Done
          </NeuButton>
        </>
      }
    >
      <dl className="grid gap-3 sm:grid-cols-2">
        <Cell label="Done by">
          {entry.actor.name}
          {entry.actor.email && <span className="mt-0.5 block font-inter text-[11.5px] font-normal text-[#7D6855]">{entry.actor.email}</span>}
        </Cell>
        <Cell label="Recorded" mono>
          {at.date}, {at.time}
          <span className="mt-0.5 block font-inter text-[11.5px] font-normal text-[#7D6855]">{timeAgo(entry.timestamp, now)}</span>
        </Cell>
        <Cell label="Target">{entry.targetType ? humanize(entry.targetType) : '—'}</Cell>
        <Cell label="Target ID" mono>
          <span className="text-[12px] font-medium">{entry.targetId || '—'}</span>
        </Cell>
      </dl>

      <section aria-labelledby="audit-details" className="flex flex-col gap-3">
        <p id="audit-details" className={`text-[10px] text-[#B07A34] ${CAPS}`}>
          Recorded details
        </p>
        {details.length ? (
          <dl className="neu-recessed divide-y divide-dotted divide-[#B8946E]/50 rounded-[18px]">
            {details.map(([key, value]) => (
              <div key={key} className="grid gap-1 px-5 py-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4">
                <dt className="font-inter text-[11.5px] text-[#7D6855]">{humanize(key)}</dt>
                <dd className="whitespace-pre-line font-inter text-[12.5px] font-semibold text-[#341512] [overflow-wrap:anywhere]">{formatDetail(value)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="font-inter text-[12.5px] text-[#7D6855]">No extra details were recorded with this event.</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setShowRaw((v) => !v)}
          aria-expanded={showRaw}
          className={`inline-flex items-center gap-1.5 self-start text-[10px] text-[#946525] transition-colors hover:text-[#C58B3C] ${CAPS}`}
        >
          <motion.svg animate={{ rotate: showRaw ? 90 : 0 }} viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m9 6 6 6-6 6" />
          </motion.svg>
          {showRaw ? 'Hide raw record' : 'Show raw record'}
        </button>
        <AnimatePresence initial={false}>
          {showRaw && (
            <motion.pre
              key="raw"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="neu-recessed neu-scrollbar-discrete max-h-64 overflow-auto rounded-[16px] px-5 py-4 font-mono text-[11.5px] leading-relaxed text-[#3E2A1E]"
            >
              {JSON.stringify({ id: entry.id, action: entry.action, actor: entry.actor, targetType: entry.targetType, targetId: entry.targetId, timestamp: entry.timestamp, details: entry.details }, null, 2)}
            </motion.pre>
          )}
        </AnimatePresence>
      </section>
    </NeuModal>
  );
}
