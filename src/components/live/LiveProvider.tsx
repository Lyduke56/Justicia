'use client';

/**
 * Live updates (client side).
 *
 * <LiveProvider topic> subscribes once to the signed-in user's private
 * Supabase Realtime topic (computed by the server, see lib/realtime/live.ts).
 * When the server signals that some scopes changed, every view that called
 * useLiveRefresh() for one of those scopes silently re-fetches.
 *
 * Also refreshes everything when the browser tab becomes visible again after
 * a while, when the network comes back, and when Realtime reconnects — so a
 * missed signal never leaves a tab stale. If Realtime is unavailable, views
 * fall back to polling, but only while they are on screen.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { LiveScope } from '@/lib/realtime/live';
import { isLeaving } from '@/lib/auth/leaving';

type Listener = { scopes: ReadonlySet<LiveScope>; run: () => void };
type Dispatch = (scopes: LiveScope[] | '*') => void;

interface LiveContextValue {
  subscribe: (listener: Listener) => () => void;
  connected: boolean;
}

const LiveContext = createContext<LiveContextValue>({ subscribe: () => () => {}, connected: false });

/** True when the view is the one on screen (false for kept-alive hidden tabs). */
export const ViewActiveContext = createContext(true);
export const useViewActive = () => useContext(ViewActiveContext);

/** Refresh-on-return threshold: the browser tab must have been hidden at least this long. */
const STALE_AFTER_HIDDEN_MS = 15_000;

/**
 * Leaves the portal when this browser's session is no longer valid, e.g. after "Sign out
 * everywhere" on another device or an account suspension. Supabase Auth rejects the revoked
 * session, so this only sends the tab to the sign-in page; it never signs anyone out itself.
 */
async function leaveIfSignedOut() {
  // This tab is signing out on purpose and is already on its way to the landing page.
  if (isLeaving()) return;
  try {
    const { data, error } = await createClient().auth.getUser();
    if (error?.status === 401 || error?.status === 403 || (!error && !data.user)) {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload: no signed-in state may survive
      window.location.assign('/login');
    }
  } catch {
    // Network problems are not a sign-out; the next request will tell.
  }
}

export function LiveProvider({ topic, children }: { topic: string | null; children: React.ReactNode }) {
  const listeners = useRef(new Set<Listener>());
  const [connected, setConnected] = useState(false);

  const dispatch: Dispatch = useCallback((scopes) => {
    for (const listener of listeners.current) {
      if (scopes === '*' || scopes.some((s) => listener.scopes.has(s))) listener.run();
    }
  }, []);

  // Realtime subscription
  useEffect(() => {
    if (!topic) return;
    const supabase = createClient();
    let wasDisconnected = false;
    const channel = supabase
      .channel(topic, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'refresh' }, ({ payload }) => {
        const scopes = Array.isArray(payload?.scopes) ? (payload.scopes as LiveScope[]) : '*';
        if (scopes !== '*' && scopes.includes('session')) void leaveIfSignedOut();
        dispatch(scopes);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnected(true);
          // Catch up on anything that changed while we were disconnected.
          if (wasDisconnected) dispatch('*');
          wasDisconnected = false;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setConnected(false);
          wasDisconnected = true;
        }
      });
    return () => {
      setConnected(false);
      void supabase.removeChannel(channel);
    };
  }, [topic, dispatch]);

  // Browser tab returning to the foreground / network coming back
  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt >= STALE_AFTER_HIDDEN_MS) {
        void leaveIfSignedOut();
        dispatch('*');
      }
    };
    const onOnline = () => dispatch('*');
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
    };
  }, [dispatch]);

  const subscribe = useCallback((listener: Listener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const value = useMemo(() => ({ subscribe, connected }), [subscribe, connected]);
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

/**
 * Re-runs `refresh` whenever the server signals a change in one of `scopes`.
 * Bursts are coalesced (one call per ~300 ms). When Realtime is not connected,
 * `fallbackMs` enables polling — only while this view is on screen.
 */
export function useLiveRefresh(
  scopes: LiveScope[],
  refresh: () => unknown,
  { fallbackMs }: { fallbackMs?: number } = {}
): void {
  const { subscribe, connected } = useContext(LiveContext);
  const active = useViewActive();
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  });
  const scopeKey = [...scopes].sort().join(',');

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const run = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        refreshRef.current();
      }, 300);
    };
    const unsubscribe = subscribe({ scopes: new Set(scopeKey.split(',') as LiveScope[]), run });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [subscribe, scopeKey]);

  useEffect(() => {
    if (connected || !active || !fallbackMs) return;
    const timer = setInterval(() => refreshRef.current(), fallbackMs);
    return () => clearInterval(timer);
  }, [connected, active, fallbackMs]);
}
