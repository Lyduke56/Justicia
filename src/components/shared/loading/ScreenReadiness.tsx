'use client';

/**
 * Screen readiness: the portal's loading screen stays up until the screen the person opened has
 * all of its information, and the screen's entrance animation plays once the loading screen
 * lifts (not underneath it).
 *
 *  - Every screen slot of a portal shell (each kept-alive tab and the current route page) is a
 *    `ScreenSlot`. Anything inside it that loads data reports it with `useScreenLoading(loading)`.
 *  - `useScreenGate` (the shell) keeps the loading screen over the content area while a screen
 *    change is in progress or the active slot still has something loading, then reveals it.
 *  - `useScreenReveal()` tells a screen whether it has been revealed, and gives a key that changes
 *    on every reveal, so entrance animations wait for the loading screen and replay on each visit.
 *
 * Outside a portal shell (modals, public pages) nothing is gated: screens count as revealed.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useScreenTransition } from './ScreenTransition';
import {
  RevealContext,
  SlotContext,
  createScreenStore,
  useInScreenSlot,
  useScreenLoading,
  useScreenReveal,
  type ScreenReveal,
  type ScreenStore,
} from './screenSlot';

// The store, contexts and slot hooks live in ./screenSlot (ScreenLoader reads them too).
export { createScreenStore, useInScreenSlot, useScreenLoading, useScreenReveal, type ScreenReveal, type ScreenStore };

// ─── Slot ─────────────────────────────────────────────────────────────────────

export function ScreenSlot({
  store,
  slot,
  reveal,
  children,
}: {
  store: ScreenStore;
  slot: string;
  reveal: ScreenReveal;
  children: React.ReactNode;
}) {
  const slotValue = useMemo(() => ({ store, slot }), [store, slot]);
  const revealValue = useMemo(() => ({ revealed: reveal.revealed, revealKey: reveal.revealKey }), [reveal.revealed, reveal.revealKey]);
  return (
    <SlotContext.Provider value={slotValue}>
      <RevealContext.Provider value={revealValue}>{children}</RevealContext.Provider>
    </SlotContext.Provider>
  );
}

// ─── Gate: the shell's loading screen ─────────────────────────────────────────

/** Long enough to register the picture on a screen change, short enough not to slow anyone down. */
const MIN_VISIBLE_MS = 650;
/** After the screen is in place, give it a moment to start its requests before deciding. */
const SETTLE_MS = 220;
/** Safety net: never keep the screen covered for longer than this. */
const MAX_VISIBLE_MS = 12000;

/**
 * Decides when the portal's loading screen covers the content area.
 *
 * A "visit" is the active screen slot at the current path. Each new visit is covered until the
 * screen change has arrived and its slot has nothing loading (at least MIN_VISIBLE_MS for a change
 * started from the shell; at most MAX_VISIBLE_MS). Then the visit is revealed: the slot's reveal
 * key increases and the loading screen fades out.
 */
export function useScreenGate(pathname: string, activeSlot: string) {
  const [store] = useState(createScreenStore);
  // Readiness must wait for navigation even during the overlay's initial show delay.
  const { pending: navigating, start } = useScreenTransition(pathname);
  const busy = useSyncExternalStore(
    store.subscribe,
    () => store.isBusy(activeSlot),
    () => true
  );

  const visit = `${activeSlot}@${pathname}`;
  const [revealedVisit, setRevealedVisit] = useState<string | null>(null);
  const [revealKeys, setRevealKeys] = useState<Record<string, number>>({});
  const covered = navigating || revealedVisit !== visit;

  // When the loading screen came up, and when the current screen was put in place.
  const coveredSince = useRef<number | null>(null);
  const visitSince = useRef<{ visit: string; at: number }>({ visit: '', at: 0 });
  // The first visit follows the route's own loading.tsx, so it needs no minimum on top.
  const firstVisit = useRef(true);
  useEffect(() => {
    const now = Date.now();
    if (covered && coveredSince.current === null) coveredSince.current = now;
    if (!covered) coveredSince.current = null;
    if (visitSince.current.visit !== visit) visitSince.current = { visit, at: now };
  }, [covered, visit]);

  useEffect(() => {
    if (!covered || navigating) return;
    const now = Date.now();
    const since = coveredSince.current ?? now;
    const reveal = () => {
      firstVisit.current = false;
      setRevealedVisit(visit);
      setRevealKeys((keys) => ({ ...keys, [activeSlot]: (keys[activeSlot] ?? 0) + 1 }));
    };
    // Safety net: something that never finishes loading can't hold the screen forever.
    const untilMax = since + MAX_VISIBLE_MS - now;
    if (untilMax <= 0) {
      reveal();
      return;
    }
    if (busy) {
      // Still loading; this re-runs as soon as it finishes.
      const timer = setTimeout(reveal, untilMax);
      return () => clearTimeout(timer);
    }
    const earliest = Math.max(
      since + (firstVisit.current ? 0 : MIN_VISIBLE_MS),
      visitSince.current.at + SETTLE_MS
    );
    const timer = setTimeout(reveal, Math.max(earliest - now, 0));
    return () => clearTimeout(timer);
  }, [covered, navigating, busy, visit, activeSlot]);

  /** The reveal state a slot should see (only the active slot can be revealed). */
  const revealFor = useCallback(
    (slot: string): ScreenReveal => ({ revealed: slot === activeSlot && !covered, revealKey: revealKeys[slot] ?? 0 }),
    [activeSlot, covered, revealKeys]
  );

  return { store, covered, start, revealFor };
}
