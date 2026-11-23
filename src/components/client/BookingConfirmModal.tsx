'use client';

/**
 * Booking confirmation dialog for the client booking flow.
 *
 *  review     → full-size sheet with every booking detail and "Confirm & Submit".
 *  submitting → the sheet fades, the panel shrinks to a compact card, and a single caramel line
 *               runs around a pressed-in groove while the request is saved.
 *  success    → the same line peels out of the groove and writes the check mark, turning green
 *               as it lands, while the centre of the groove rises into a raised disc. A caramel
 *               bead keeps circling the groove afterwards: the request now waits on the attorney.
 *
 * The compact card keeps one height in both states, so nothing shifts when the check lands.
 * If the request fails the card grows back into the review sheet with the error on top.
 * Render inside <AnimatePresence> so the overlay and panel animate out when it closes.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import {
  AnimatePresence,
  animate,
  motion,
  MotionConfig,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type Variants,
} from 'motion/react';
import {
  DetailsStatusRow,
  DetailsPersonBanner,
  DetailsCaseBlock,
} from '@/components/shared/ConsultationDetailsModal';
import {
  NeuAlert,
  NeuButton,
  CalendarClockIcon,
  CloseIcon,
  FileIcon,
  FLAT_SHADOW,
} from '@/components/shared/neu';

export type BookingConfirmPhase = 'review' | 'submitting' | 'success';

export interface BookingConfirmDetails {
  dateStr: string;
  timeSlot: string;
  communicationMode: 'video' | 'audio';
  lawyerName: string;
  lawyerLines: string[];
  rate: number | null;
  subject: string;
  description: string;
  attachments: Array<{ id: string; name: string; size: string }>;
}

interface BookingConfirmModalProps {
  phase: BookingConfirmPhase;
  details: BookingConfirmDetails;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

const EASE_OUT = [0.2, 0.8, 0.2, 1] as const;
/** In progress / pending (the same caramel as the "Pending" status pills). */
const CARAMEL = '#C58B3C';
/** Done (the success tone used by NeuAlert and confirmed bookings). */
const GREEN = '#1F7A3A';
const noopSubscribe = () => () => {};

const overlayVariants: Variants = {
  hidden: { opacity: 0, backdropFilter: 'blur(0px)' },
  show: { opacity: 1, backdropFilter: 'blur(7px)', transition: { duration: 0.28, ease: 'easeOut' } },
  exit: { opacity: 0, backdropFilter: 'blur(0px)', transition: { duration: 0.22, ease: 'easeIn', delay: 0.08 } },
};

const panelVariants: Variants = {
  hidden: { opacity: 0, y: 56, scale: 0.9, rotateX: 16, filter: 'blur(8px)' },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    rotateX: 0,
    filter: 'blur(0px)',
    transition: {
      type: 'spring',
      stiffness: 240,
      damping: 24,
      mass: 0.9,
      opacity: { duration: 0.25 },
      filter: { duration: 0.35, ease: 'easeOut' },
    },
  },
  exit: {
    opacity: 0,
    y: 36,
    scale: 0.94,
    rotateX: -10,
    filter: 'blur(6px)',
    transition: { duration: 0.24, ease: [0.4, 0, 1, 1] },
  },
};

const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14, filter: 'blur(4px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.38, ease: EASE_OUT } },
};

// ─── The line ────────────────────────────────────────────────────────────────
// One SVG path: two laps of the groove, a hook inward, then the check mark. A single dash
// slides along it. While saving, the dash circles the first lap (the second lap makes the
// loop seamless); on success it slides on through the hook and comes to rest covering
// exactly the check, so the spinner itself becomes the check.

type Pt = readonly [number, number];
const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);

function cubicLength(p0: Pt, p1: Pt, p2: Pt, p3: Pt, steps = 240): number {
  let length = 0;
  let prev: Pt = p0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    const pt: Pt = [
      a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
      a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
    ];
    length += dist(prev, pt);
    prev = pt;
  }
  return length;
}

