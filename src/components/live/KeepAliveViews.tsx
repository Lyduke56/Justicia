'use client';

/**
 * Keeps portal tabs mounted after their first render so switching between
 * them is instant: data, filters, selected items and scroll position are kept,
 * and nothing re-fetches on every switch (useLiveRefresh keeps them current).
 *
 * - The active tab mounts immediately; the remaining tabs mount quietly in the
 *   background shortly after, so even the first visit is already loaded.
 * - Hidden tabs use the `hidden` attribute (display: none). The fade-in CSS
 *   animation replays each time a tab is shown again.
 * - Route-driven pages (`fallback`, i.e. the layout's children) are not kept:
 *   Next.js's children element always renders the current route.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ViewActiveContext } from './LiveProvider';

interface KeepAliveViewsProps {
  /** Key of the kept-alive view to show, or null to show `fallback`. */
  activeKey: string | null;
  /** Kept-alive views, in background-loading priority order. */
  views: Record<string, () => React.ReactNode>;
  /** Rendered (and not kept) when activeKey is null. */
  fallback: React.ReactNode;
  /** Identity of the fallback route (e.g. pathname) so its fade-in replays per page. */
  fallbackKey?: string;
  /** id of the scrolling <main> element, for per-tab scroll restoration. */
  scrollContainerId: string;
  /** Mount the other tabs in the background (default true). */
  preload?: boolean;
}

const FIRST_PRELOAD_DELAY_MS = 900;
const BETWEEN_PRELOADS_MS = 450;
const ROUTE_SLOT = '__route__';

export function KeepAliveViews({
  activeKey,
  views,
  fallback,
  fallbackKey = '',
  scrollContainerId,
  preload = true,
}: KeepAliveViewsProps) {
  const [mounted, setMounted] = useState<string[]>(() => (activeKey ? [activeKey] : []));
  const viewKeys = Object.keys(views);
  const viewKeysId = viewKeys.join('|');

  // Make sure the active view is mounted (render-phase update; React re-renders immediately).
  if (activeKey && !mounted.includes(activeKey)) {
    setMounted((prev) => (prev.includes(activeKey) ? prev : [...prev, activeKey]));
  }

  // Preload the remaining tabs one by one in the background.
  useEffect(() => {
    if (!preload) return;
    const keys = viewKeysId.split('|');
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const idle = (cb: () => void) => {
      const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
      if (w.requestIdleCallback) w.requestIdleCallback(cb, { timeout: 1500 });
      else cb();
    };
    const step = (index: number) => {
      if (cancelled || index >= keys.length) return;
      idle(() => {
        if (cancelled) return;
        setMounted((prev) => (prev.includes(keys[index]) ? prev : [...prev, keys[index]]));
        timer = setTimeout(() => step(index + 1), BETWEEN_PRELOADS_MS);
      });
    };
    timer = setTimeout(() => step(0), FIRST_PRELOAD_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [preload, viewKeysId]);

  // Per-tab scroll position on the shared <main> scroller.
  const scrollPositions = useRef(new Map<string, number>());
  const shownKey = activeKey ?? ROUTE_SLOT;
  const shownKeyRef = useRef(shownKey);
  useEffect(() => {
    const el = document.getElementById(scrollContainerId);
    if (!el) return;
    const onScroll = () => scrollPositions.current.set(shownKeyRef.current, el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [scrollContainerId]);
  useLayoutEffect(() => {
    if (shownKeyRef.current === shownKey) return;
    shownKeyRef.current = shownKey;
    const el = document.getElementById(scrollContainerId);
    if (el) el.scrollTop = shownKey === ROUTE_SLOT ? 0 : (scrollPositions.current.get(shownKey) ?? 0);
  }, [shownKey, scrollContainerId]);

  return (
    <>
      {viewKeys
        .filter((key) => mounted.includes(key))
        .map((key) => {
          const active = key === activeKey;
          return (
            <div key={key} hidden={!active} className="client-view-enter" data-keep-alive={key}>
              <ViewActiveContext.Provider value={active}>{views[key]()}</ViewActiveContext.Provider>
            </div>
          );
        })}
      {activeKey === null && (
        <div key={`${ROUTE_SLOT}${fallbackKey}`} className="client-view-enter">
          {fallback}
        </div>
      )}
    </>
  );
}
