'use client';

import { useLayoutEffect, useState, useSyncExternalStore } from 'react';

/**
 * The Overview fits one screen when the window is wide and tall enough (the same query drives
 * the layout in admin.css): from 1280px wide (four KPIs in a row), or from 1024px when the
 * window is tall enough for the 2 × 2 KPIs plus a few rows. Below that the page flows and
 * scrolls like the other tabs.
 */
export const FIT_QUERY = '(min-width: 1280px) and (min-height: 640px), (min-width: 1024px) and (min-height: 880px)';

function subscribe(onChange: () => void) {
  const media = window.matchMedia(FIT_QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

export function useFitLayout(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(FIT_QUERY).matches, () => false);
}

/**
 * How many fixed-height rows fit in a list whose height comes from the layout (flex: 1).
 * Returns a callback ref for the list and the count, or null until the list has been measured
 * (a hidden, preloaded tab measures 0 and waits until it is shown).
 */
export function useFitRows(rowHeight: number, gap: number, settleMs = 0) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [fit, setFit] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!el) return;
    let timer: number | undefined;
    const measure = () => {
      const style = getComputedStyle(el);
      const height = el.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      if (height <= 0) return;
      setFit(Math.max(1, Math.floor((height + gap) / (rowHeight + gap))));
    };
    measure();
    // settleMs: wait for the size to hold still (e.g. while a neighbouring panel animates its
    // content), so the row count doesn't flicker on every intermediate frame.
    const observer = new ResizeObserver(() => {
      if (!settleMs) return measure();
      window.clearTimeout(timer);
      timer = window.setTimeout(measure, settleMs);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [el, rowHeight, gap, settleMs]);

  return [setEl, fit] as const;
}