/** Badge box in px; also the SVG coordinate space, so 1 unit = 1px. */
const SIZE = 140;
const MID = SIZE / 2;
/** Centre line of the pressed-in groove. */
const GROOVE_R = 61;
/** The centre that rises when the booking is recorded. */
const DISC_R = 46;
const STROKE = 7;
const LOOP = 2 * Math.PI * GROOVE_R;
/** Where the line leaves the groove: its leftmost point, travelling clockwise (upward). */
const SEAM: Pt = [MID - GROOVE_R, MID];
/** Cubic controls from the seam into the check; it arrives at 45°, the angle of the short stroke. */
const HOOK: readonly [Pt, Pt] = [[MID - GROOVE_R, MID - 20], [34, 57]];
const CHECK: readonly [Pt, Pt, Pt] = [[48, 71], [62, 85], [93, 54]];

const ONE_LAP = `A ${GROOVE_R} ${GROOVE_R} 0 1 1 ${MID + GROOVE_R} ${MID} A ${GROOVE_R} ${GROOVE_R} 0 1 1 ${SEAM[0]} ${SEAM[1]}`;
const LINE_D = [
  `M ${SEAM[0]} ${SEAM[1]}`,
  ONE_LAP,
  ONE_LAP,
  `C ${HOOK[0].join(' ')} ${HOOK[1].join(' ')} ${CHECK[0].join(' ')}`,
  `L ${CHECK[1].join(' ')}`,
  `L ${CHECK[2].join(' ')}`,
].join(' ');

const HOOK_LEN = cubicLength(SEAM, HOOK[0], HOOK[1], CHECK[0]);
const CHECK_LEN = dist(CHECK[0], CHECK[1]) + dist(CHECK[1], CHECK[2]);
/** Distance along the line where the check begins. */
const CHECK_AT = 2 * LOOP + HOOK_LEN;
const LINE_LEN = CHECK_AT + CHECK_LEN;
/** Visible dash while saving (about 60° of the groove). */
const DASH = LOOP * 0.17;
/** Seconds per lap while saving. */
const SPIN_S = 1.25;
/** Seconds from "saved" until the check is fully written. */
const WRITE_S = 0.95;
/** Seconds per lap for the bead that waits on the attorney. */
const BEAD_LAP_S = 9;

/** .neu-raised-sm, layer for layer, so it interpolates from FLAT_SHADOW. */
const DISC_RAISED =
  '5px 5px 13px 0px rgba(206, 194, 183, 0.9), -5px -5px 10px 0px rgba(252, 238, 223, 0.9), 5px -5px 10px 0px rgba(206, 194, 183, 0.2), -5px 5px 10px 0px rgba(206, 194, 183, 0.2), inset -1px -1px 2px 0px rgba(206, 194, 183, 0.5), inset 1px 1px 2px 0px rgba(252, 238, 223, 0.3)';

