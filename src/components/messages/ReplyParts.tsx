'use client';

/* eslint-disable @next/next/no-img-element -- signed / blob URLs from private storage */

import React from 'react';
import { motion } from 'motion/react';
import { CloseIcon, FileIcon } from '@/components/shared/neu';
import type { AttachmentKind } from '@/lib/messaging/types';
import { MicIcon, ReplyIcon } from './MessageIcons';

export interface QuoteInfo {
  author: string;
  text: string;
  /** First image of the quoted message, if any. */
  thumbUrl?: string | null;
  /** Kind of the quoted message's first non-image attachment, for a small glyph. */
  kind?: AttachmentKind | null;
}

/** Pressed into the raised parchment bubble / the espresso bubble. */
const WELL_THEM =
  'bg-[#E1D2C2] shadow-[inset_3px_3px_7px_rgba(190,170,150,0.7),inset_-3px_-3px_7px_rgba(255,250,243,0.85)]';
const WELL_ME =
  'bg-[#250D08] shadow-[inset_3px_3px_7px_rgba(0,0,0,0.55),inset_-2px_-2px_6px_rgba(255,236,214,0.08)]';

function KindGlyph({ kind, className }: { kind?: AttachmentKind | null; className: string }) {
  if (kind === 'audio') return <MicIcon className={className} />;
  if (kind === 'file' || kind === 'video') return <FileIcon className={className} />;
  return null;
}

/** The quoted message, carved into the reply bubble. Click to jump to the original. */
export function ReplyQuote({
  quote,
  mine,
  onJump,
  compact = false,
}: {
  quote: QuoteInfo | null;
  mine: boolean;
  onJump?: () => void;
  compact?: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onJump?.();
      }}
      whileHover={onJump ? { scale: 1.015 } : undefined}
      whileTap={onJump ? { scale: 0.98 } : undefined}
      transition={{ type: 'spring', stiffness: 500, damping: 26 }}
      disabled={!onJump}
      title={onJump ? 'Show original message' : undefined}
      className={`group/quote relative w-full min-w-[170px] flex items-stretch gap-2.5 rounded-[13px] pl-2 pr-2.5 py-2 text-left cursor-pointer disabled:cursor-default ${
        compact ? 'mb-1.5' : 'mb-2'
      } ${mine ? WELL_ME : WELL_THEM}`}
    >
      {/* Bookmark ribbon */}
      <span
        aria-hidden="true"
        className="w-[3px] shrink-0 rounded-full bg-gradient-to-b from-[#E8B877] via-[#D39758] to-[#B07A34]"
      />
      <span className="min-w-0 flex-1">
        <span className={`flex items-center gap-1.5 font-lora text-[11px] font-bold ${mine ? 'text-[#E8B877]' : 'text-[#A8742E]'}`}>
          <ReplyIcon className="w-3 h-3 shrink-0 -scale-x-100" />
          <span className="truncate">{quote ? quote.author : 'Original message'}</span>
        </span>
        <span
          className={`mt-0.5 flex items-start gap-1.5 font-lora italic text-[12px] leading-snug ${mine ? 'text-[#FAF6F0]/72' : 'text-[#5C4535]'}`}
        >
          <KindGlyph kind={quote?.kind} className="w-3 h-3 mt-[3px] shrink-0 not-italic" />
          <span className="line-clamp-2 break-words">{quote ? quote.text : 'This message is no longer available.'}</span>
        </span>
      </span>
      {quote?.thumbUrl && (
        <img
          src={quote.thumbUrl}
          alt=""
          className="size-10 shrink-0 self-center rounded-[9px] object-cover shadow-[2px_2px_5px_rgba(52,21,18,0.25)]"
        />
      )}
    </motion.button>
  );
}

/** "↱ You replied to Atty. Cruz" — the curved thread line above a reply. */
export function RepliedLabel({ text, mine }: { text: string; mine: boolean }) {
  return (
    <span
      className={`flex items-end gap-1 mb-1 font-inter text-[10.5px] font-medium text-[#8E7E70] ${
        mine ? 'pr-2 flex-row-reverse' : 'pl-[46px]'
      }`}
    >
      <svg
        className={`w-4 h-3.5 shrink-0 text-[#C9A57A] ${mine ? '-scale-x-100' : ''}`}
        viewBox="0 0 16 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M2 13V9.5C2 6 4.5 3.5 8 3.5h6" />
        <path d="M11.5 1l2.5 2.5L11.5 6" />
      </svg>
      <span className="truncate">{text}</span>
    </span>
  );
}

/** Docked above the message box while replying: a raised slip with the quoted message. */
export function ReplyComposerCard({ quote, onCancel }: { quote: QuoteInfo; onCancel: () => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.96, rotateX: 25 }}
      animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
      exit={{ opacity: 0, y: 12, scale: 0.97, transition: { duration: 0.16 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      style={{ transformPerspective: 700, transformOrigin: '50% 100%' }}
      className="relative neu-raised-sm rounded-[18px] pl-4 pr-2.5 py-2.5 flex items-center gap-3 overflow-hidden"
    >
      {/* Caramel edge, like a bookmark tucked into the page */}
      <span aria-hidden="true" className="absolute left-0 inset-y-0 w-[5px] bg-gradient-to-b from-[#E8B877] via-[#D39758] to-[#B07A34]" />
      <motion.span
        initial={{ rotate: -40, scale: 0.6 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 14, delay: 0.05 }}
        className="neu-recessed size-9 shrink-0 rounded-full flex items-center justify-center text-[#C58B3C]"
      >
        <ReplyIcon className="w-4 h-4" />
      </motion.span>
      <div className="min-w-0 flex-1">
        <p className="font-lora text-[12px] text-[#7D6855] leading-tight">
          Replying to <span className="font-bold text-[#341512]">{quote.author}</span>
        </p>
        <p className="mt-1 flex items-center gap-1.5 font-lora italic text-[12.5px] text-[#5C4535] min-w-0">
          <KindGlyph kind={quote.kind} className="w-3.5 h-3.5 shrink-0 text-[#A8742E]" />
          <span className="truncate">{quote.text}</span>
        </p>
      </div>
      {quote.thumbUrl && (
        <img src={quote.thumbUrl} alt="" className="size-10 shrink-0 rounded-[10px] object-cover shadow-[2px_2px_6px_rgba(52,21,18,0.22)]" />
      )}
      <motion.button
        type="button"
        onClick={onCancel}
        whileHover={{ rotate: 90 }}
        whileTap={{ scale: 0.85 }}
        aria-label="Cancel reply"
        className="neu-raised-sm size-7 shrink-0 rounded-full flex items-center justify-center text-[#7D6855] hover:text-[#341512] cursor-pointer"
      >
        <CloseIcon className="w-2.5 h-2.5" />
      </motion.button>
    </motion.div>
  );
}
