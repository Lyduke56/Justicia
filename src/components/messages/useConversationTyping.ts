'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { getConversationChannelAction } from '@/app/actions/messageFeatureActions';

/** Topics never change for a conversation, so ask the server once per thread. */
const topicCache = new Map<string, { topic: string; hideTyping: boolean }>();

const SEND_EVERY_MS = 2500;
const IDLE_STOP_MS = 4000;
/** If the other side's "stopped" signal is lost, hide the indicator after this long. */
const REMOTE_EXPIRE_MS = 6000;

/**
 * "Typing…" for the open conversation, over a Supabase Realtime broadcast topic that only the
 * two participants can compute (issued by the server). Nothing is stored.
 */
export function useConversationTyping(threadId: string | null) {
  const [typingThread, setTypingThread] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  /** The user hides their typing status, so they neither send nor see it. */
  const hiddenRef = useRef(false);
  const lastSentRef = useRef(0);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!threadId) return;
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    const join = ({ topic, hideTyping }: { topic: string; hideTyping: boolean }) => {
      if (cancelled) return;
      hiddenRef.current = hideTyping;
      if (hideTyping) return;
      channel = supabase
        .channel(topic, { config: { broadcast: { self: false } } })
        .on('broadcast', { event: 'typing' }, ({ payload }) => {
          if (expireTimerRef.current) clearTimeout(expireTimerRef.current);
          if (payload?.typing) {
            setTypingThread(threadId);
            expireTimerRef.current = setTimeout(
              () => setTypingThread((t) => (t === threadId ? null : t)),
              REMOTE_EXPIRE_MS
            );
          } else {
            setTypingThread((t) => (t === threadId ? null : t));
          }
        })
        .subscribe();
      channelRef.current = channel;
    };

    const cached = topicCache.get(threadId);
    if (cached) join(cached);
    else {
      getConversationChannelAction(threadId)
        .then((res) => {
          if ('topic' in res) {
            const entry = { topic: res.topic, hideTyping: res.hideTyping };
            topicCache.set(threadId, entry);
            join(entry);
          }
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      if (expireTimerRef.current) clearTimeout(expireTimerRef.current);
      lastSentRef.current = 0;
      channelRef.current = null;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [threadId]);

  const send = (typing: boolean) => {
    if (hiddenRef.current) return;
    void channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { typing } });
  };

  /** Call on every keystroke; signals are throttled and stop after a few idle seconds. */
  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastSentRef.current > SEND_EVERY_MS) {
      lastSentRef.current = now;
      send(true);
    }
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = setTimeout(() => {
      lastSentRef.current = 0;
      send(false);
    }, IDLE_STOP_MS);
  }, []);

  /** Call when the message is sent or the text is cleared. */
  const stopTyping = useCallback(() => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (lastSentRef.current) {
      lastSentRef.current = 0;
      send(false);
    }
  }, []);

  /** Hide the indicator right away (e.g. their message just arrived). */
  const clearRemoteTyping = useCallback(() => setTypingThread(null), []);

  return { otherTyping: !!threadId && typingThread === threadId, notifyTyping, stopTyping, clearRemoteTyping };
}