function InkCheck({ done, waiting, onLanded }: { done: boolean; waiting: boolean; onLanded: () => void }) {
  const reduce = useReducedMotion();
  const offset = useMotionValue(0);
  const length = useMotionValue(DASH);
  const dashArray = useTransform(length, (l) => `${l} ${LINE_LEN + 20}`);
  const dashOffset = useTransform(offset, (o) => `${-o}`);
  // Colour and depth follow the line itself. The colour flips while the line is moving fastest,
  // just as it leaves the groove, so the in-between olive is never on screen for long.
  const stroke = useTransform(offset, [CHECK_AT - 0.22 * LOOP, CHECK_AT - 0.12 * LOOP], [CARAMEL, GREEN]);
  const discShadow = useTransform(offset, [CHECK_AT - 0.3 * LOOP, CHECK_AT], [FLAT_SHADOW, DISC_RAISED]);

  const landedRef = useRef(onLanded);
  useEffect(() => {
    landedRef.current = onLanded;
  }, [onLanded]);

  // Saving: the dash circles the first lap; offset LOOP looks identical to 0, so it repeats seamlessly.
  useEffect(() => {
    if (done || reduce) return;
    const spin = animate(offset, [0, LOOP], { duration: SPIN_S, ease: 'linear', repeat: Infinity });
    return () => spin.stop();
  }, [done, reduce, offset]);

  // Saved: carry on from wherever the dash is and write the check.
  useEffect(() => {
    if (!done) return;
    if (reduce) {
      offset.set(CHECK_AT);
      length.set(CHECK_LEN);
      const id = requestAnimationFrame(() => landedRef.current());
      return () => cancelAnimationFrame(id);
    }
    // The same spot exists one lap later on the path; start there unless that leaves too
    // little travel for a smooth hand-off, in which case take one more lap.
    const lapPos = offset.get() % LOOP;
    let from = lapPos + LOOP;
    if (CHECK_AT - from < 0.6 * LOOP) from = lapPos;
    offset.set(from);
    // Start at the spinner's own speed (no hitch), then ease the pen to a stop on the check.
    const travel = CHECK_AT - from;
    const startSlope = ((LOOP / SPIN_S) * WRITE_S) / travel;
    const write = animate(offset, CHECK_AT, {
      duration: WRITE_S,
      ease: [0.3, Math.min(0.9, 0.3 * startSlope), 0.25, 1],
      onComplete: () => landedRef.current(),
    });
    const fit = animate(length, CHECK_LEN, { duration: WRITE_S, ease: [0.45, 0, 0.2, 1] });
    return () => {
      write.stop();
      fit.stop();
    };
  }, [done, reduce, offset, length]);

  return (
    <motion.div layout aria-hidden="true" className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
      <div className="neu-pressed absolute inset-0 rounded-full" />
      <motion.div
        className="absolute rounded-full bg-[#E5D8CB]"
        style={{ inset: MID - DISC_R, boxShadow: discShadow }}
      />
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 size-full overflow-visible">
        <motion.path
          d={LINE_D}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ stroke, strokeDasharray: dashArray, strokeDashoffset: dashOffset }}
          // Reduced motion: no travel, the resting dash just pulses until the check appears.
          animate={reduce && !done ? { opacity: [1, 0.4, 1] } : { opacity: 1 }}
          transition={reduce && !done ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
        />
      </svg>
      {/* The request now waits on the attorney: a bead keeps circling where the line left. */}
      <AnimatePresence>
        {waiting && !reduce && (
          <motion.div
            key="bead"
            className="pointer-events-none absolute inset-0"
            initial={{ rotate: 0 }}
            animate={{ rotate: 360 }}
            transition={{ duration: BEAD_LAP_S, ease: 'linear', repeat: Infinity }}
          >
            <motion.span
              className="absolute rounded-full"
              style={{
                left: SEAM[0] - STROKE / 2,
                top: SEAM[1] - STROKE / 2,
                width: STROKE,
                height: STROKE,
                backgroundColor: CARAMEL,
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 520, damping: 24, delay: 0.12 }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ReviewSheet({
  details,
  error,
  leaving,
  onConfirm,
  onClose,
  onLeft,
}: {
  details: BookingConfirmDetails;
  error: string | null;
  leaving: boolean;
  onConfirm: () => void;
  onClose: () => void;
  onLeft: () => void;
}) {
  const modeLabel = details.communicationMode === 'video' ? 'Video Consultation' : 'Audio Call';
  return (
    <motion.div
      key="review"
      className="flex min-h-0 flex-1 flex-col"
      initial={{ opacity: 0 }}
      animate={leaving ? { opacity: 0, scale: 0.97, filter: 'blur(6px)' } : { opacity: 1, scale: 1, filter: 'blur(0px)' }}
      transition={{ duration: leaving ? 0.22 : 0.3, ease: EASE_OUT }}
      onAnimationComplete={() => {
        if (leaving) onLeft();
      }}
    >
      <header className="shrink-0 flex items-start gap-4 px-7 sm:px-9 pt-7 sm:pt-8 pb-1">
        <motion.div
          initial={{ scale: 0.3, rotate: -20, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 460, damping: 15, delay: 0.12 }}
          className="neu-raised-sm size-11 sm:size-12 shrink-0 rounded-2xl flex items-center justify-center text-[#C58B3C]"
        >
          <CalendarClockIcon className="w-5 h-5" />
        </motion.div>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 id="booking-confirm-title" className="font-lora text-lg sm:text-xl font-bold text-[#341512] leading-tight">
            Confirm your booking
          </h2>
          <p className="mt-1.5 font-inter text-xs sm:text-[13px] text-[#5C4535] leading-relaxed">
            Check the details below before sending your request to {details.lawyerName}.
          </p>
        </div>
        <motion.button
          type="button"
          aria-label="Close"
          onClick={onClose}
          disabled={leaving}
          whileHover={{ rotate: 90 }}
          whileTap={{ scale: 0.88 }}
          transition={{ type: 'spring', stiffness: 420, damping: 18 }}
          className="neu-raised-sm size-9 shrink-0 rounded-full flex items-center justify-center text-[#5C4535] hover:text-[#A8742E] transition-colors disabled:opacity-40 cursor-pointer"
        >
          <CloseIcon className="w-3.5 h-3.5" />
        </motion.button>
      </header>

      <motion.div
        variants={listVariants}
        initial="hidden"
        animate="show"
        className="min-h-0 flex-1 overflow-y-auto neu-scrollbar-discrete px-7 sm:px-9 pt-6 pb-8 space-y-6"
      >
        <AnimatePresence initial={false}>
          {error && (
            <NeuAlert key="error" tone="error" title="We couldn't submit your booking">
              {error}
            </NeuAlert>
          )}
        </AnimatePresence>
        <motion.div variants={itemVariants}>
          <DetailsStatusRow dateStr={details.dateStr} timeSlot={details.timeSlot} statusLabel={modeLabel} statusTone="caramel" />
        </motion.div>
        <motion.div variants={itemVariants}>
          <DetailsPersonBanner person={{ name: details.lawyerName, lines: details.lawyerLines, rate: details.rate }} />
        </motion.div>
        <motion.div variants={itemVariants}>
          <DetailsCaseBlock
            docket="SUBJECT MATTER & CASE DOCKET"
            caseTitle={details.subject}
            caseDescription={details.description || 'No additional details were provided for this consultation.'}
          />
        </motion.div>
        {details.attachments.length > 0 && (
          <motion.div variants={itemVariants} className="space-y-2.5">
            <p className="font-lora text-xs font-bold uppercase tracking-wider text-[#5C4535]">
              Shared documents ({details.attachments.length})
            </p>
            <ul className="flex flex-wrap gap-2.5">
              {details.attachments.map((f) => (
                <li
                  key={f.id}
                  className="neu-raised-pill bg-[#E5D8CB] flex max-w-full items-center gap-2 rounded-full px-4 py-2 font-inter text-[11px] sm:text-xs text-[#341512]"
                >
                  <FileIcon className="w-3.5 h-3.5 shrink-0 text-[#C58B3C]" />
                  <span className="truncate">{f.name}</span>
                  <span className="shrink-0 text-[#5C4535]">{f.size}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
        <motion.p variants={itemVariants} className="font-inter text-[11.5px] sm:text-xs text-[#5C4535] leading-relaxed">
          Your request goes to the attorney for approval. You will only be asked to pay after they approve it.
        </motion.p>
      </motion.div>

      <footer className="shrink-0 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 px-7 sm:px-9 py-5 sm:py-6 border-t border-[#CDBCA8]/60">
        <NeuButton variant="secondary" onClick={onClose} disabled={leaving}>
          Edit Booking
        </NeuButton>
        <NeuButton variant="primary" onClick={onConfirm} disabled={leaving} autoFocus>
          Confirm &amp; Submit
        </NeuButton>
      </footer>
    </motion.div>
  );
}

function StatusCard({
  done,
  details,
  onClose,
}: {
  done: boolean;
  details: BookingConfirmDetails;
  onClose: () => void;
}) {
  const [landed, setLanded] = useState(false);
  // The copy and button change when the check has landed, not when the server answers.
  const finished = done && landed;
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (finished) actionsRef.current?.querySelector('button')?.focus();
  }, [finished]);

  return (
    <motion.div
      key="status"
      layout
      className="flex flex-col items-center px-7 sm:px-9 pt-9 pb-8 text-center"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, delay: 0.08, ease: EASE_OUT }}
    >
      <InkCheck done={done} waiting={finished} onLanded={() => setLanded(true)} />

      <motion.div layout className="mt-6 min-h-[6.5rem] w-full" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={finished ? 'done' : 'working'}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
          >
            <h2 id="booking-confirm-title" className="font-lora text-xl font-bold leading-tight text-[#341512]">
              {finished ? 'Booking submitted' : 'Submitting your booking'}
            </h2>
            <p className="mx-auto mt-2 max-w-[34ch] font-inter text-[13px] leading-relaxed text-[#5C4535]">
              {finished
                ? `${details.lawyerName} has your request. We'll notify you once they approve it, and payment is only requested after that.`
                : `Sending your request to ${details.lawyerName}.`}
            </p>
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <motion.div layout className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <span className="neu-raised-pill bg-[#E5D8CB] rounded-full px-4 py-1.5 font-lora text-[10.5px] font-bold uppercase tracking-wider text-[#5C4535]">
          {details.dateStr}
        </span>
        <span className="neu-raised-pill bg-[#E5D8CB] rounded-full px-4 py-1.5 font-lora text-[10.5px] font-bold text-[#5C4535]">
          {details.timeSlot}
        </span>
      </motion.div>

      {/* Space is held while saving so the card doesn't grow when the button appears. */}
      <motion.div
        ref={actionsRef}
        layout
        className="mt-6 flex w-full justify-center"
        style={{ visibility: finished ? 'visible' : 'hidden' }}
        initial={false}
        animate={finished ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
        transition={{ duration: 0.3, delay: finished ? 0.15 : 0, ease: EASE_OUT }}
      >
        <NeuButton variant="primary" onClick={onClose} className="w-full sm:w-48">
          Done
        </NeuButton>
      </motion.div>
    </motion.div>
  );
}

export function BookingConfirmModal({
  phase,
  details,
  error,
  onConfirm,
  onClose,
}: BookingConfirmModalProps) {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  // The panel only shrinks once the review sheet has faded out.
  const [compact, setCompact] = useState(phase !== 'review');
  if (phase === 'review' && compact) setCompact(false);

  const dismissible = phase !== 'submitting';

  useEffect(() => {
    if (!dismissible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dismissible, onClose]);

  if (!mounted) return null;

  return createPortal(
    <MotionConfig reducedMotion="user">
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4 sm:p-6 bg-[radial-gradient(ellipse_at_center,rgba(26,15,10,0.5)_0%,rgba(26,15,10,0.78)_100%)]"
        style={{ perspective: 1400 }}
        variants={overlayVariants}
        initial="hidden"
        animate="show"
        exit="exit"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && dismissible) onClose();
        }}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-confirm-title"
          aria-busy={phase === 'submitting' || undefined}
          variants={panelVariants}
          layout
          transition={{ layout: { type: 'spring', stiffness: 260, damping: 30, mass: 0.9 } }}
          // Radius in style so motion keeps the corners round while the panel resizes.
          style={{ borderRadius: 30, transformOrigin: '50% 50%' }}
          className={`neu-modal relative my-auto flex w-full max-h-[90vh] flex-col overflow-hidden ${
            compact ? 'max-w-[26rem]' : 'sm:max-w-2xl lg:max-w-3xl'
          }`}
        >
          {compact ? (
            <StatusCard done={phase === 'success'} details={details} onClose={onClose} />
          ) : (
            <ReviewSheet
              details={details}
              error={error}
              leaving={phase !== 'review'}
              onConfirm={onConfirm}
              onClose={onClose}
              onLeft={() => setCompact(true)}
            />
          )}
        </motion.div>
      </motion.div>
    </MotionConfig>,
    document.body
  );
}

export default BookingConfirmModal;
