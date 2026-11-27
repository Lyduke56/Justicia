'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveRefresh, useViewActive } from '@/components/live/LiveProvider';
import { consultationCallPath } from '@/lib/consultations/call';
import type { ConsultationExtras, ConsultationExtrasMap } from '@/lib/consultations/extras';
import { useScreenLoading } from '@/components/shared/loading/ScreenReadiness';

const TICK_MS = 30_000;

/**
 * Attendance and cancellation requests for the signed-in user's consultations
 * (GET /api/live/consultation-extras), kept live. `now` ticks every 30 s so join windows open
 * on time, and the data reloads when a session ends so "missed" appears without a refresh.
 */
export function useConsultationExtras(enabled = true) {
  const router = useRouter();
  const active = useViewActive();
  const [extras, setExtras] = useState<ConsultationExtrasMap>({});
  const [now, setNow] = useState(() => Date.now());
  // The screen's loading screen waits for the first answer (live refreshes don't hold it).
  const [firstLoadDone, setFirstLoadDone] = useState(false);
  useScreenLoading(enabled && !firstLoadDone);
  const extrasRef = useRef(extras);
  useEffect(() => {
    extrasRef.current = extras;
  }, [extras]);

  const reload = useCallback(() => {
    if (!enabled) return Promise.resolve();
    return fetch('/api/live/consultation-extras', { cache: 'no-store', credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { data?: ConsultationExtrasMap } | null) => {
        if (body?.data && typeof body.data === 'object') setExtras(body.data);
        setNow(Date.now());
      })
      .catch(() => {
        // Keep what is on screen; the next refresh retries.
      })
      .finally(() => setFirstLoadDone(true));
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useLiveRefresh(['consultations', 'payments'], reload, { fallbackMs: 30_000 });

  useEffect(() => {
    if (!active || !enabled) return;
    const timer = setInterval(() => {
      const prev = Date.now() - TICK_MS;
      const next = Date.now();
      setNow(next);
      // A session ended since the last tick: "missed" is decided on the server.
      const ended = Object.values(extrasRef.current).some((x) => {
        const end = x.attendance.endsAt ? Date.parse(x.attendance.endsAt) : NaN;
        return end > prev && end <= next;
      });
      if (ended) void reload();
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [active, enabled, reload]);

  /**
   * Opens the in-app call page. Entering the call there (inside the join window) is what
   * records attendance.
   */
  const joinCall = useCallback(
    (consultationId: string) => {
      router.push(consultationCallPath(consultationId));
    },
    [router]
  );

  const extrasFor = useCallback((id: string | null | undefined): ConsultationExtras | null => (id ? extras[id] ?? null : null), [extras]);

  return { extras, extrasFor, now, reload, joinCall };
}
