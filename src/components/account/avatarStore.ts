'use client';

/**
 * Profile photos in the browser, shared by every component of the page:
 *  - useMyAvatar: the signed-in user's photo (top bar, account menu, profile and settings pages).
 *    The portal shell seeds it from the server (useMyAvatarSync) and a change shows at once.
 *  - usePeopleAvatars: photos of the people you have consultations with (Messages, cards).
 * Both re-read GET /api/account/avatars when someone's photo changes (live "profile" signal).
 */
import { useEffect, useSyncExternalStore } from 'react';
import { useLiveRefresh } from '@/components/live/LiveProvider';

let me: string | null | undefined;
let photos: Record<string, string> = {};
const known = new Set<string>();
const inflight = new Set<string>();
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Updates the signed-in user's photo everywhere on the page (after an upload or removal). */
export function setMyAvatar(url: string | null) {
  me = url;
  notify();
}

async function load(ids: string[]) {
  const fresh = ids.filter((id) => !inflight.has(id));
  fresh.forEach((id) => inflight.add(id));
  try {
    const query = fresh.length ? `?ids=${encodeURIComponent(fresh.join(','))}` : '';
    const res = await fetch(`/api/account/avatars${query}`, { cache: 'no-store', credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (!res.ok) return;
    const body = (await res.json().catch(() => null)) as { data?: { me: string | null; photos: Record<string, string> } } | null;
    if (!body?.data) return;
    me = body.data.me;
    const next = { ...photos };
    for (const id of fresh) {
      known.add(id);
      if (body.data.photos[id]) next[id] = body.data.photos[id];
      else delete next[id];
    }
    photos = next;
    notify();
  } catch {
    // Keep what is shown; the next change signal retries.
  } finally {
    fresh.forEach((id) => inflight.delete(id));
  }
}

/** Seeds the signed-in user's photo from the server and keeps it live. Call once in each portal shell. */
export function useMyAvatarSync(initial: string | null | undefined) {
  useEffect(() => {
    if (me === undefined) {
      me = initial ?? null;
      notify();
    }
  }, [initial]);
  useLiveRefresh(['profile'], () => load([]));
}

/** The signed-in user's photo URL, or null (show the usual icon / initials). */
export function useMyAvatar(initial?: string | null): string | null {
  const value = useSyncExternalStore(subscribe, () => me, () => undefined);
  return value === undefined ? (initial ?? null) : value;
}

/** Photos of these people (user ids), keyed by id; people without one are missing. */
export function usePeopleAvatars(ids: Array<string | null | undefined>): Record<string, string> {
  const key = [...new Set(ids.filter((id): id is string => !!id))].sort().join(',');
  const snapshot = useSyncExternalStore(subscribe, () => photos, () => photos);
  useEffect(() => {
    const missing = key ? key.split(',').filter((id) => !known.has(id)) : [];
    if (missing.length) void load(missing);
  }, [key]);
  useLiveRefresh(['profile'], () => {
    if (key) void load(key.split(','));
  });
  return snapshot;
}
