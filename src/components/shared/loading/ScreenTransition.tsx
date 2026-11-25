'use client';

/**
 * Screen-level loading for the portal shells (client, lawyer, admin).
 *
 * The shells switch tabs without a full page load (and keep visited tabs mounted), so Next.js's
 * loading.tsx alone would almost never show. `useScreenTransition` gives every navigation the
 * shell starts (sidebar, top bar, notifications) the global loading screen over the content
 * area until the new URL is in place, for at least MIN_VISIBLE_MS so it never flashes.
 *
 * Only screen changes use it. Modals, forms and in-page updates keep their own feedback.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ScreenLoader } from './ScreenLoader';
import { warmLoadingGifs } from './loadingGifs';

/** Long enough to register the picture, short enough not to slow anyone down. */
const MIN_VISIBLE_MS = 650;
/** Safety net: never keep the screen covered if a navigation is abandoned. */
const MAX_VISIBLE_MS = 10000;

const pathOf = (href: string) => href.split(/[?#]/)[0] || '/';

export function useScreenTransition(pathname: string) {
  const [pending, setPending] = useState<{ path: string; startedAt: number } | null>(null);

  // Fetch the GIFs early so the first transition already has its picture.
  useEffect(() => {
    warmLoadingGifs();
  }, []);

  /** Show the loading screen for a navigation to `href` (ignored when already there). */
  const start = useCallback(
    (href: string) => {
      const path = pathOf(href);
      if (path === pathname) return;
      setPending({ path, startedAt: Date.now() });
    },
    [pathname]
  );

  useEffect(() => {
    if (!pending) return;
    const elapsed = Date.now() - pending.startedAt;
    const arrived = pending.path === pathname;
    const wait = arrived ? MIN_VISIBLE_MS - elapsed : MAX_VISIBLE_MS - elapsed;
    const timer = setTimeout(() => setPending(null), Math.max(0, wait));
    return () => clearTimeout(timer);
  }, [pending, pathname]);

  return { loading: pending !== null, start };
}

/** Covers its positioned parent with the global loading screen while `show` is true. */
export function ScreenTransitionOverlay({ show, background }: { show: boolean; background?: string }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="screen-transition"
          className="absolute inset-0 z-40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.14, ease: 'easeOut' } }}
          exit={{ opacity: 0, transition: { duration: 0.28, ease: 'easeIn' } }}
        >
          <ScreenLoader variant="overlay" background={background} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
