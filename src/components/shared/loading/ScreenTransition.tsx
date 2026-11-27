'use client';

/**
 * Screen-level loading for the portal shells (client, lawyer, admin).
 *
 * The shells switch tabs without a full page load (and keep visited tabs mounted), so Next.js's
 * loading.tsx alone would almost never show. `useScreenTransition` gives every navigation the
 * shell starts (sidebar, top bar, notifications) the global loading screen over the content
 * area only for slow navigation. Once shown, it stays briefly to avoid flashing.
 *
 * Only screen changes use it. Modals, forms and in-page updates keep their own feedback.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ScreenLoader } from './ScreenLoader';
import { warmLoadingGifs } from './loadingGifs';

/** Long enough to register the picture, short enough not to slow anyone down. */
const SHOW_DELAY_MS = 200;
const MIN_VISIBLE_MS = 300;
/** Safety net: never keep the screen covered if a navigation is abandoned. */
const MAX_VISIBLE_MS = 10000;

const pathOf = (href: string, pathname: string) => href.split(/[?#]/)[0] || pathname;

type PendingNavigation = { path: string; startedAt: number; visibleAt: number | null };

export function useScreenTransition(pathname: string) {
  const [pending, setPending] = useState<PendingNavigation | null>(null);

  // Fetch the GIFs early so the first transition already has its picture.
  useEffect(() => {
    warmLoadingGifs();
  }, []);

  /** Show the loading screen for a navigation to `href` (ignored when already there). */
  const start = useCallback(
    (href: string) => {
      const path = pathOf(href, pathname);
      const startedAt = Date.now();
      // Returning to the current page also cancels an older pending overlay.
      setPending((previous) => path === pathname ? null : {
        path,
        startedAt,
        // Keep an already visible overlay (and its GIF) through rapid clicks.
        visibleAt: previous?.visibleAt ?? null,
      });
    },
    [pathname]
  );

  useEffect(() => {
    if (!pending) return;
    const now = Date.now();
    const elapsed = now - pending.startedAt;
    const arrived = pending.path === pathname;
    // Identity checks stop an old callback from clearing a newer navigation.
    const clear = () => setPending((current) => current === pending ? null : current);
    if (arrived) {
      const wait = pending.visibleAt === null ? 0 : MIN_VISIBLE_MS - (now - pending.visibleAt);
      const timer = setTimeout(clear, Math.max(0, wait));
      return () => clearTimeout(timer);
    }

    const timeout = setTimeout(clear, Math.max(0, MAX_VISIBLE_MS - elapsed));
    const reveal = pending.visibleAt === null ? setTimeout(() => {
      const visibleAt = Date.now();
      setPending((current) => current === pending ? { ...current, visibleAt } : current);
    }, Math.max(0, SHOW_DELAY_MS - elapsed)) : undefined;
    return () => {
      clearTimeout(timeout);
      clearTimeout(reveal);
    };
  }, [pending, pathname]);

  return { pending: pending !== null, loading: pending !== null && pending.visibleAt !== null, start };
}

/**
 * Covers its positioned parent with the global loading screen while `show` is true.
 *
 * `initial={false}`: when the page first loads with the screen covered, the overlay is there in
 * the server-rendered HTML at full opacity (not faded in after hydration), so it is the one
 * loading screen from the very first paint. Later shows still fade in.
 */
export function ScreenTransitionOverlay({ show, background }: { show: boolean; background?: string }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          key="screen-transition"
          className="absolute inset-0 z-40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.14, ease: 'easeOut' } }}
          exit={{ opacity: 0, transition: { duration: 0.15, ease: 'easeIn' } }}
        >
          <ScreenLoader variant="overlay" background={background} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
