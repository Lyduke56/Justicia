'use client';

import React from 'react';
import { motion } from 'motion/react';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/shared/neu';
import { ScreenLoader } from '@/components/shared/loading';

/**
 * Pager under a consultation card (same as the client's booking card): raised arrows and a row
 * of dots where the caramel dot glides to the card shown. Long lists show "3 / 24" instead.
 */

const MAX_DOTS = 12;

interface CardPagerProps {
  items: Array<{ id: string; label: string }>;
  index: number;
  onGo: (index: number) => void;
  /** Unique per screen, so two pagers never share the gliding dot. */
  layoutId: string;
  className?: string;
}

export function CardPager({ items, index, onGo, layoutId, className = '' }: CardPagerProps) {
  const atStart = index <= 0;
  const atEnd = index >= items.length - 1;
  return (
    <div className={`flex select-none items-center justify-center gap-5 ${className}`}>
      <motion.button
        type="button"
        onClick={() => onGo(index - 1)}
        disabled={atStart}
        whileHover={atStart ? undefined : { x: -2 }}
        whileTap={atStart ? undefined : { scale: 0.86 }}
        className="neu-raised-sm grid size-9 place-items-center rounded-full text-[#341512] transition-colors hover:text-[#C58B3C] disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="Previous consultation"
      >
        <ChevronLeftIcon className="h-4 w-4" />
      </motion.button>

      {items.length <= MAX_DOTS ? (
        <div className="flex items-center gap-2.5" role="tablist" aria-label="Consultations">
          {items.map((item, i) => (
            <motion.button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={item.label}
              onClick={() => onGo(i)}
              whileHover={{ scale: 1.3 }}
              whileTap={{ scale: 0.85 }}
              className="relative flex size-3 items-center justify-center"
            >
              <span className="size-2 rounded-full bg-[#341512]/80" />
              {i === index && (
                <motion.span
                  layoutId={layoutId}
                  transition={{ type: 'spring', stiffness: 480, damping: 32 }}
                  className="absolute inset-0 rounded-full bg-[#C58B3C] shadow-[0_0_0_3px_rgba(197,139,60,0.18)]"
                />
              )}
            </motion.button>
          ))}
        </div>
      ) : (
        <span className="min-w-16 text-center font-lora text-sm font-semibold text-[#341512]">
          {index + 1} <span className="text-[#341512]/45">/ {items.length}</span>
        </span>
      )}

      <motion.button
        type="button"
        onClick={() => onGo(index + 1)}
        disabled={atEnd}
        whileHover={atEnd ? undefined : { x: 2 }}
        whileTap={atEnd ? undefined : { scale: 0.86 }}
        className="neu-raised-sm grid size-9 place-items-center rounded-full text-[#341512] transition-colors hover:text-[#C58B3C] disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="Next consultation"
      >
        <ChevronRightIcon className="h-4 w-4" />
      </motion.button>
    </div>
  );
}

/** Loading state for the consultation card area, about the height of a card so nothing jumps. */
export function ConsultationCardLoader() {
  return <ScreenLoader variant="panel" srLabel="Loading consultations" className="min-h-[18rem]" />;
}
