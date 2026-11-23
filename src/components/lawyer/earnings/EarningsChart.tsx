'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { LawyerEarningsData } from '@/app/actions/consultationActions';
import { EASE_OUT } from '../motion';
import { MONTHS_FULL, MONTHS_SHORT, chartScale, compactNumber, monthValues, pesoWhole, smoothPath, type ChartMetric } from './model';

/**
 * Monthly line chart, drawn at the container's real width so text and dots never stretch.
 * Each month is a column you can click (or reach with Tab / ← →): the pressed-in column glides
 * to it and the figures above the chart follow. On entrance the line draws itself left to right
 * and each month's dot settles as the line reaches it. Switching between earnings and sessions
 * morphs the line to the new figures. Months still ahead are dimmed and not plotted.
 */

const HEIGHT = 272;
const PAD = { top: 40, right: 12, bottom: 34, left: 46 };
const LINE_DELAY = 0.55;
const LINE_DURATION = 1.1;
/** The column, guide and bubble for the chosen month appear once the line reaches the end. */
const AFTER_LINE = LINE_DELAY + LINE_DURATION - 0.15;

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

export function EarningsChart({
  data,
  metric,
  selected,
  onSelect,
}: {
  data: LawyerEarningsData;
  metric: ChartMetric;
  selected: number;
  onSelect: (month: number) => void;
}) {
  const reduce = useReducedMotion();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  const values = monthValues(data, metric);
  const lastMonth = data.currentMonth;
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const band = plotW / 12;
  const narrow = width < 560;

  const { ticks, max } = useMemo(() => chartScale(values, metric), [values, metric]);
  const x = (i: number) => PAD.left + band * (i + 0.5);
  const y = (v: number) => PAD.top + plotH * (1 - v / max);
  const points = values.slice(0, lastMonth + 1).map((v, i) => ({ x: x(i), y: y(v), v }));
  const line = smoothPath(points);
  const baseY = PAD.top + plotH;
  const area = points.length > 1 ? `${line} L${points[points.length - 1].x},${baseY} L${points[0].x},${baseY} Z` : '';

  const format = (v: number) => (metric === 'earnings' ? pesoWhole(v) : `${v} session${v === 1 ? '' : 's'}`);
  const focus = hover ?? selected;
  const focusPoint = focus <= lastMonth ? { x: x(focus), y: y(values[focus]) } : null;

  const move = (to: number) => {
    const next = Math.max(0, Math.min(lastMonth, to));
    onSelect(next);
    buttons.current[next]?.focus();
  };

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height: HEIGHT }}>
      {width > 0 && (
        <>
          {/* Selected month: a column pressed into the card */}
          <motion.div
            aria-hidden
            className="lawyer-chart-column absolute rounded-[14px]"
            initial={reduce ? false : { x: PAD.left + band * selected + 3, opacity: 0 }}
            animate={{ x: PAD.left + band * selected + 3, opacity: selected <= lastMonth ? 1 : 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34, opacity: { duration: 0.4, delay: reduce ? 0 : AFTER_LINE } }}
            style={{ left: 0, top: PAD.top - 26, width: Math.max(0, band - 6), height: plotH + 26 + PAD.bottom - 4 }}
          />

          <svg width={width} height={HEIGHT} className="absolute inset-0 overflow-visible" aria-hidden>
            <defs>
              <linearGradient id="earnings-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#D39758" stopOpacity={0.34} />
                <stop offset="100%" stopColor="#D39758" stopOpacity={0} />
              </linearGradient>
            </defs>

            {/* Grid and axis */}
            {ticks.map((tick, i) => (
              <g key={i}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(tick)}
                  y2={y(tick)}
                  stroke={i === 0 ? 'rgba(52,21,18,0.35)' : 'rgba(52,21,18,0.08)'}
                  strokeWidth={1}
                  strokeDasharray={i === 0 ? undefined : '3 5'}
                />
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.text
                    key={`${metric}-${tick}`}
                    x={PAD.left - 10}
                    y={y(tick) + 3.5}
                    textAnchor="end"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="fill-[#7D6855] font-inter text-[10px]"
                  >
                    {compactNumber(tick)}
                  </motion.text>
                </AnimatePresence>
              </g>
            ))}

            {/* Area and line */}
            {area && (
              <motion.path
                d={area}
                fill="url(#earnings-area)"
                initial={reduce ? false : { opacity: 0, d: area }}
                animate={{ opacity: 1, d: area }}
                transition={{ opacity: { duration: 0.6, delay: reduce ? 0 : LINE_DELAY + LINE_DURATION * 0.6 }, d: { duration: 0.6, ease: EASE_OUT } }}
              />
            )}
            <motion.path
              d={line}
              fill="none"
              stroke="#341512"
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduce ? false : { pathLength: 0, d: line }}
              animate={{ pathLength: 1, d: line }}
              transition={{ pathLength: { duration: LINE_DURATION, delay: LINE_DELAY, ease: [0.45, 0, 0.25, 1] }, d: { duration: 0.6, ease: EASE_OUT } }}
            />

            {/* Guide from the focused dot to the axis */}
            {focusPoint && (
              <motion.line
                initial={reduce ? false : { opacity: 0, x1: focusPoint.x, x2: focusPoint.x, y1: focusPoint.y + 8, y2: baseY }}
                animate={{ opacity: 1, x1: focusPoint.x, x2: focusPoint.x, y1: focusPoint.y + 8, y2: baseY }}
                transition={{ type: 'spring', stiffness: 380, damping: 34, opacity: { duration: 0.3, delay: reduce ? 0 : AFTER_LINE } }}
                stroke="#C58B3C"
                strokeWidth={1.25}
                strokeDasharray="2 4"
              />
            )}

            {/* Month dots: each settles as the line reaches it */}
            {points.map((p, i) => {
              const active = i === selected;
              return (
                <motion.circle
                  key={i}
                  initial={reduce ? false : { scale: 0, opacity: 0, cx: p.x, cy: p.y }}
                  animate={{ scale: 1, opacity: 1, cx: p.x, cy: p.y, r: active ? 6 : 4 }}
                  transition={{
                    scale: { type: 'spring', stiffness: 520, damping: 20, delay: LINE_DELAY + (LINE_DURATION * i) / Math.max(1, points.length - 1) },
                    opacity: { duration: 0.15, delay: LINE_DELAY + (LINE_DURATION * i) / Math.max(1, points.length - 1) },
                    cx: { duration: 0.6, ease: EASE_OUT },
                    cy: { duration: 0.6, ease: EASE_OUT },
                    r: { type: 'spring', stiffness: 500, damping: 26 },
                  }}
                  style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                  fill={active ? '#C58B3C' : '#E5D8CB'}
                  stroke="#341512"
                  strokeWidth={2}
                />
              );
            })}
          </svg>

          {/* Value bubble over the hovered (or selected) month */}
          <AnimatePresence>
            {focusPoint && (
              <motion.div
                key="bubble"
                aria-hidden
                className="pointer-events-none absolute left-0 top-0 z-10"
                initial={reduce ? false : { opacity: 0, x: focusPoint.x, y: focusPoint.y }}
                animate={{ opacity: 1, x: focusPoint.x, y: focusPoint.y }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 34, opacity: { duration: 0.25, delay: reduce ? 0 : AFTER_LINE + 0.1 } }}
              >
                <span className="absolute bottom-3 left-0 flex -translate-x-1/2 flex-col items-center">
                  <span className="whitespace-nowrap rounded-[9px] bg-[#341512] px-2.5 py-1 font-inter text-[11px] font-semibold text-[#F6EBDD] shadow-[3px_3px_8px_rgba(52,21,18,0.25)]">
                    {format(values[focus])}
                  </span>
                  <span className="-mt-1 size-2 rotate-45 bg-[#341512]" />
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Month columns: the click / keyboard targets, with their labels */}
          <div
            role="group"
            aria-label={`Months of ${data.year}`}
            className="absolute inset-0"
            onMouseLeave={() => setHover(null)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') {
                e.preventDefault();
                move(selected + 1);
              } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                move(selected - 1);
              }
            }}
          >
            {MONTHS_SHORT.map((m, i) => {
              const future = i > lastMonth;
              const active = i === selected;
              return (
                <button
                  key={m}
                  ref={(el) => {
                    buttons.current[i] = el;
                  }}
                  type="button"
                  disabled={future}
                  tabIndex={active ? 0 : -1}
                  aria-pressed={active}
                  aria-label={future ? `${MONTHS_FULL[i]}: not yet` : `${MONTHS_FULL[i]}: ${format(values[i])}`}
                  onClick={() => onSelect(i)}
                  onMouseEnter={() => !future && setHover(i)}
                  onFocus={() => setHover(null)}
                  className="lawyer-chart-hit absolute flex items-end justify-center rounded-[14px] pb-2.5 disabled:cursor-default"
                  style={{ left: PAD.left + band * i, width: band, top: PAD.top - 26, bottom: 4 }}
                >
                  <span
                    className={`font-inter text-[10.5px] transition-colors duration-200 ${
                      active ? 'font-bold text-[#B07A34]' : future ? 'text-[#341512]/30' : 'text-[#5C4535]'
                    }`}
                  >
                    {narrow ? m[0] : m}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
