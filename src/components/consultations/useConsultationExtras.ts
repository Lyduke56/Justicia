'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLiveRefresh, useViewActive } from '@/components/live/LiveProvider';
import { recordMeetingJoinAction } from '@/app/actions/consultationExtrasActions';
import type { ConsultationExtras, ConsultationExtrasMap } from '@/lib/consultations/extras';

const TICK_MS = 30_000;

/**
 * Attendance and cancellation requests for the signed-in user's consultations
 * (GET /api/live/consultation-extras), kept live. `now` ticks every 30 s so join windows open
 * on time, and the data reloads when a session ends so "missed" appears without a refresh.
 */
export function useConsultationExtras(enabled = true) {
  const active = useViewActive();
  const [extras, setExtras] = useState<ConsultationExtrasMap>({});
  const [now, setNow] = useState(() => Date.now());
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
      });
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
   * Opens the Meet link in a new tab (right away, so pop-up blockers allow it) and records the
   * join in the background.
   */
  const joinMeeting = useCallback(
    (consultationId: string, url: string) => {
      window.open(url, '_blank', 'noopener,noreferrer');
      void recordMeetingJoinAction(consultationId)
        .then((res) => {
          if ('recorded' in res && res.recorded) void reload();
        })
        .catch(() => undefined);
    },
    [reload]
  );

  const extrasFor = useCallback((id: string | null | undefined): ConsultationExtras | null => (id ? extras[id] ?? null : null), [extras]);

  return { extras, extrasFor, now, reload, joinMeeting };
}
