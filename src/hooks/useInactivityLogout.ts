'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'click',
  'pointerdown',
] as const;

/**
 * useInactivityLogout
 *
 * Signs the user out and redirects to /login after INACTIVITY_TIMEOUT_MS
 * of no user interaction. Resets the timer on any detected user activity.
 *
 * Mount this once in a layout that wraps authenticated routes.
 */
export function useInactivityLogout() {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const logout = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login?reason=inactivity');
  }, [router]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(logout, INACTIVITY_TIMEOUT_MS);
  }, [logout]);

  useEffect(() => {
    // Start the timer immediately
    resetTimer();

    // Reset on any user activity
    ACTIVITY_EVENTS.forEach(event => {
      window.addEventListener(event, resetTimer, { passive: true });
    });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [resetTimer]);
}
