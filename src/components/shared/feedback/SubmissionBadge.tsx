'use client';

/**
 * The submission badge (first built for the consultation booking dialog, now shared).
 *
 *  processing → a single caramel line runs around a pressed-in groove.
 *  success    → the line peels out of the groove and writes a check mark, turning green as it
 *               lands, while the centre of the groove rises into a raised disc.
 *  error      → the same line writes the first stroke of an X instead, turning red, the second
 *               stroke follows, and the badge gives one short shake. The centre stays pressed in.
 *
 * The outcome is only drawn once the caller passes it, i.e. once the real request has answered:
 * the badge never guesses. `onLanded` fires when the mark is complete, so copy and buttons can
 * change exactly when the drawing finishes.
 */
import { useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  animate,
  motion,
  useAnimationControls,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'motion/react';
import { FLAT_SHADOW } from '@/components/shared/neu/motion';

export type SubmissionOutcome = 'success' | 'error';

/** In progress / pending (the same caramel as the "Pending" status pills). */
export const INK_CARAMEL = '#C58B3C';
/** Done (the success tone used by NeuAlert and confirmed bookings). */
export const INK_GREEN = '#1F7A3A';
/** Failed (the error tone used by NeuAlert and destructive buttons). */
export const INK_RED = '#B42318';

// ─── Geometry ────────────────────────────────────────────────────────────────
// One SVG path per outcome: two laps of the groove, a hook inward, then the mark. A single dash
// slides along it. While saving, the dash circles the first lap (the second lap makes the loop
// seamless); once the result is known it slides on through the hook and comes to rest covering
// exactly the mark, so the spinner itself becomes the check (or the X's first stroke). Both paths
// share the same laps, so switching path when the outcome arrives is invisible.

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
    const pt: Pt = [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
    length += dist(prev, pt);
    prev = pt;
  }
  return length;
}

/** Badge box; also the SVG coordinate space. */
const SIZE = 140;
const MID = SIZE / 2;
/** Centre line of the pressed-in groove. */
const GROOVE_R = 61;
/** The centre that rises when the request succeeds. */
const DISC_R = 46;
const STROKE = 7;
const LOOP = 2 * Math.PI * GROOVE_R;
/** Where the line leaves the groove: its leftmost point, travelling clockwise (upward). */
const SEAM: Pt = [MID - GROOVE_R, MID];
const ONE_LAP = `A ${GROOVE_R} ${GROOVE_R} 0 1 1 ${MID + GROOVE_R} ${MID} A ${GROOVE_R} ${GROOVE_R} 0 1 1 ${SEAM[0]} ${SEAM[1]}`;

interface Mark {
  d: string;
  /** Distance along the line where the mark begins. */
  at: number;
  /** Length of the mark the dash comes to rest on. */
  len: number;
  color: string;
}

function buildMark(hook: readonly [Pt, Pt], points: readonly Pt[], color: string): Mark {
  const [start, ...rest] = points;
  const hookLen = cubicLength(SEAM, hook[0], hook[1], start);
  let len = 0;
  for (let i = 1; i < points.length; i++) len += dist(points[i - 1], points[i]);
  return {
    d: [
      `M ${SEAM[0]} ${SEAM[1]}`,
      ONE_LAP,
      ONE_LAP,
      `C ${hook[0].join(' ')} ${hook[1].join(' ')} ${start.join(' ')}`,
      ...rest.map((p) => `L ${p.join(' ')}`),
    ].join(' '),
    at: 2 * LOOP + hookLen,
    len,
    color,
  };
}

/** Check: arrives at 45°, the angle of its short stroke. */
const CHECK = buildMark([[MID - GROOVE_R, MID - 20], [34, 57]], [[48, 71], [62, 85], [93, 54]], INK_GREEN);
/** X, first stroke (top-left to bottom-right); the hook arrives along it. */
const CROSS = buildMark([[MID - GROOVE_R, MID - 24], [40, 40]], [[52, 52], [88, 88]], INK_RED);
/** X, second stroke, drawn after the first lands. */
const CROSS_SECOND = 'M 88 52 L 52 88';

/** Visible dash while saving (about 60° of the groove). */
const DASH = LOOP * 0.17;
/** Seconds per lap while saving. */
const SPIN_S = 1.25;
/** Seconds from "answered" until the mark is written. */
const WRITE_S = 0.95;
/** Seconds for the X's second stroke. */
const SECOND_S = 0.26;
/** Seconds per lap for the bead that keeps circling after a success that now waits on someone. */
const BEAD_LAP_S = 9;

/** .neu-raised-sm, layer for layer, so it interpolates from FLAT_SHADOW. */
const DISC_RAISED =
  '5px 5px 13px 0px rgba(206, 194, 183, 0.9), -5px -5px 10px 0px rgba(252, 238, 223, 0.9), 5px -5px 10px 0px rgba(206, 194, 183, 0.2), -5px 5px 10px 0px rgba(206, 194, 183, 0.2), inset -1px -1px 2px 0px rgba(206, 194, 183, 0.5), inset 1px 1px 2px 0px rgba(252, 238, 223, 0.3)';

const pct = (v: number) => `${(v / SIZE) * 100}%`;

