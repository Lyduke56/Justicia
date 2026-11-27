'use client';

import React, { useEffect, useRef } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { ChevronRightIcon } from '@/components/shared/neu';
import { InlineLoader } from '@/components/shared/loading';
import { CARVE, EMBOSS, RISE } from './motion';

/**
 * KPI card shared by the lawyer Dashboard and Earnings & Payouts tabs: a recessed well (carves in)
 * holding a caramel plate (embosses out of it) with an icon, a figure that counts up, and a note.
 * The whole card is a button; its action label slides in on hover.
 */

// ─── Icons (from the Figma frame) ─────────────────────────────────────────────
const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};
type IconProps = { className?: string };

export const CalendarClockIcon = ({ className }: IconProps) => (
  <svg {...iconProps} className={className}>
    <path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7" />
    <path d="M16 2v4M8 2v4M3 10h18" />
    <circle cx="17.5" cy="17.5" r="4.5" />
    <path d="M17.5 15.5v2l1.5 1.5" />
  </svg>
);
export const BriefcaseClockIcon = ({ className }: IconProps) => (
  <svg {...iconProps} className={className}>
    <rect width="20" height="13" x="2" y="7" rx="2" />
    <path d="M16 20V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v15" />
    <circle cx="17" cy="17.5" r="4.5" />
    <path d="M17 15.5v2l1.5 1.5" />
  </svg>
);
export const BarChartIcon = ({ className }: IconProps) => (
  <svg {...iconProps} className={className}>
    <path d="M18 20V10M12 20V4M6 20v-6M3 20h18" />
  </svg>
);
export const StarCircleIcon = ({ className }: IconProps) => (
  <svg {...iconProps} className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="m12 6.5 1.7 3.5 3.8.5-2.7 2.6.6 3.9-3.4-1.9-3.4 1.9.6-3.9-2.7-2.6 3.8-.5L12 6.5Z" />
  </svg>
);
export const ChecklistIcon = ({ className }: IconProps) => (
  <svg {...iconProps} className={className}>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M7 8h4M7 12h3M7 16h2" />
    <path d="m13 15 2.2 2.2L20 12.5" />
  </svg>
);

// ─── Formatting ───────────────────────────────────────────────────────────────
/** 84900 → "₱84.9k", 1250000 → "₱1.3M", 250 → "₱250". */
export function formatPeso(amount: number): string {
  if (amount >= 999_950) return `₱${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 999.5) return `₱${(amount / 1_000).toFixed(1)}k`;
  return `₱${Math.round(amount)}`;
}

export const formatCount = (n: number) => String(Math.round(n));

/** Counts up to the value (from 0 on first show, then from the previous value). */
export function CountUp({ value, format, delay = 0.5 }: { value: number; format: (n: number) => string; delay?: number }) {
  const reduce = useReducedMotion();
  const progress = useMotionValue(0);
  const display = useTransform(progress, format);
  const first = useRef(true);

  useEffect(() => {
    if (reduce) {
      progress.set(value);
      return;
    }
    const controls = animate(progress, value, {
      duration: first.current ? 1 : 0.6,
      delay: first.current ? delay : 0,
      ease: [0.16, 1, 0.3, 1],
      // Marked as shown once it actually moves, so an effect re-run (React dev mode runs
      // effects twice) still plays the first, delayed count.
      onUpdate: () => {
        first.current = false;
      },
    });
    return () => controls.stop();
  }, [delay, progress, reduce, value]);

  return <motion.span>{display}</motion.span>;
}

// ─── KPI card ─────────────────────────────────────────────────────────────────
export function KpiCard({
  label,
  value,
  subtitle,
  icon,
  onClick,
  actionLabel,
  valueTitle,
  labelClassName = 'font-lora text-[15.5px] font-medium text-[#341512]',
  singleLine = false,
}: {
  label: React.ReactNode;
  /** null shows the inline loader. */
  value: React.ReactNode | null;
  subtitle: string | null;
  icon: React.ReactNode;
  onClick: () => void;
  actionLabel: string;
  /** Exact figure shown on hover (e.g. the full peso amount). */
  valueTitle?: string;
  /** Typography of the label. */
  labelClassName?: string;
  /** Keeps the label and the note on one line each, cutting them short with an ellipsis (the full
   *  text shows on hover) when the card is too narrow. */
  singleLine?: boolean;
}) {
  const clip = singleLine ? 'min-w-0 truncate' : '';
  return (
    <motion.button
      type="button"
      variants={CARVE}
      onClick={onClick}
      whileTap={{ scale: 0.985 }}
      aria-label={`${typeof label === 'string' ? label : ''}. ${actionLabel}`}
      className="lawyer-dash-kpi group flex h-full min-w-0 flex-col rounded-[18px] bg-[#E5D8CB] px-4 pb-5 pt-4 text-left sm:px-5"
    >
      <motion.span variants={RISE} className="flex items-center justify-between gap-2">
        <span className={`${labelClassName} ${clip}`} title={singleLine && typeof label === 'string' ? label : undefined}>
          {label}
        </span>
        <span className="lawyer-dash-kpi-arrow flex shrink-0 items-center gap-1 font-inter text-[10px] font-semibold uppercase tracking-wider text-[#B07A34]" aria-hidden>
          {actionLabel.split(' ')[0]}
          <ChevronRightIcon className="h-3 w-3" />
        </span>
      </motion.span>
      <motion.span
        variants={EMBOSS}
        className="lawyer-dash-plate mt-3 flex flex-1 flex-col justify-between rounded-[13px] px-4 pb-3 pt-3.5"
        style={{ backgroundColor: 'rgba(211, 151, 88, 0.3)' }}
      >
        <span className="flex items-center gap-3 text-[#341512]">
          {icon}
          <span className={`font-lora text-[34px] font-semibold leading-none sm:text-[38px] ${singleLine ? 'whitespace-nowrap' : ''}`} title={valueTitle}>
            {value ?? <InlineLoader className="text-[18px]" label="Loading value" />}
          </span>
        </span>
        <span
          className={`mt-2.5 block min-h-[1rem] font-inter text-[11px] leading-snug text-[#5C4535] ${clip}`}
          title={singleLine && subtitle ? subtitle : undefined}
        >
          {subtitle ?? <InlineLoader className="text-[9px]" label="Loading details" />}
        </span>
      </motion.span>
    </motion.button>
  );
}