export interface SubmissionBadgeProps {
  /** null while the request is running; the result once it has answered. */
  outcome: SubmissionOutcome | null;
  /** After a success that now waits on someone else, a caramel bead keeps circling the groove. */
  waiting?: boolean;
  /** Called once the mark is fully drawn. */
  onLanded?: () => void;
  /** Rendered size in px (the drawing scales). */
  size?: number;
}

export function SubmissionBadge({ outcome, waiting = false, onLanded, size = SIZE }: SubmissionBadgeProps) {
  const reduce = useReducedMotion();
  const mark = outcome === 'error' ? CROSS : CHECK;
  const offset = useMotionValue(0);
  const length = useMotionValue(DASH);
  const dashArray = useTransform(length, (l) => `${l} ${mark.at + mark.len + 20}`);
  const dashOffset = useTransform(offset, (o) => `${-o}`);
  // Colour and depth follow the line itself. The colour flips while the line is moving fastest,
  // just as it leaves the groove, so the in-between tone is never on screen for long.
  const stroke = useTransform(offset, [mark.at - 0.22 * LOOP, mark.at - 0.12 * LOOP], [INK_CARAMEL, mark.color]);
  const discShadow = useTransform(
    offset,
    [mark.at - 0.3 * LOOP, mark.at],
    outcome === 'success' ? [FLAT_SHADOW, DISC_RAISED] : [FLAT_SHADOW, FLAT_SHADOW]
  );
  const shake = useAnimationControls();
  const [firstStrokeDone, setFirstStrokeDone] = useState(false);

  const landedRef = useRef(onLanded);
  useEffect(() => {
    landedRef.current = onLanded;
  }, [onLanded]);

  // Saving: the dash circles the first lap; offset LOOP looks identical to 0, so it repeats seamlessly.
  useEffect(() => {
    if (outcome || reduce) return;
    const spin = animate(offset, [0, LOOP], { duration: SPIN_S, ease: 'linear', repeat: Infinity });
    return () => spin.stop();
  }, [outcome, reduce, offset]);

  // Answered: carry on from wherever the dash is and write the mark.
  useEffect(() => {
    if (!outcome) return;
    const target = outcome === 'error' ? CROSS : CHECK;
    const finish = () => {
      if (outcome === 'error') setFirstStrokeDone(true);
      // Reduced motion draws the X's second stroke at once, so it is complete right away.
      if (outcome !== 'error' || reduce) landedRef.current?.();
    };
    if (reduce) {
      offset.set(target.at);
      length.set(target.len);
      const id = requestAnimationFrame(finish);
      return () => cancelAnimationFrame(id);
    }
    // The same spot exists one lap later on the path; start there unless that leaves too
    // little travel for a smooth hand-off, in which case take one more lap.
    const lapPos = offset.get() % LOOP;
    let from = lapPos + LOOP;
    if (target.at - from < 0.6 * LOOP) from = lapPos;
    offset.set(from);
    // Start at the spinner's own speed (no hitch), then ease the pen to a stop on the mark.
    const travel = target.at - from;
    const startSlope = ((LOOP / SPIN_S) * WRITE_S) / travel;
    const write = animate(offset, target.at, {
      duration: WRITE_S,
      ease: [0.3, Math.min(0.9, 0.3 * startSlope), 0.25, 1],
      onComplete: finish,
    });
    const fit = animate(length, target.len, { duration: WRITE_S, ease: [0.45, 0, 0.2, 1] });
    return () => {
      write.stop();
      fit.stop();
    };
  }, [outcome, reduce, offset, length]);

  const crossComplete = () => {
    landedRef.current?.();
    void shake.start({ x: [0, -7, 6, -4, 3, 0], transition: { duration: 0.42, ease: 'easeInOut' } });
  };

  return (
    <motion.div layout aria-hidden="true" className="relative shrink-0" style={{ width: size, height: size }} animate={shake}>
      <div className="neu-pressed absolute inset-0 rounded-full" />
      <motion.div className="absolute rounded-full bg-[#E5D8CB]" style={{ inset: pct(MID - DISC_R), boxShadow: discShadow }} />
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 size-full overflow-visible">
        <motion.path
          d={mark.d}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ stroke, strokeDasharray: dashArray, strokeDashoffset: dashOffset }}
          // Reduced motion: no travel, the resting dash just pulses until the result appears.
          animate={reduce && !outcome ? { opacity: [1, 0.4, 1] } : { opacity: 1 }}
          transition={reduce && !outcome ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
        />
        {outcome === 'error' && firstStrokeDone && (
          <motion.path
            d={CROSS_SECOND}
            fill="none"
            stroke={INK_RED}
            strokeWidth={STROKE}
            strokeLinecap="round"
            initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: reduce ? 0 : SECOND_S, ease: [0.3, 0.7, 0.3, 1] }}
            onAnimationComplete={reduce ? undefined : crossComplete}
          />
        )}
      </svg>
      {/* The request now waits on someone else: a bead keeps circling where the line left. */}
      <AnimatePresence>
        {waiting && outcome === 'success' && !reduce && (
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
                left: pct(SEAM[0] - STROKE / 2),
                top: pct(SEAM[1] - STROKE / 2),
                width: pct(STROKE),
                height: pct(STROKE),
                backgroundColor: INK_CARAMEL,
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

export default SubmissionBadge;
