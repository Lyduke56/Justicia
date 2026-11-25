'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo, useSyncExternalStore } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AnimatePresence, motion, MotionConfig, type Variants } from 'motion/react';
import { MessagesIcon, ScaleIcon } from '@/components/client/ClientIcons';
import { sendDirectMessageAction, type ThreadContext } from '@/app/actions/consultationActions';
import {
  markThreadSeenAction,
  sendMessageWithExtrasAction,
  togglePinMessageAction,
  uploadMessageAttachmentAction,
} from '@/app/actions/messageFeatureActions';
import { fetchLive } from '@/lib/live/fetchLive';
import { useLiveRefresh, useViewActive } from '@/components/live/LiveProvider';
import { addLawyerReviewAction } from '@/app/actions/reviewActions';
import { ReportAccountModal } from '@/components/shared/ReportAccountModal';
import { ConsultationRatingDialog } from '@/components/client/ConsultationRatingDialog';
import {
  NeuButton,
  NeuAlert,
  EmptyState,
  EXTRUDE,
  ArrowDownIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  FileIcon,
  PhoneIcon,
  SearchIcon,
  SendIcon,
  Spinner,
  StarIcon,
  TrashIcon,
  VideoIcon,
} from '@/components/shared/neu';
import { EASE_OUT } from '@/components/shared/neu/motion';
import {
  ACCEPT_DOCUMENTS,
  ACCEPT_MEDIA,
  ALLOWED_ATTACHMENT_EXTENSIONS,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_ATTACHMENT_BYTES,
  attachmentKind,
  autoCaptionFor,
  fileExt,
  formatDuration,
  type MessageAttachment,
  type MessageExtras,
} from '@/lib/messaging/types';
import { MessageAttachments, PendingAttachmentChip, type PendingAttachment } from '@/components/messages/MessageAttachments';
import {
  CheckIcon,
  DoubleCheckIcon,
  ImageIcon,
  MicIcon,
  PinIcon,
  PlusIcon,
  ReplyIcon,
  StopIcon,
} from '@/components/messages/MessageIcons';
import { isVoiceRecordingSupported, useVoiceRecorder } from '@/components/messages/useVoiceRecorder';
import { useConversationTyping } from '@/components/messages/useConversationTyping';
import { ConversationMenu } from '@/components/messages/ConversationMenu';
import { ReplyComposerCard, ReplyQuote, RepliedLabel, type QuoteInfo } from '@/components/messages/ReplyParts';

interface MessageItem {
  id: string;
  sender: 'me' | 'them' | 'system';
  content: string;
  time: string;
}

interface ThreadItem {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  consultationIds?: string[];
}

type ExtrasMap = Record<string, MessageExtras>;

const RATE_DISMISS_KEY = 'justicia_rate_prompt_dismissed';
/** Signed attachment links last an hour; reuse one for 45 minutes so images don't reload on every refresh. */
const URL_REUSE_MS = 45 * 60 * 1000;
const MANILA = 'Asia/Manila';

function readDismissed(): string[] {
  try {
    const raw = localStorage.getItem(RATE_DISMISS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function minutesUntil(iso: string, now: number): number {
  return Math.round((new Date(iso).getTime() - now) / 60000);
}

/** "Seen 2:05 PM", or "Seen Nov 21, 2:05 PM" when it wasn't today (Manila time, like message times). */
function formatSeen(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', timeZone: MANILA });
  const day = (x: Date) => x.toLocaleDateString('en-CA', { timeZone: MANILA });
  if (day(d) === day(new Date())) return time;
  return `${d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: MANILA })}, ${time}`;
}

/** "Atty. Maria L. Santos" → "MS" (honorifics and middle initials ending in "." are skipped). */
function initialsOf(name?: string | null): string {
  const words = (name || '')
    .split(/\s+/)
    .filter((w) => w && !w.endsWith('.') && /^\p{L}/u.test(w));
  if (words.length === 0) return (name || '?').trim().charAt(0).toUpperCase() || '?';
  const first = words[0].charAt(0);
  const last = words.length > 1 ? words[words.length - 1].charAt(0) : '';
  return (first + last).toUpperCase();
}

/** Keeps a still-valid attachment link (or your own local preview) instead of the freshly signed one. */
function applyUrlCache(cache: Map<string, { url: string; at: number }>, map: ExtrasMap): ExtrasMap {
  const now = Date.now();
  const out: ExtrasMap = {};
  for (const [id, ex] of Object.entries(map)) {
    out[id] = {
      ...ex,
      attachments: ex.attachments?.map((a) => {
        const cached = cache.get(a.id);
        if (cached && (cached.url.startsWith('blob:') || now - cached.at < URL_REUSE_MS)) return { ...a, url: cached.url };
        if (a.url) cache.set(a.id, { url: a.url, at: now });
        return a;
      }),
    };
  }
  return out;
}

// ─── Browser state as external stores (no setState-in-effect) ────────────────
const LG_QUERY = '(min-width: 1024px)';
const subscribeLg = (cb: () => void) => {
  const m = window.matchMedia(LG_QUERY);
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
};
const getLg = () => window.matchMedia(LG_QUERY).matches;
const subscribeVisibility = (cb: () => void) => {
  document.addEventListener('visibilitychange', cb);
  return () => document.removeEventListener('visibilitychange', cb);
};
const getVisible = () => document.visibilityState === 'visible';
const COARSE_QUERY = '(pointer: coarse)';
const subscribeCoarse = (cb: () => void) => {
  const m = window.matchMedia(COARSE_QUERY);
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
};
const getCoarse = () => window.matchMedia(COARSE_QUERY).matches;

/** Closes a popover on outside pointer-down or Escape. */
function useDismiss(open: boolean, ref: React.RefObject<HTMLElement | null>, setOpen: (open: boolean) => void) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, ref, setOpen]);
}

/** Profile photo when one loads, otherwise the person's initials. */
function Avatar({
  name,
  photo,
  className = '',
  surface = 'neu-raised-sm text-[#C58B3C]',
}: {
  name?: string | null;
  photo?: string | null;
  className?: string;
  /** Background / shadow / text colour classes for the initials fallback. */
  surface?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const showPhoto = !!photo && failed !== photo;
  return (
    <span
      aria-hidden="true"
      className={`relative overflow-hidden rounded-full flex items-center justify-center font-lora font-bold shrink-0 select-none ${surface} ${className}`}
    >
      {showPhoto ? (
        <Image src={photo} alt="" fill unoptimized sizes="56px" className="object-cover" onError={() => setFailed(photo)} />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}

function AttachMenuItem({
  icon,
  title,
  hint,
  index,
  onSelect,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  index: number;
  onSelect: () => void;
}) {
  return (
    <motion.button
      type="button"
      role="menuitem"
      variants={MENU_ITEM}
      custom={index}
      initial="hidden"
      animate="show"
      whileHover="hover"
      whileTap={{ scale: 0.97 }}
      onClick={onSelect}
      className="w-full flex items-center gap-3 rounded-[14px] px-2.5 py-2.5 text-left hover:bg-[#DECEB8]/55 focus:outline-none focus-visible:bg-[#DECEB8]/55 transition-colors cursor-pointer"
    >
      <span className="neu-raised-sm size-9 shrink-0 rounded-[11px] flex items-center justify-center text-[#C58B3C]">
        <motion.span variants={GLYPH_HOP} className="flex">
          {icon}
        </motion.span>
      </span>
      <span className="min-w-0">
        <span className="block font-inter text-[13px] font-semibold text-[#341512]">{title}</span>
        <span className="block font-inter text-[11px] text-[#7D6855] mt-0.5">{hint}</span>
      </span>
    </motion.button>
  );
}

/** Three bouncing dots. */
function TypingDots({ className = 'bg-[#A8742E]' }: { className?: string }) {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className={`size-1.5 rounded-full ${className}`}
          animate={{ y: [0, -3.5, 0], opacity: [0.45, 1, 0.45] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
        />
      ))}
    </span>
  );
}

// ─── Motion ──────────────────────────────────────────────────────────────────
/** The two panels rise out of the page one after the other (same as Consultations). */
const PAGE_STAGGER: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.04 } },
};
const LIST_STAGGER: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.2 } },
};
const LIST_ITEM: Variants = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0, transition: { duration: 0.28, ease: EASE_OUT } },
};
const MENU_POP: Variants = {
  hidden: { opacity: 0, scale: 0.9, y: -8 },
  show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 480, damping: 32 } },
  exit: { opacity: 0, scale: 0.95, y: -4, transition: { duration: 0.14 } },
};
const MENU_POP_UP: Variants = {
  hidden: { opacity: 0, scale: 0.9, y: 8, filter: 'blur(5px)' },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { type: 'spring', stiffness: 480, damping: 32, staggerChildren: 0.045, delayChildren: 0.04 },
  },
  exit: { opacity: 0, scale: 0.95, y: 4, filter: 'blur(4px)', transition: { duration: 0.14 } },
};
/**
 * Menu items use whileHover="hover" (so their glyph can react), which means they don't inherit
 * the menu's labels; each one runs its own entrance and takes its place in the cascade by index.
 */
const MENU_ITEM: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: (index: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 520, damping: 32, delay: 0.06 + index * 0.05 },
  }),
};
const GLYPH_HOP: Variants = { hover: { y: -2, scale: 1.12, transition: { type: 'spring', stiffness: 500, damping: 14 } } };

// ─── Entrance choreography for the conversation card ─────────────────────────
// The card extrudes like every other screen, then its parts arrive in order: the name banner
// drops in, the message well presses down into the card, the bubbles rise up from the composer
// (newest first), and the composer slides up last.
const EXTRUDE_SHOW = EXTRUDE.show as Record<string, unknown> & { transition?: Record<string, unknown> };
const CHAT_PANEL: Variants = {
  hidden: EXTRUDE.hidden,
  show: { ...EXTRUDE_SHOW, transition: { ...(EXTRUDE_SHOW.transition ?? {}), staggerChildren: 0.08, delayChildren: 0.2 } },
};
const PART_DOWN: Variants = {
  hidden: { opacity: 0, y: -14, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 320, damping: 26 } },
};
const PART_UP: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 26 } },
};
const RECESSED_SHADOW =
  '-1px -1px 2px 0px rgba(206, 194, 183, 0.5), 1px 1px 2px 0px rgba(252, 238, 223, 0.3), inset 5px 5px 13px 0px rgba(206, 194, 183, 0.9), inset -5px -5px 10px 0px rgba(252, 238, 223, 0.9), inset 5px -5px 10px 0px rgba(206, 194, 183, 0.2), inset -5px 5px 10px 0px rgba(206, 194, 183, 0.2)';
const RECESSED_FLAT =
  '0px 0px 0px 0px rgba(206, 194, 183, 0), 0px 0px 0px 0px rgba(252, 238, 223, 0), inset 0px 0px 0px 0px rgba(206, 194, 183, 0), inset 0px 0px 0px 0px rgba(252, 238, 223, 0), inset 0px 0px 0px 0px rgba(206, 194, 183, 0), inset 0px 0px 0px 0px rgba(206, 194, 183, 0)';
const WELL_PRESS: Variants = {
  hidden: { opacity: 0.5, scale: 1.012, boxShadow: RECESSED_FLAT },
  show: { opacity: 1, scale: 1, boxShadow: RECESSED_SHADOW, transition: { duration: 0.75, ease: EASE_OUT } },
};
/** Waits for the well to press in; bubbles mounted later (new messages) aren't delayed. */
const STREAM: Variants = {
  hidden: {},
  show: { transition: { delayChildren: 0.22 } },
};
type BubbleCustom = { rank: number; side: 'me' | 'them' | 'center' };
/** Only the newest ~14 messages animate (they're the ones on screen); older ones are simply there. */
const ANIMATED_BUBBLES = 14;
const BUBBLE_IN: Variants = {
  hidden: ({ rank, side }: BubbleCustom) =>
    rank >= ANIMATED_BUBBLES
      ? { opacity: 1, x: 0, y: 0, scale: 1 }
      : { opacity: 0, x: side === 'me' ? 28 : side === 'them' ? -28 : 0, y: 12, scale: 0.92 },
  show: ({ rank }: BubbleCustom) => ({
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 360, damping: 27, delay: rank < ANIMATED_BUBBLES ? rank * 0.045 : 0 },
  }),
};

export function MessagesView({ role = 'client' }: { role?: 'client' | 'lawyer' } = {}) {
  const isLawyer = role === 'lawyer';
  const router = useRouter();
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [threadsLoaded, setThreadsLoaded] = useState<boolean>(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [messages, setMessages] = useState<Record<string, MessageItem[]>>({});
  const [extras, setExtras] = useState<Record<string, ExtrasMap>>({});
  const [sending, setSending] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const urlCacheRef = useRef(new Map<string, { url: string; at: number }>());
  const viewActive = useViewActive();
  const isDesktop = useSyncExternalStore(subscribeLg, getLg, () => true);
  const docVisible = useSyncExternalStore(subscribeVisibility, getVisible, () => true);

  // Deep link from "Message Client" / "Message Channel": /…/messages?thread=<consultationId>.
  // Read reactively: this tab may already be mounted (kept alive) when the link is followed.
  const requestedThread = useSearchParams().get('thread');
  const requestedThreadRef = useRef<string | null>(requestedThread);
  useEffect(() => {
    requestedThreadRef.current = requestedThread;
  }, [requestedThread]);
  const findRequested = (list: ThreadItem[], requested: string | null) =>
    requested ? list.find((t) => t.id === requested || t.consultationIds?.includes(requested)) : undefined;

  // Below lg only one pane fits: the conversation list, or the open conversation.
  const [mobilePane, setMobilePane] = useState<'list' | 'chat'>(requestedThread ? 'chat' : 'list');

  const loadThreads = useCallback(
    () =>
      fetchLive('threads')
        .then((dbThreads) => {
          const list = Array.isArray(dbThreads) ? dbThreads : [];
          setThreads(list);
          setActiveThreadId((current) => {
            if (current && list.some((t) => t.id === current)) return current;
            // Deep links may carry a consultation id; conversations are per client ⇄ lawyer pair.
            return findRequested(list, requestedThreadRef.current)?.id ?? list[0]?.id ?? null;
          });
        })
        .catch(() => {
          // Keep the current list; the next live refresh retries.
        })
        .finally(() => setThreadsLoaded(true)),
    []
  );

  useEffect(() => {
    loadThreads();
  }, [loadThreads, role]);

  // Following a new ?thread= link switches to that conversation (once per link,
  // as soon as the matching thread is loaded). Adjusting state during render is
  // React's recommended pattern for reacting to a changed input.
  const [handledThreadLink, setHandledThreadLink] = useState<string | null>(null);
  if (requestedThread && requestedThread !== handledThreadLink) {
    const match = findRequested(threads, requestedThread);
    if (match) {
      setHandledThreadLink(requestedThread);
      setMobilePane('chat');
      if (match.id !== activeThreadId) setActiveThreadId(match.id);
    }
  }

  const activeThreadRef = useRef<string | null>(activeThreadId);
  useEffect(() => {
    activeThreadRef.current = activeThreadId;
  }, [activeThreadId]);
  const loadMessages = useCallback((threadId: string | null = activeThreadRef.current) => {
    if (!threadId) return;
    return fetchLive('thread-messages', { threadId })
      .then((loadedMsgs) => {
        const server = Array.isArray(loadedMsgs) ? loadedMsgs : [];
        setMessages((prev) => {
          // Keep optimistic messages that are still being sent.
          const sending = (prev[threadId] || []).filter((m) => m.id.startsWith('m-'));
          return { ...prev, [threadId]: [...server, ...sending] };
        });
      })
      .catch(() => {});
  }, []);

  /** Replies, pins, "Seen" and attachments for a conversation (stored alongside the messages). */
  const loadExtras = useCallback((threadId: string | null = activeThreadRef.current) => {
    if (!threadId) return;
    return fetch(`/api/messages/extras?threadId=${encodeURIComponent(threadId)}`, {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { data?: { messages?: ExtrasMap } } | null) => {
        const map = body?.data?.messages;
        if (!map || typeof map !== 'object') return;
        setExtras((prev) => {
          const optimistic = Object.fromEntries(Object.entries(prev[threadId] ?? {}).filter(([id]) => id.startsWith('m-')));
          return { ...prev, [threadId]: { ...applyUrlCache(urlCacheRef.current, map), ...optimistic } };
        });
      })
      .catch(() => {});
  }, []);

  const patchExtras = useCallback((threadId: string, messageId: string, patch: Partial<MessageExtras>) => {
    setExtras((prev) => ({
      ...prev,
      [threadId]: { ...(prev[threadId] ?? {}), [messageId]: { ...(prev[threadId]?.[messageId] ?? {}), ...patch } },
    }));
  }, []);

  useEffect(() => {
    loadMessages(activeThreadId);
    loadExtras(activeThreadId);
  }, [activeThreadId, loadMessages, loadExtras]);

  // Replies, new conversations and system messages arrive live (Supabase Realtime).
  // Without a live connection, poll — only while this tab is on screen.
  useLiveRefresh(['messages', 'consultations'], loadThreads, { fallbackMs: 15000 });
  useLiveRefresh(
    ['messages'],
    () => {
      loadMessages();
      loadExtras();
    },
    { fallbackMs: 5000 }
  );

  const activeMessages = useMemo(
    () => (activeThreadId && messages[activeThreadId]) || [],
    [activeThreadId, messages]
  );
  const activeExtras: ExtrasMap = useMemo(
    () => (activeThreadId && extras[activeThreadId]) || {},
    [activeThreadId, extras]
  );
  const messageById = useMemo(() => new Map(activeMessages.map((m) => [m.id, m])), [activeMessages]);

  const activeThread = threads.find((t) => t.id === activeThreadId) || threads[0];

  // ─── Typing indicator ───
  const { otherTyping, notifyTyping, stopTyping, clearRemoteTyping } = useConversationTyping(activeThreadId);
  const lastTheirs = useMemo(() => {
    for (let i = activeMessages.length - 1; i >= 0; i--) if (activeMessages[i].sender === 'them') return activeMessages[i];
    return undefined;
  }, [activeMessages]);
  // Their message arriving ends "typing…" right away.
  const [prevLastTheirsId, setPrevLastTheirsId] = useState<string | undefined>(undefined);
  if (lastTheirs?.id !== prevLastTheirsId) {
    setPrevLastTheirsId(lastTheirs?.id);
    if (prevLastTheirsId !== undefined && otherTyping) clearRemoteTyping();
  }

  // ─── Keep the newest message in view ───
  // Jump when switching conversations or returning to the tab; glide for new messages, but
  // don't pull you down if you've scrolled up to read (unless you just sent something).
  const lastScrolledThread = useRef<string | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !viewActive) return;
    const switched = lastScrolledThread.current !== activeThreadId;
    lastScrolledThread.current = activeThreadId;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 240;
    const last = activeMessages[activeMessages.length - 1];
    if (!switched && !nearBottom && last?.sender !== 'me') return;
    el.scrollTo({ top: el.scrollHeight, behavior: switched ? 'auto' : 'smooth' });
  }, [activeMessages, activeThreadId, viewActive, mobilePane, otherTyping]);

  // ─── "Seen": mark their newest message as seen while the conversation is on screen ───
  const chatOnScreen = viewActive && docVisible && (isDesktop || mobilePane === 'chat');
  const lastTheirsSeen = !!(lastTheirs && activeExtras[lastTheirs.id]?.seenAt);
  const seenRequestedRef = useRef(new Set<string>());
  useEffect(() => {
    if (!chatOnScreen || !activeThreadId || !lastTheirs || lastTheirsSeen) return;
    if (seenRequestedRef.current.has(lastTheirs.id)) return;
    const requestedFor = lastTheirs.id;
    seenRequestedRef.current.add(requestedFor);
    const threadId = activeThreadId;
    markThreadSeenAction(threadId)
      .then((res) => {
        if ('messageId' in res && res.messageId && res.seenAt) patchExtras(threadId, res.messageId, { seenAt: res.seenAt });
        // With read receipts hidden nothing is recorded; don't ask again for this message.
        else if (!('hidden' in res && res.hidden)) seenRequestedRef.current.delete(requestedFor);
      })
      .catch(() => seenRequestedRef.current.delete(requestedFor));
  }, [chatOnScreen, activeThreadId, lastTheirs, lastTheirsSeen, patchExtras]);

  // Receipt under your latest message, shown while it's the newest thing in the conversation.
  const receipt = useMemo(() => {
    let lastMine = -1;
    let lastTheirsIdx = -1;
    activeMessages.forEach((m, i) => {
      if (m.sender === 'me') lastMine = i;
      else if (m.sender === 'them') lastTheirsIdx = i;
    });
    if (lastMine === -1 || lastMine < lastTheirsIdx) return null;
    const msg = activeMessages[lastMine];
    if (msg.id.startsWith('m-')) return null;
    const seenAt = activeExtras[msg.id]?.seenAt;
    return { messageId: msg.id, seenAt: seenAt ?? null };
  }, [activeMessages, activeExtras]);

  // ─── Profile photos of the people you're talking to (thread id = their user id) ───
  // Read straight from Supabase like Find a Lawyer does; anyone without a readable photo shows initials.
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const threadIdsKey = threads
    .map((t) => t.id)
    .sort()
    .join(',');
  useEffect(() => {
    if (!threadIdsKey) return;
    const ids = threadIdsKey.split(',');
    const supabase = createClient();
    let cancelled = false;
    const apply = (rows: Array<{ user_id: string; url: string | null }>) => {
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const r of rows) if (r.user_id && r.url) next[r.user_id] = r.url;
      setPhotos(next);
    };
    if (isLawyer) {
      supabase
        .from('profiles')
        .select('user_id, avatar_url')
        .in('user_id', ids)
        // avatar_url exists in the live schema but not in the generated types.
        .then(({ data }) =>
          apply(
            ((data ?? []) as unknown as Array<{ user_id: string; avatar_url: string | null }>).map((r) => ({
              user_id: r.user_id,
              url: r.avatar_url,
            }))
          )
        );
    } else {
      supabase
        .from('lawyer_profiles')
        .select('user_id, photo_url')
        .in('user_id', ids)
        .then(({ data }) => apply((data ?? []).map((r) => ({ user_id: r.user_id, url: r.photo_url }))));
    }
    return () => {
      cancelled = true;
    };
  }, [threadIdsKey, isLawyer]);
  const activePhoto = activeThread ? photos[activeThread.id] : undefined;

  const query = search.trim().toLowerCase();
  const visibleThreads = query
    ? threads.filter((t) => t.name.toLowerCase().includes(query) || t.lastMessage.toLowerCase().includes(query))
    : threads;

  const counterpartName = activeThread?.name || (isLawyer ? 'Client' : 'Attorney');
  const authorOf = (m: MessageItem) => (m.sender === 'me' ? 'You' : m.sender === 'system' ? 'Justicia' : counterpartName);

  /** What a reply shows of the message it quotes. */
  const quoteOf = (m: MessageItem | undefined): QuoteInfo | null => {
    if (!m) return null;
    const atts = activeExtras[m.id]?.attachments ?? [];
    const image = atts.find((a) => a.kind === 'image');
    const other = atts.find((a) => a.kind !== 'image');
    return { author: authorOf(m), text: m.content, thumbUrl: image?.url ?? null, kind: other?.kind ?? null };
  };
  const repliedLabelFor = (reply: MessageItem, original: MessageItem | undefined) => {
    const who = reply.sender === 'me' ? 'You' : counterpartName;
    if (!original) return `${who} replied to a message`;
    if (original.sender === 'system') return `${who} replied to a Justicia update`;
    if (original.sender === reply.sender) return reply.sender === 'me' ? 'You replied to yourself' : `${who} replied to their message`;
    return reply.sender === 'me' ? `You replied to ${counterpartName}` : `${who} replied to you`;
  };

  // ─── Popovers & dialogs ───
  const [optionsOpen, setOptionsOpen] = useState(false);
  // The target is kept after closing so the dialog can play its exit animation.
  const [reportTarget, setReportTarget] = useState<{ threadId: string; name: string } | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  // ─── Small interaction state ───
  /** "Latest" button when you've scrolled up to read. */
  const [showJump, setShowJump] = useState(false);
  /** Bumps on every send so the paper plane takes off. */
  const [sendTick, setSendTick] = useState(0);
  /** Messages that replaced an optimistic bubble: shown in place, without a second entrance. */
  const [instantIds, setInstantIds] = useState<Set<string>>(() => new Set());
  /** Swipe-to-reply on touch screens. */
  const isCoarse = useSyncExternalStore(subscribeCoarse, getCoarse, () => false);
  const lastDragEndRef = useRef(0);

  const onStreamScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const far = el.scrollHeight - el.scrollTop - el.clientHeight > 320;
    if (far !== showJump) setShowJump(far);
  };
  const scrollToLatest = () => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  };

  const [pinsOpen, setPinsOpen] = useState(false);
  const pinsRef = useRef<HTMLDivElement>(null);
  useDismiss(pinsOpen, pinsRef, setPinsOpen);

  const [attachOpen, setAttachOpen] = useState(false);
  const attachRef = useRef<HTMLDivElement>(null);
  useDismiss(attachOpen, attachRef, setAttachOpen);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  // ─── Message actions: reply, pin, jump ───
  /** On touch screens a tap on a bubble reveals its Reply / Pin buttons. */
  const [actionMsgId, setActionMsgId] = useState<string | null>(null);
  const [replyState, setReplyState] = useState<{ threadId: string; message: MessageItem } | null>(null);
  const replyTo = replyState && replyState.threadId === activeThreadId ? replyState.message : null;
  const [pinBusy, setPinBusy] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightId) return;
    const t = setTimeout(() => setHighlightId(null), 1800);
    return () => clearTimeout(t);
  }, [highlightId]);

  const jumpTo = (messageId: string) => {
    const container = scrollRef.current;
    const el = container?.querySelector<HTMLElement>(`[data-msg-id="${messageId}"]`);
    if (!container || !el) return;
    const top =
      el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - container.clientHeight / 2 + el.offsetHeight / 2;
    container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    setHighlightId(messageId);
  };

  const startReply = (m: MessageItem) => {
    if (!activeThreadId) return;
    setReplyState({ threadId: activeThreadId, message: m });
    setActionMsgId(null);
    inputRef.current?.focus();
  };

  const togglePin = async (m: MessageItem) => {
    if (!activeThreadId || pinBusy) return;
    const threadId = activeThreadId;
    const before = activeExtras[m.id]?.pinned ?? null;
    setPinBusy(m.id);
    setActionMsgId(null);
    patchExtras(threadId, m.id, { pinned: before ? null : { byMe: true, at: new Date().toISOString() } });
    try {
      const res = await togglePinMessageAction(threadId, m.id);
      if ('success' in res && res.success) patchExtras(threadId, m.id, { pinned: res.pinned });
      else {
        patchExtras(threadId, m.id, { pinned: before });
        setChatError(('error' in res && res.error) || 'We could not update the pin.');
      }
    } catch {
      patchExtras(threadId, m.id, { pinned: before });
      setChatError('We could not update the pin. Please try again.');
    } finally {
      setPinBusy(null);
    }
  };

  const pinnedMessages = activeMessages
    .filter((m) => activeExtras[m.id]?.pinned)
    .sort((a, b) => (activeExtras[b.id]!.pinned!.at > activeExtras[a.id]!.pinned!.at ? 1 : -1));
  const pinsShown = pinsOpen && pinnedMessages.length > 0;

  // ─── Attachments waiting to be sent (kept per conversation, like a draft) ───
  const [pendingByThread, setPendingByThread] = useState<Record<string, PendingAttachment[]>>({});
  const pending = (activeThreadId && pendingByThread[activeThreadId]) || [];
  const updatePending = useCallback((threadId: string, update: (list: PendingAttachment[]) => PendingAttachment[]) => {
    setPendingByThread((prev) => ({ ...prev, [threadId]: update(prev[threadId] ?? []) }));
  }, []);

  const queueFiles = (files: File[], durationSec?: number) => {
    const threadId = activeThreadId;
    if (!threadId || files.length === 0) return;
    const room = MAX_ATTACHMENTS_PER_MESSAGE - pending.length;
    if (files.length > room) setChatError(`You can attach up to ${MAX_ATTACHMENTS_PER_MESSAGE} files per message.`);
    for (const file of files.slice(0, Math.max(0, room))) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setChatError(`"${file.name}" is larger than 8 MB.`);
        continue;
      }
      if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(fileExt(file.name))) {
        setChatError(`"${file.name}" isn't a supported file type.`);
        continue;
      }
      const kind = attachmentKind(file.type, file.name);
      const localId = `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const previewUrl = kind === 'file' ? undefined : URL.createObjectURL(file);
      updatePending(threadId, (list) => [
        ...list,
        { localId, name: file.name, size: file.size, kind, previewUrl, durationSec: durationSec ?? null, status: 'uploading' },
      ]);
      const fd = new FormData();
      fd.append('threadId', threadId);
      fd.append('file', file);
      if (durationSec) fd.append('durationSec', String(durationSec));
      uploadMessageAttachmentAction(fd)
        .then((res) => {
          const ok = 'attachment' in res && res.attachment;
          updatePending(threadId, (list) =>
            list.map((p) =>
              p.localId !== localId
                ? p
                : ok
                  ? { ...p, status: 'ready', attachment: res.attachment }
                  : { ...p, status: 'error', error: ('error' in res && res.error) || 'Upload failed' }
            )
          );
          if (!ok) setChatError(('error' in res && res.error) || `"${file.name}" could not be uploaded.`);
        })
        .catch(() => {
          updatePending(threadId, (list) => list.map((p) => (p.localId === localId ? { ...p, status: 'error', error: 'Upload failed' } : p)));
          setChatError(`"${file.name}" could not be uploaded.`);
        });
    }
  };

  const removePending = (localId: string) => {
    if (!activeThreadId) return;
    const item = pending.find((p) => p.localId === localId);
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    updatePending(activeThreadId, (list) => list.filter((p) => p.localId !== localId));
  };

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    setAttachOpen(false);
    queueFiles(files);
  };

  const recorder = useVoiceRecorder((file, seconds) => queueFiles([file], seconds));
  const startVoice = async () => {
    setAttachOpen(false);
    setChatError(null);
    const error = await recorder.start();
    if (error) setChatError(error);
  };

  // ─── Conversation banners: meeting announcement & rate prompt ───
  const [context, setContext] = useState<{ threadId: string; data: ThreadContext } | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const [dismissedRatings, setDismissedRatings] = useState<string[]>(() =>
    typeof window === 'undefined' ? [] : readDismissed()
  );
  const [ratingOpen, setRatingOpen] = useState<boolean>(false);
  const [ratingStars, setRatingStars] = useState<number>(0);
  const [ratingComment, setRatingComment] = useState<string>('');
  const [ratingBusy, setRatingBusy] = useState<boolean>(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [ratingThanks, setRatingThanks] = useState<boolean>(false);

  const loadContext = useCallback((threadId: string | null = activeThreadRef.current) => {
    if (!threadId) return;
    return fetchLive('thread-context', { threadId })
      .then((data) => setContext({ threadId, data }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadContext(activeThreadId);
  }, [activeThreadId, loadContext]);

  // Meeting banner / rate prompt follow consultation changes live; the slow
  // tick catches time-based changes (a meeting starting) while on screen.
  useLiveRefresh(['consultations', 'reviews', 'messages'], () => loadContext());
  useEffect(() => {
    if (!viewActive) return;
    const timer = setInterval(() => loadContext(), 60000);
    return () => clearInterval(timer);
  }, [viewActive, loadContext]);

  // Tick so the "starts in N minutes" countdown stays current (only while on screen).
  useEffect(() => {
    if (!viewActive) return;
    const catchUp = setTimeout(() => setNow(Date.now()), 0); // fresh countdown when shown again
    const timer = setInterval(() => setNow(Date.now()), 20000);
    return () => {
      clearTimeout(catchUp);
      clearInterval(timer);
    };
  }, [viewActive]);

  const threadContext = context && context.threadId === activeThreadId ? context.data : null;
  const meeting =
    threadContext?.meeting && now < new Date(threadContext.meeting.endsAt).getTime() ? threadContext.meeting : null;
  const meetingMinutes = meeting ? minutesUntil(meeting.startsAt, now) : 0;
  const ratePrompt =
    role === 'client' && threadContext?.ratePrompt && !dismissedRatings.includes(threadContext.ratePrompt.consultationId)
      ? threadContext.ratePrompt
      : null;

  const selectThread = (id: string) => {
    if (id !== activeThreadId) {
      stopTyping();
      if (recorder.recording) recorder.cancel();
    }
    setActiveThreadId(id);
    setMobilePane('chat');
    setChatError(null);
    setOptionsOpen(false);
    setPinsOpen(false);
    setAttachOpen(false);
    setActionMsgId(null);
    setShowJump(false);
    setRatingOpen(false);
    setRatingStars(0);
    setRatingComment('');
    setRatingError(null);
    setRatingThanks(false);
  };

  const dismissRating = (consultationId: string) => {
    const next = Array.from(new Set([...dismissedRatings, consultationId]));
    setDismissedRatings(next);
    setRatingOpen(false);
    try {
      localStorage.setItem(RATE_DISMISS_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable — dismissal lasts for this visit only
    }
  };

  const submitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ratePrompt || ratingBusy) return;
    if (ratingStars < 1) return setRatingError('Please choose a star rating.');
    if (!ratingComment.trim()) return setRatingError('Please share a few words about your consultation.');
    setRatingBusy(true);
    setRatingError(null);
    try {
      const res = await addLawyerReviewAction({
        consultationId: ratePrompt.consultationId,
        rating: ratingStars,
        comment: ratingComment.trim(),
      });
      if (!res.success) return setRatingError(res.error || 'Your rating could not be saved.');
      setRatingThanks(true);
      setRatingOpen(false);
      setRatingStars(0);
      setRatingComment('');
      // Hide the prompt for this consultation and refresh banners (a newer unrated one may surface).
      setContext((prev) => (prev ? { ...prev, data: { ...prev.data, ratePrompt: null } } : prev));
      if (activeThreadId) loadContext(activeThreadId);
    } catch {
      setRatingError('Your rating could not be saved. Please try again.');
    } finally {
      setRatingBusy(false);
    }
  };

  // ─── Sending ───
  const readyAttachments = pending.filter((p) => p.status === 'ready' && p.attachment);
  const uploading = pending.some((p) => p.status === 'uploading');
  const canSend =
    !!activeThreadId && !sending && !uploading && !recorder.recording && (!!inputMessage.trim() || readyAttachments.length > 0);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend || !activeThreadId) return;

    const threadId = activeThreadId;
    const content = inputMessage.trim();
    const reply = replyTo;
    const sentPending = readyAttachments;
    const sentIds = new Set(sentPending.map((p) => p.localId));
    const attachments: MessageAttachment[] = sentPending.map((p) => ({ ...p.attachment!, url: p.previewUrl ?? null }));
    const tempId = `m-${Date.now()}`;
    const newMsg: MessageItem = {
      id: tempId,
      sender: 'me',
      content: content || autoCaptionFor(attachments),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => ({ ...prev, [threadId]: [...(prev[threadId] || []), newMsg] }));
    if (reply || attachments.length) {
      patchExtras(threadId, tempId, { replyToId: reply?.id ?? null, attachments, autoCaption: !content });
    }
    setInputMessage('');
    setReplyState(null);
    updatePending(threadId, (list) => list.filter((p) => !sentIds.has(p.localId)));
    stopTyping();
    setChatError(null);
    setSendTick((t) => t + 1);

    const rollback = (message: string) => {
      setMessages((prev) => ({ ...prev, [threadId]: (prev[threadId] || []).filter((m) => m.id !== tempId) }));
      setExtras((prev) => {
        const t = { ...(prev[threadId] ?? {}) };
        delete t[tempId];
        return { ...prev, [threadId]: t };
      });
      setInputMessage(content);
      if (reply) setReplyState({ threadId, message: reply });
      updatePending(threadId, (list) => [...sentPending, ...list]);
      setChatError(message);
    };

    setSending(true);
    try {
      // Plain text keeps using the original send action; replies / files go through the extras action
      // (which still sends via the original one, then records the reply and attachments).
      type SendResult =
        | { success: true; message: MessageItem; extras: MessageExtras | null }
        | { success?: false; error: string };
      const res: SendResult =
        !reply && sentPending.length === 0
          ? await sendDirectMessageAction(threadId, content).then(
              (r): SendResult =>
                'message' in r && r.message
                  ? { success: true, message: r.message, extras: null }
                  : { error: ('error' in r && r.error) || 'Your message could not be sent.' }
            )
          : await sendMessageWithExtrasAction(threadId, content, {
              replyToId: reply?.id ?? null,
              attachments: sentPending.map((p) => ({ id: p.attachment!.id, durationSec: p.durationSec ?? null })),
            });
      if ('message' in res && res.message) {
        const saved = res.message;
        setInstantIds((prev) => new Set(prev).add(saved.id));
        // Your own files keep showing from the local copy (no re-download).
        for (const p of sentPending) {
          if (p.previewUrl && p.attachment) urlCacheRef.current.set(p.attachment.id, { url: p.previewUrl, at: Date.now() });
        }
        setMessages((prev) => ({
          ...prev,
          [threadId]: (prev[threadId] || []).map((m) => (m.id === tempId ? saved : m)),
        }));
        setExtras((prev) => {
          const t = { ...(prev[threadId] ?? {}) };
          delete t[tempId];
          if (res.extras) t[saved.id] = applyUrlCache(urlCacheRef.current, { [saved.id]: res.extras })[saved.id];
          return { ...prev, [threadId]: t };
        });
        setThreads((prev) =>
          prev.map((t) => (t.id === threadId ? { ...t, lastMessage: `You: ${saved.content}`, time: saved.time } : t))
        );
      } else {
        rollback(('error' in res && res.error) || 'Your message could not be sent.');
      }
    } catch {
      rollback('Your message could not be sent. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const counterpartLabel = isLawyer ? 'Your Client' : 'Your Attorney';
  const meetingKind = meeting?.method === 'audio' ? 'audio call' : 'video consultation';
  const meetingUrl = meeting?.meetingUrl ?? null;

  // ─── Render pieces ─────────────────────────────────────────────────────────

  const threadList = (
    <>
      {/* Panel header */}
      <div className="flex items-center gap-4 shrink-0">
        <motion.div
          whileHover={{ rotate: -8, scale: 1.06 }}
          transition={{ type: 'spring', stiffness: 400, damping: 14 }}
          className="neu-raised-sm size-11 rounded-full flex items-center justify-center text-[#C58B3C] shrink-0"
        >
          <MessagesIcon className="w-5 h-5" />
        </motion.div>
        <div className="min-w-0 flex-1">
          <h2 className="font-lora text-lg sm:text-xl font-bold text-[#341512] leading-tight">Messages</h2>
          <p className="font-inter text-[11px] sm:text-xs text-[#7D6855] mt-1">
            {isLawyer ? 'Conversations with your clients' : 'Conversations with your attorneys'}
          </p>
        </div>
      </div>

      {/* Search */}
      {threads.length > 0 && (
        <label className="group neu-recessed shrink-0 h-11 rounded-[13px] px-4 flex items-center gap-3 transition-shadow focus-within:ring-2 focus-within:ring-[#B9833C]/40 cursor-text">
          <SearchIcon className="w-4 h-4 text-[#8C7A6A] shrink-0 transition-[color,scale] duration-300 group-focus-within:text-[#C58B3C] group-focus-within:scale-110" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isLawyer ? 'Search clients' : 'Search attorneys'}
            aria-label="Search conversations"
            className="w-full bg-transparent font-lora text-sm text-[#34150F] placeholder-[#9A8270]/70 focus:outline-none"
          />
        </label>
      )}

      {/* Section label */}
      {threads.length > 0 && (
        <div className="flex items-center gap-3 px-1 shrink-0">
          <span className="font-lora font-bold text-[10.5px] text-[#C58B3C] uppercase tracking-[0.16em]">
            Active Consultations
          </span>
          <span className="flex-1 h-px bg-[#D6C3AD]/70" />
        </div>
      )}

      {/* List — the negative margin + padding leaves room for the selected row's shadow */}
      <div className="flex-1 min-h-0 overflow-y-auto neu-scrollbar-discrete -mx-3 px-3 py-1">
        {!threadsLoaded ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading conversations">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3.5 p-3.5">
                <div className="size-11 rounded-full neu-skeleton shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-2/3 rounded neu-skeleton-text" />
                  <div className="h-2.5 w-full rounded neu-skeleton-text" />
                </div>
              </div>
            ))}
          </div>
        ) : threads.length === 0 ? (
          <EmptyState
            size="sm"
            className="h-full flex flex-col items-center justify-center"
            icon={<MessagesIcon />}
            title="No Active Consultations"
            description={
              isLawyer
                ? 'Once a client consultation is booked and confirmed, a communication channel will appear here.'
                : 'Once a consultation is booked and confirmed by an attorney, a communication channel will appear here.'
            }
          />
        ) : visibleThreads.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<SearchIcon />}
            title="No matches"
            description={`No conversation matches “${search.trim()}”.`}
          />
        ) : (
          <motion.ul variants={LIST_STAGGER} className="space-y-2">
            {visibleThreads.map((thread) => {
              const isSelected = activeThreadId === thread.id;
              const typingHere = isSelected && otherTyping;
              return (
                <motion.li key={thread.id} variants={LIST_ITEM}>
                  <motion.button
                    type="button"
                    onClick={() => selectThread(thread.id)}
                    aria-current={isSelected ? 'true' : undefined}
                    whileHover={isSelected ? undefined : { x: 3 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                    className={`group relative w-full flex items-center gap-3.5 p-3.5 rounded-[18px] text-left select-none cursor-pointer transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B9833C]/45 ${
                      isSelected ? '' : 'hover:bg-[#DECEB8]/45'
                    }`}
                  >
                    {/* The caramel selection glides from conversation to conversation. */}
                    {isSelected && (
                      <motion.span
                        layoutId="messages-thread-highlight"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                        className="absolute inset-0 rounded-[18px] neu-raised-highlight-sm"
                        aria-hidden="true"
                      />
                    )}
                    <Avatar
                      name={thread.name}
                      photo={photos[thread.id]}
                      className="size-11 text-sm transition-colors"
                      surface={isSelected ? 'neu-btn-banner text-[#341512]' : 'neu-raised-sm text-[#C58B3C] group-hover:text-[#A8742E]'}
                    />
                    <span className="relative min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="font-lora font-bold text-[13.5px] sm:text-sm text-[#341512] truncate leading-tight">
                          {thread.name}
                        </span>
                        <span
                          className={`font-inter text-[10.5px] shrink-0 font-medium ${isSelected ? 'text-[#5C4535]' : 'text-[#8C7A6B]'}`}
                        >
                          {thread.time}
                        </span>
                      </span>
                      <AnimatePresence mode="wait" initial={false}>
                        {typingHere ? (
                          <motion.span
                            key="typing"
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.18 }}
                            className="flex items-center gap-2 mt-1.5 font-inter text-xs italic font-medium text-[#8C5A1E]"
                          >
                            typing <TypingDots className="bg-[#8C5A1E]" />
                          </motion.span>
                        ) : (
                          <motion.span
                            key="last"
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.18 }}
                            className="block font-inter text-xs text-[#5C4535] mt-1.5 truncate leading-snug"
                          >
                            {thread.lastMessage}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </span>
                  </motion.button>
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </div>
    </>
  );

  const chatHeader = activeThread && (
    <motion.div
      variants={PART_DOWN}
      className="neu-raised-highlight relative z-30 shrink-0 rounded-[18px] px-3 py-2.5 sm:px-4 sm:py-3 flex items-center gap-3"
    >
      <motion.button
        type="button"
        onClick={() => setMobilePane('list')}
        aria-label="Back to conversations"
        whileHover={{ x: -2 }}
        whileTap={{ scale: 0.88 }}
        className="lg:hidden neu-btn-banner size-8 rounded-full flex items-center justify-center text-[#341512] shrink-0 cursor-pointer"
      >
        <ChevronLeftIcon className="w-4 h-4" />
      </motion.button>

      {/* Switching conversations slides the new name in. */}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={activeThread.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 10 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className="min-w-0 flex-1 flex items-center gap-3"
        >
          <Avatar
            name={activeThread.name}
            photo={activePhoto}
            className="size-10 text-sm"
            surface="border-2 border-[#341512] text-[#341512]"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2.5 min-w-0">
              <h2 className="font-lora text-[15px] sm:text-base font-bold text-[#341512] leading-tight truncate">
                {activeThread.name}
              </h2>
              <span className="hidden sm:inline shrink-0 font-lora font-bold text-[9.5px] text-[#8C5A1E] uppercase tracking-[0.14em]">
                {counterpartLabel}
              </span>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              {otherTyping ? (
                <motion.p
                  key="typing"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-center gap-2 min-w-0 mt-1 font-inter text-[10.5px] sm:text-[11px] font-semibold italic text-[#8C5A1E]"
                >
                  typing <TypingDots className="bg-[#8C5A1E]" />
                </motion.p>
              ) : (
                <motion.p
                  key="channel"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-center gap-1.5 min-w-0 mt-1"
                >
                  <span className="relative flex size-1.5 shrink-0">
                    <span className="absolute inset-0 rounded-full bg-[#1F7A3A] opacity-60 animate-ping motion-reduce:animate-none" />
                    <span className="relative size-1.5 rounded-full bg-[#1F7A3A]" />
                  </span>
                  <span className="font-inter text-[10.5px] sm:text-[11px] font-medium text-[#3E2A1E] truncate">
                    Encrypted &amp; privileged attorney–client channel
                  </span>
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </AnimatePresence>

      <ConversationMenu
        open={optionsOpen}
        setOpen={setOptionsOpen}
        name={activeThread.name}
        roleLabel={counterpartLabel}
        isLawyer={isLawyer}
        avatar={<Avatar name={activeThread.name} photo={activePhoto} className="size-10 text-sm" />}
        pinnedCount={pinnedMessages.length}
        onViewProfile={isLawyer ? undefined : () => router.push(`/client/lawyers/${activeThread.id}`)}
        onShowPins={() => setPinsOpen(true)}
        onReport={() => {
          setReportTarget({ threadId: activeThread.id, name: activeThread.name });
          setReportOpen(true);
        }}
      />
    </motion.div>
  );

  const pinnedBar = pinnedMessages.length > 0 && (
    <motion.div variants={PART_DOWN} ref={pinsRef} className="relative z-20 shrink-0">
      <motion.button
        type="button"
        onClick={() => setPinsOpen((open) => !open)}
        aria-expanded={pinsShown}
        aria-haspopup="true"
        whileTap={{ scale: 0.99 }}
        className="group neu-recessed w-full rounded-[16px] pl-3 pr-4 py-2 flex items-center gap-3 text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B9833C]/45"
      >
        {/* The pin gives a little shake whenever something is pinned or unpinned. */}
        <motion.span
          key={pinnedMessages.length}
          initial={{ rotate: -35, scale: 0.6 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 12 }}
          className="neu-raised-sm size-7 rounded-full flex items-center justify-center text-[#C58B3C] shrink-0"
        >
          <PinIcon className="w-3.5 h-3.5" />
        </motion.span>
        <span className="min-w-0 flex-1">
          <span className="block font-lora font-bold text-[9.5px] text-[#A8742E] uppercase tracking-[0.14em]">
            {pinnedMessages.length === 1 ? 'Pinned message' : `${pinnedMessages.length} pinned messages`}
          </span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={pinnedMessages[0].id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="block font-inter text-xs text-[#3E2A1E] truncate mt-0.5"
            >
              {pinnedMessages[0].content}
            </motion.span>
          </AnimatePresence>
        </span>
        <ChevronRightIcon
          className={`w-3.5 h-3.5 text-[#7D6855] shrink-0 transition-[rotate,color] duration-300 group-hover:text-[#A8742E] ${pinsShown ? '-rotate-90' : 'rotate-90'}`}
        />
      </motion.button>
      <AnimatePresence>
        {pinsShown && (
          <motion.div
            variants={MENU_POP}
            initial="hidden"
            animate="show"
            exit="exit"
            style={{ transformOrigin: '50% 0' }}
            className="absolute left-0 right-0 top-full mt-2.5 neu-raised bg-[#E5D8CB] rounded-[18px] p-2 max-h-72 overflow-y-auto neu-scrollbar-discrete"
          >
            <ul className="space-y-1">
              {pinnedMessages.map((m, i) => {
                const pin = activeExtras[m.id]?.pinned;
                return (
                  <motion.li
                    key={m.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.04 * i, duration: 0.22, ease: EASE_OUT }}
                    className="group/pin flex items-start gap-2 rounded-[14px] px-3 py-2.5 hover:bg-[#DECEB8]/45 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setPinsOpen(false);
                        jumpTo(m.id);
                      }}
                      className="min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <span className="flex flex-wrap items-center gap-x-1.5 font-inter text-[10.5px] text-[#7D6855]">
                        <span className="font-semibold text-[#341512]">{authorOf(m)}</span>
                        <span>· {m.time}</span>
                        <span>· pinned by {pin?.byMe ? 'you' : counterpartName}</span>
                      </span>
                      <span className="block font-inter text-[12.5px] text-[#3E2A1E] mt-1 leading-snug line-clamp-2 group-hover/pin:text-[#34150F]">
                        {m.content}
                      </span>
                    </button>
                    <motion.button
                      type="button"
                      onClick={() => togglePin(m)}
                      disabled={pinBusy === m.id}
                      whileHover={{ rotate: 90 }}
                      whileTap={{ scale: 0.85 }}
                      aria-label="Unpin message"
                      title="Unpin"
                      className="size-7 shrink-0 rounded-full flex items-center justify-center text-[#7D6855] hover:text-[#B42318] cursor-pointer disabled:opacity-50 transition-colors"
                    >
                      <CloseIcon className="w-3 h-3" />
                    </motion.button>
                  </motion.li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );

  const meetingBanner = meeting && (
    <motion.div
      variants={PART_DOWN}
      className="neu-recessed shrink-0 rounded-[20px] px-4 py-3.5 sm:px-5 flex flex-col sm:flex-row sm:items-center gap-4"
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <span className="relative neu-raised-sm size-10 rounded-full flex items-center justify-center text-[#C58B3C] shrink-0">
          {meetingUrl && (
            <span aria-hidden="true" className="neu-beacon absolute inset-0 rounded-full border-2 border-[#1FAA00]/50" />
          )}
          {meeting.method === 'audio' ? <PhoneIcon className="w-4.5 h-4.5" /> : <VideoIcon className="w-4.5 h-4.5" />}
        </span>
        <div className="min-w-0 space-y-1">
          <p className="font-lora font-bold text-[13px] sm:text-sm text-[#341512] leading-snug">
            {meetingMinutes > 0
              ? `Your ${meetingKind} starts in ${meetingMinutes} minute${meetingMinutes === 1 ? '' : 's'}`
              : `Your ${meetingKind} is happening now`}
          </p>
          <p className="font-inter text-[11px] sm:text-xs text-[#5C4535] truncate">
            {meeting.scheduleLabel} · {meeting.subject}
          </p>
        </div>
      </div>
      {meetingUrl ? (
        <NeuButton
          variant="primary"
          size="sm"
          icon={meeting.method === 'audio' ? <PhoneIcon className="w-3.5 h-3.5" /> : <VideoIcon className="w-3.5 h-3.5" />}
          onClick={() => window.open(meetingUrl, '_blank', 'noopener,noreferrer')}
          className="shrink-0 self-start sm:self-center px-5"
        >
          Join Meeting
        </NeuButton>
      ) : (
        <span className="shrink-0 font-inter text-[11px] text-[#7D6855] italic sm:max-w-[220px] sm:text-right leading-snug">
          {isLawyer
            ? 'Add the Google Meet link from Consultations.'
            : 'The meeting link will appear here once your attorney adds it.'}
        </span>
      )}
    </motion.div>
  );

  const renderMessage = (msg: MessageItem, idx: number) => {
    const prev = activeMessages[idx - 1];
    const next = activeMessages[idx + 1];
    const rank = activeMessages.length - 1 - idx;

    if (msg.sender === 'system') {
      return (
        <motion.div
          key={msg.id}
          data-msg-id={msg.id}
          variants={BUBBLE_IN}
          custom={{ rank, side: 'center' } satisfies BubbleCustom}
          className={`flex justify-center ${idx === 0 ? 'mb-5' : 'my-5'}`}
        >
          <span className="neu-raised-pill bg-[#E5D8CB] max-w-[92%] sm:max-w-[80%] inline-flex items-start gap-2.5 px-3.5 py-2 rounded-2xl font-inter text-[11px] sm:text-xs font-medium text-[#5C4535] leading-relaxed text-left">
            <ScaleIcon className="w-3.5 h-3.5 text-[#C58B3C] shrink-0 mt-[2px]" />
            <span>{msg.content}</span>
          </span>
        </motion.div>
      );
    }

    const ex = activeExtras[msg.id];
    const isMe = msg.sender === 'me';
    // Consecutive messages from the same person sit close together; a new speaker gets room.
    const startsRun = !prev || prev.sender !== msg.sender;
    const endsRun = !next || next.sender !== msg.sender;
    const showTime = endsRun || next.time !== msg.time;
    const pending = msg.id.startsWith('m-');
    const corner = endsRun ? (isMe ? 'rounded-br-md' : 'rounded-bl-md') : '';
    const atts = ex?.attachments ?? [];
    const hideText = !!ex?.autoCaption && atts.length > 0;
    const mediaOnly = hideText && atts.every((a) => a.kind === 'image' || a.kind === 'video');
    const isReply = !!ex?.replyToId;
    const replied = ex?.replyToId ? messageById.get(ex.replyToId) : undefined;
    const isPinned = !!ex?.pinned;
    const actionsShown = actionMsgId === msg.id;
    const highlighted = highlightId === msg.id;
    const msgReceipt = receipt?.messageId === msg.id ? receipt : null;
    const swipeable = isCoarse && !pending;

    const hidden = isMe ? 'translate-x-2' : '-translate-x-2';
    const toolbar = !pending && (
      <div
        className={`self-center shrink-0 neu-raised-sm rounded-full p-1 flex items-center gap-0.5 transition-[opacity,scale,translate] duration-200 ease-out ${
          isMe ? 'flex-row-reverse' : ''
        } ${
          actionsShown
            ? 'opacity-100 scale-100 translate-x-0'
            : `opacity-0 scale-75 ${hidden} pointer-events-none group-hover/msg:opacity-100 group-hover/msg:scale-100 group-hover/msg:translate-x-0 group-hover/msg:pointer-events-auto group-focus-within/msg:opacity-100 group-focus-within/msg:scale-100 group-focus-within/msg:translate-x-0 group-focus-within/msg:pointer-events-auto`
        }`}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            startReply(msg);
          }}
          aria-label="Reply to this message"
          title="Reply"
          className="group/tb size-7 rounded-full flex items-center justify-center text-[#5C4535] hover:text-[#A8742E] hover:bg-[#D9C8B6]/60 active:scale-90 cursor-pointer transition-[color,background-color,scale]"
        >
          <ReplyIcon className="w-3.5 h-3.5 transition-[translate] duration-300 group-hover/tb:-translate-x-0.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void togglePin(msg);
          }}
          disabled={pinBusy === msg.id}
          aria-pressed={isPinned}
          aria-label={isPinned ? 'Unpin this message' : 'Pin this message'}
          title={isPinned ? 'Unpin' : 'Pin'}
          className={`size-7 rounded-full flex items-center justify-center hover:bg-[#D9C8B6]/60 active:scale-90 cursor-pointer transition-[color,background-color,scale] disabled:opacity-50 ${
            isPinned ? 'text-[#C58B3C]' : 'text-[#5C4535] hover:text-[#A8742E]'
          }`}
        >
          <PinIcon className={`w-3.5 h-3.5 transition-[rotate] duration-300 ${isPinned ? 'rotate-45' : ''}`} />
        </button>
      </div>
    );

    return (
      <motion.div
        key={msg.id}
        data-msg-id={msg.id}
        variants={BUBBLE_IN}
        custom={{ rank, side: isMe ? 'me' : 'them' } satisfies BubbleCustom}
        initial={instantIds.has(msg.id) ? false : undefined}
        className={`group/msg flex flex-col ${isMe ? 'items-end' : 'items-start'} ${
          idx === 0 ? '' : (startsRun || isReply) && prev?.sender !== 'system' ? 'mt-4' : startsRun ? '' : 'mt-1.5'
        }`}
      >
        {isReply && <RepliedLabel text={repliedLabelFor(msg, replied)} mine={isMe} />}

        <div className={`w-full flex items-end gap-2.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
          {/* Their photo sits beside the last message of each run; earlier ones keep the indent. */}
          {!isMe &&
            (endsRun ? (
              <Avatar name={counterpartName} photo={activePhoto} className="size-8 text-[11px]" />
            ) : (
              <span className="w-8 shrink-0" aria-hidden="true" />
            ))}
          {isMe && toolbar}
          <motion.div
            // Touch: swipe the bubble toward the middle to reply.
            drag={swipeable ? 'x' : false}
            dragDirectionLock
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={isMe ? { left: 0.45, right: 0 } : { left: 0, right: 0.45 }}
            dragSnapToOrigin
            onDragEnd={(_, info) => {
              lastDragEndRef.current = Date.now();
              if ((isMe ? -info.offset.x : info.offset.x) > 56) startReply(msg);
            }}
            // A jump from a reply makes the original give a little pulse.
            animate={highlighted ? { scale: [1, 1.05, 0.99, 1] } : { scale: 1 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
            onClick={() => {
              if (pending || Date.now() - lastDragEndRef.current < 300) return;
              setActionMsgId((cur) => (cur === msg.id ? null : msg.id));
            }}
            className={`min-w-0 max-w-[78%] sm:max-w-[68%] xl:max-w-[60%] rounded-[18px] ${corner} text-[13px] sm:text-[13.5px] leading-relaxed transition-[outline-color,outline-offset] duration-300 ${
              swipeable ? 'touch-pan-y' : ''
            } ${mediaOnly ? 'p-1.5' : isReply ? 'p-2 pb-2.5 sm:p-2.5' : 'px-3.5 py-2 sm:px-4 sm:py-2.5'} ${
              isMe
                ? 'bg-[#34150F] text-[#FAF6F0] font-inter shadow-[4px_4px_10px_rgba(52,21,18,0.22),-3px_-3px_8px_rgba(252,238,223,0.8)]'
                : 'neu-raised-sm bg-[#E5D8CB] text-[#341512] font-lora'
            } ${pending ? 'opacity-75' : ''} outline-2 outline-solid ${
              highlighted ? 'outline-offset-[4px] outline-[#C58B3C]' : 'outline-offset-[1px] outline-transparent'
            }`}
          >
            {isReply && (
              <ReplyQuote
                quote={quoteOf(replied)}
                mine={isMe}
                compact={mediaOnly}
                onJump={replied ? () => jumpTo(replied.id) : undefined}
              />
            )}
            {atts.length > 0 && (
              <div className={hideText ? '' : 'mb-2'}>
                <MessageAttachments attachments={atts} mine={isMe} />
              </div>
            )}
            {!hideText && (
              <span className={`block whitespace-pre-wrap break-words ${isReply ? 'px-1.5' : ''}`}>{msg.content}</span>
            )}
          </motion.div>
          {!isMe && toolbar}
        </div>

        {(showTime || isPinned) && (
          <span
            className={`flex items-center gap-2 mt-1.5 font-inter text-[10.5px] font-medium text-[#8E7E70] ${
              isMe ? 'pr-1.5 flex-row-reverse' : 'pl-[42px]'
            }`}
          >
            {showTime && <span>{pending ? 'Sending…' : msg.time}</span>}
            <AnimatePresence initial={false}>
              {isPinned && (
                <motion.span
                  key="pinned"
                  initial={{ opacity: 0, scale: 0.6, rotate: -30 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                  className="inline-flex items-center gap-1 text-[#A8742E]"
                >
                  <PinIcon className="w-3 h-3" />
                  Pinned
                </motion.span>
              )}
            </AnimatePresence>
          </span>
        )}

        {msgReceipt && (
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={msgReceipt.seenAt ? 'seen' : 'sent'}
              initial={{ opacity: 0, y: -4, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 3, transition: { duration: 0.12 } }}
              transition={{ type: 'spring', stiffness: 460, damping: 26 }}
              className={`inline-flex items-center gap-1 mt-1 pr-1.5 font-inter text-[10.5px] font-semibold ${
                msgReceipt.seenAt ? 'text-[#A8742E]' : 'text-[#8E7E70]'
              }`}
            >
              {msgReceipt.seenAt ? (
                <>
                  <DoubleCheckIcon className="w-3.5 h-3.5" />
                  Seen {formatSeen(msgReceipt.seenAt)}
                </>
              ) : (
                <>
                  <CheckIcon className="w-3 h-3" />
                  Sent
                </>
              )}
            </motion.span>
          </AnimatePresence>
        )}
      </motion.div>
    );
  };

  const messageStream = (
    <motion.div
      variants={WELL_PRESS}
      className="relative neu-recessed flex-1 min-h-[200px] rounded-[22px] sm:rounded-[24px] overflow-hidden flex flex-col"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) e.preventDefault();
      }}
      onDrop={(e) => {
        if (e.dataTransfer.files.length === 0) return;
        e.preventDefault();
        queueFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <div
        ref={scrollRef}
        onScroll={onStreamScroll}
        className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden neu-scrollbar-discrete px-3.5 py-4 sm:px-5 sm:py-5 lg:px-6"
      >
        {activeMessages.length === 0 ? (
          <EmptyState
            size="sm"
            className="h-full flex flex-col items-center justify-center"
            icon={<ScaleIcon />}
            title="No messages yet"
            description={
              isLawyer
                ? 'Start the conversation below. Only you and your client can read this channel.'
                : 'Start the conversation below. Only you and your attorney can read this channel.'
            }
          />
        ) : (
          // Bubbles rise up from the composer, newest first — on open, on switching conversations and
          // each time you come back to this tab. New messages slide in from their sender's side.
          <motion.div
            key={activeThreadId ?? 'none'}
            variants={STREAM}
            initial="hidden"
            animate={viewActive ? 'show' : 'hidden'}
            className="flex flex-col"
          >
            {activeMessages.map(renderMessage)}

            {/* "Typing…" bubble */}
            <AnimatePresence>
              {otherTyping && (
                <motion.div
                  key="typing"
                  initial={{ opacity: 0, y: 8, scale: 0.9, x: -12 }}
                  animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
                  exit={{ opacity: 0, y: 4, scale: 0.9, transition: { duration: 0.15 } }}
                  transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                  className="flex items-end gap-2.5 mt-4"
                  role="status"
                  aria-label={`${counterpartName} is typing`}
                >
                  <Avatar name={counterpartName} photo={activePhoto} className="size-8 text-[11px]" />
                  <div className="neu-raised-sm bg-[#E5D8CB] rounded-[18px] rounded-bl-md px-4 py-3">
                    <TypingDots />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Back to the newest message */}
      <AnimatePresence>
        {showJump && (
          <motion.button
            type="button"
            onClick={scrollToLatest}
            initial={{ opacity: 0, y: 14, scale: 0.7 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.7 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 460, damping: 26 }}
            aria-label="Jump to the latest message"
            className="group absolute bottom-3.5 left-1/2 -translate-x-1/2 z-10 neu-raised-sm h-9 pl-3 pr-4 rounded-full flex items-center gap-2 font-inter text-[11.5px] font-semibold text-[#5C4535] hover:text-[#A8742E] cursor-pointer"
          >
            <ArrowDownIcon className="w-3.5 h-3.5 transition-[translate] duration-300 group-hover:translate-y-0.5" />
            Latest
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );

  const ratingBlock = (ratePrompt || ratingThanks) && (
    <motion.div variants={PART_UP} className="shrink-0">
      <AnimatePresence mode="wait" initial={false}>
        {ratingThanks && !ratePrompt ? (
          <NeuAlert key="thanks" tone="success" title="Thank you!" onDismiss={() => setRatingThanks(false)}>
            Your rating has been submitted.
          </NeuAlert>
        ) : ratePrompt ? (
          <motion.div
            key="prompt"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            className="neu-raised-highlight rounded-[20px] sm:rounded-[22px] p-4 sm:p-5 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <motion.span
                  animate={{ rotate: [0, -12, 10, -6, 0] }}
                  transition={{ duration: 0.8, delay: 0.6, repeat: Infinity, repeatDelay: 4 }}
                  className="neu-btn-banner size-10 rounded-full flex items-center justify-center text-[#341512] shrink-0"
                >
                  <StarIcon className="w-4.5 h-4.5" />
                </motion.span>
                <div className="min-w-0 space-y-1">
                  <p className="font-lora font-bold text-[13px] sm:text-sm text-[#341512] leading-snug">
                    Would you like to rate {ratePrompt.lawyerName}?
                  </p>
                  <p className="font-inter text-[11px] sm:text-xs text-[#5C4535] leading-snug">
                    Your consultation on {ratePrompt.dateLabel} has ended. Your review helps other clients.
                  </p>
                </div>
              </div>
                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => dismissRating(ratePrompt.consultationId)}
                    className="px-3 py-2 rounded-xl font-lora text-xs font-semibold text-[#5C4535] hover:text-[#341512] cursor-pointer transition-colors"
                  >
                    Not now
                  </button>
                  <motion.button
                    type="button"
                    onClick={() => setRatingOpen(true)}
                    whileHover={{ y: -1.5 }}
                    whileTap={{ scale: 0.95 }}
                    className="neu-btn-banner h-9 px-5 rounded-xl font-lora text-xs font-bold text-[#341512] cursor-pointer"
                  >
                    Rate Lawyer
                  </motion.button>
                </div>
            </div>

            {ratingOpen && (
              <ConsultationRatingDialog
                lawyerName={ratePrompt.lawyerName}
                busy={ratingBusy}
                onClose={() => {
                  setRatingOpen(false);
                  setRatingError(null);
                }}
              >
              <form onSubmit={submitRating} className="space-y-4 pt-1">
                <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Star rating">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <motion.button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={ratingStars === s}
                      aria-label={`${s} star${s === 1 ? '' : 's'}`}
                      onClick={() => setRatingStars(s)}
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.85 }}
                      animate={s <= ratingStars ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                      transition={{ duration: 0.3, delay: s <= ratingStars ? s * 0.03 : 0 }}
                      className="p-1 cursor-pointer"
                    >
                      <svg
                        viewBox="0 0 20 20"
                        className={`w-7 h-7 transition-colors ${s <= ratingStars ? 'text-[#A8742E] fill-[#C58B3C]' : 'text-[#B79C80] fill-transparent'}`}
                        stroke="currentColor"
                        strokeWidth="1.2"
                        aria-hidden="true"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </motion.button>
                  ))}
                </div>
                <textarea
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  maxLength={5000}
                  rows={3}
                  disabled={ratingBusy}
                  placeholder="Share how the consultation went…"
                  aria-label="Your review"
                  className="w-full neu-inset-banner rounded-[14px] px-4 py-3 text-[13px] sm:text-sm font-lora text-[#34150F] placeholder-[#7D6855]/70 focus:outline-none focus:ring-2 focus:ring-[#B9833C]/45 resize-y"
                />
                {ratingError && (
                  <p role="alert" className="font-inter text-xs text-[#7A1A12]">
                    {ratingError}
                  </p>
                )}
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    disabled={ratingBusy}
                    onClick={() => {
                      setRatingOpen(false);
                      setRatingError(null);
                    }}
                    className="px-3 py-2 rounded-xl font-lora text-xs font-semibold text-[#5C4535] hover:text-[#341512] cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <NeuButton type="submit" variant="dark" size="sm" loading={ratingBusy} className="px-5">
                    {ratingBusy ? 'Submitting…' : 'Submit Rating'}
                  </NeuButton>
                </div>
              </form>
              </ConsultationRatingDialog>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );

  const pickMedia = () => mediaInputRef.current?.click();
  const pickDocuments = () => docInputRef.current?.click();
  const replyQuote = quoteOf(replyTo ?? undefined);

  const composer = (
    <motion.div variants={PART_UP} className="shrink-0 space-y-3">
      <AnimatePresence initial={false}>
        {chatError && (
          <NeuAlert key="chat-error" tone="error" onDismiss={() => setChatError(null)}>
            {chatError}
          </NeuAlert>
        )}
      </AnimatePresence>

      {/* Replying to … — a raised slip that tips up out of the message box */}
      <AnimatePresence initial={false} mode="popLayout">
        {replyTo && replyQuote && (
          <ReplyComposerCard key={replyTo.id} quote={replyQuote} onCancel={() => setReplyState(null)} />
        )}
      </AnimatePresence>

      {/* Files waiting to be sent */}
      <AnimatePresence initial={false}>
        {pending.length > 0 && (
          <motion.div
            key="pending"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: EASE_OUT }}
          >
            <div className="flex flex-wrap gap-3 px-1 pt-1 pb-0.5">
              <AnimatePresence initial={false}>
                {pending.map((p) => (
                  <motion.div
                    key={p.localId}
                    layout
                    initial={{ opacity: 0, scale: 0.7, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    transition={{ type: 'spring', stiffness: 460, damping: 28 }}
                  >
                    <PendingAttachmentChip item={p} onRemove={() => removePending(p.localId)} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSendMessage} className="flex items-center gap-2.5 sm:gap-3">
        {/* + Attach */}
        <div ref={attachRef} className="relative shrink-0">
          <motion.button
            type="button"
            onClick={() => setAttachOpen((open) => !open)}
            disabled={recorder.recording}
            aria-label="Add an attachment"
            aria-haspopup="menu"
            aria-expanded={attachOpen}
            whileHover={recorder.recording ? undefined : { scale: 1.06 }}
            whileTap={{ scale: 0.9 }}
            className={`size-11 rounded-full flex items-center justify-center cursor-pointer transition-[color,box-shadow] disabled:opacity-40 disabled:cursor-not-allowed ${
              attachOpen ? 'neu-recessed text-[#C58B3C]' : 'neu-raised-sm text-[#5C4535] hover:text-[#C58B3C]'
            }`}
          >
            <PlusIcon
              className={`w-5 h-5 transition-[rotate] duration-500 ease-[cubic-bezier(0.34,1.45,0.64,1)] ${attachOpen ? 'rotate-[135deg]' : ''}`}
            />
          </motion.button>
          <AnimatePresence>
            {attachOpen && (
              <motion.div
                role="menu"
                variants={MENU_POP_UP}
                initial="hidden"
                animate="show"
                exit="exit"
                style={{ transformOrigin: '22px 100%' }}
                className="absolute left-0 bottom-full mb-3 z-30 w-64 neu-raised bg-[#E5D8CB] rounded-[18px] p-2"
              >
                <AttachMenuItem
                  icon={<ImageIcon className="w-4 h-4" />}
                  title="Photo or video"
                  hint="PNG, JPG, GIF or MP4 · up to 8 MB"
                  index={0}
                  onSelect={pickMedia}
                />
                <AttachMenuItem
                  icon={<FileIcon className="w-4 h-4" />}
                  title="Document or audio"
                  hint="PDF, Word, Excel, MP3… · up to 8 MB"
                  index={1}
                  onSelect={pickDocuments}
                />
                {isVoiceRecordingSupported() && (
                  <AttachMenuItem
                    icon={<MicIcon className="w-4 h-4" />}
                    title="Voice message"
                    hint="Record with your microphone"
                    index={2}
                    onSelect={() => void startVoice()}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
          <input ref={mediaInputRef} type="file" multiple accept={ACCEPT_MEDIA} className="hidden" onChange={onPickFiles} />
          <input ref={docInputRef} type="file" multiple accept={ACCEPT_DOCUMENTS} className="hidden" onChange={onPickFiles} />
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {recorder.recording ? (
            <motion.div
              key="recording"
              initial={{ opacity: 0, scaleX: 0.92 }}
              animate={{ opacity: 1, scaleX: 1 }}
              exit={{ opacity: 0, scaleX: 0.92 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              className="neu-recessed flex-1 min-w-0 h-11 rounded-[13px] pl-4 pr-1.5 flex items-center gap-3 origin-left"
              role="status"
            >
              <span className="relative flex size-2.5 shrink-0">
                <span className="absolute inset-0 rounded-full bg-[#B42318] opacity-60 animate-ping motion-reduce:animate-none" />
                <span className="relative size-2.5 rounded-full bg-[#B42318]" />
              </span>
              <span className="font-inter text-[13px] font-semibold text-[#341512] tabular-nums">{formatDuration(recorder.elapsed)}</span>
              {/* Live "level" bars */}
              <span className="flex-1 min-w-0 flex items-center gap-[3px] h-5 overflow-hidden" aria-hidden="true">
                {Array.from({ length: 18 }).map((_, i) => (
                  <motion.span
                    key={i}
                    className="w-[3px] shrink-0 rounded-full bg-[#C58B3C]/70"
                    animate={{ height: ['30%', '100%', '45%', '80%', '30%'] }}
                    transition={{ duration: 1.1, repeat: Infinity, delay: (i % 6) * 0.12, ease: 'easeInOut' }}
                  />
                ))}
              </span>
              <motion.button
                type="button"
                onClick={recorder.cancel}
                whileTap={{ scale: 0.85 }}
                aria-label="Discard recording"
                title="Discard"
                className="size-8 shrink-0 rounded-full flex items-center justify-center text-[#7D6855] hover:text-[#B42318] cursor-pointer transition-colors"
              >
                <TrashIcon className="w-4 h-4" />
              </motion.button>
              <motion.button
                type="button"
                onClick={recorder.stop}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.85 }}
                aria-label="Finish recording"
                title="Finish"
                className="neu-btn-caramel size-8 shrink-0 rounded-full flex items-center justify-center text-[#341512] cursor-pointer"
              >
                <StopIcon className="w-3.5 h-3.5" />
              </motion.button>
            </motion.div>
          ) : (
            <motion.label
              key="input"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="neu-recessed flex-1 min-w-0 h-11 rounded-[13px] px-4 sm:px-5 flex items-center transition-shadow focus-within:ring-2 focus-within:ring-[#B9833C]/40 cursor-text"
            >
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => {
                  setInputMessage(e.target.value);
                  if (chatError) setChatError(null);
                  if (e.target.value.trim()) notifyTyping();
                  else stopTyping();
                }}
                onBlur={stopTyping}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && replyTo) {
                    e.preventDefault();
                    setReplyState(null);
                  }
                }}
                onPaste={(e) => {
                  const files = Array.from(e.clipboardData.files);
                  if (files.length > 0) {
                    e.preventDefault();
                    queueFiles(files);
                  }
                }}
                placeholder={
                  replyTo
                    ? `Reply to ${authorOf(replyTo) === 'You' ? 'yourself' : authorOf(replyTo)}…`
                    : pending.length > 0
                      ? 'Add a caption (optional)…'
                      : isLawyer
                        ? 'Write a confidential message to your client…'
                        : 'Write a confidential message to your attorney…'
                }
                aria-label="Message"
                className="w-full bg-transparent text-[#34150F] placeholder-[#9A8270]/70 font-lora text-[13px] sm:text-sm focus:outline-none"
              />
            </motion.label>
          )}
        </AnimatePresence>

        <NeuButton
          type="submit"
          variant="primary"
          disabled={!canSend}
          icon={
            uploading ? (
              <Spinner className="w-4 h-4" />
            ) : (
              // The paper plane takes off on every send and glides back in.
              <motion.span
                key={sendTick}
                className="flex"
                animate={
                  sendTick
                    ? { x: [0, 18, -16, 0], y: [0, -18, 14, 0], opacity: [1, 0, 0, 1], rotate: [0, -14, 0, 0] }
                    : undefined
                }
                transition={{ duration: 0.7, times: [0, 0.38, 0.42, 1], ease: 'easeOut' }}
              >
                <SendIcon className="w-4 h-4" />
              </motion.span>
            )
          }
          aria-label="Send message"
          className="shrink-0 min-w-0! sm:min-w-[120px]! px-4! sm:px-6!"
        >
          <span className="hidden sm:inline">{sending ? 'Sending…' : uploading ? 'Uploading…' : 'Send'}</span>
        </NeuButton>
      </form>
    </motion.div>
  );

  return (
    <MotionConfig reducedMotion="user">
      {/* The lawyer portal switches the default font to Lora; pin the client portal's default (the
          body font) so both portals render this screen identically. */}
      <div
        className="h-[calc(100dvh-4rem)] min-h-[560px] w-full max-w-[1300px] mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 py-6 sm:py-8 lg:py-10 flex flex-col bg-[#E5D8CB]"
        style={{ fontFamily: 'var(--font-sans), Arial, Helvetica, sans-serif' }}
      >
        <h1 className="sr-only">Messages — Justicia Philippine Legal Intelligence</h1>

        {/* Replays the entrance each time this tab is shown (the shell keeps it mounted). */}
        <motion.div
          variants={PAGE_STAGGER}
          initial="hidden"
          animate={viewActive ? 'show' : 'hidden'}
          className="flex-1 min-h-0 flex gap-6 lg:gap-7 xl:gap-8"
        >
          {/* ─── Left: conversation list ───
              A <section>, not an <aside>: the lawyer portal styles every `.lawyer-portal aside` as its
              sidebar (fixed height, tint, 44px nav buttons), which would break this panel there. */}
          <motion.section
            variants={EXTRUDE}
            aria-label="Conversations"
            className={`${mobilePane === 'chat' ? 'hidden' : 'flex'} lg:flex w-full lg:w-[320px] xl:w-[350px] lg:shrink-0 min-h-0 flex-col gap-5 neu-raised bg-[#E5D8CB] rounded-[24px] sm:rounded-[26px] p-5 sm:p-6`}
          >
            {threadList}
          </motion.section>

          {/* ─── Right: open conversation ─── */}
          <motion.section
            variants={CHAT_PANEL}
            aria-label="Conversation"
            className={`${mobilePane === 'list' ? 'hidden' : 'flex'} lg:flex flex-1 min-w-0 min-h-0 flex-col gap-4 neu-raised bg-[#E5D8CB] rounded-[28px] sm:rounded-[32px] p-4 sm:p-5 lg:p-6 overflow-y-auto neu-scrollbar-discrete`}
          >
            {!threadsLoaded ? (
              <div className="flex-1 flex items-center justify-center text-[#C58B3C]" aria-busy="true">
                <Spinner className="w-6 h-6" />
              </div>
            ) : threads.length === 0 || !activeThread ? (
              <div className="flex-1 flex items-center justify-center">
                <EmptyState
                  icon={<ScaleIcon />}
                  title="No Conversation Selected"
                  description={
                    isLawyer
                      ? 'Consultations confirmed with your clients will appear here for confidential communication and case coordination.'
                      : 'Book a consultation with an attorney to open a private communication channel with them.'
                  }
                  action={
                    <NeuButton
                      variant="primary"
                      icon={isLawyer ? <CalendarIcon className="w-4 h-4" /> : <SearchIcon className="w-4 h-4" />}
                      onClick={() => router.push(isLawyer ? '/lawyer/consultations' : '/client/lawyers')}
                    >
                      {isLawyer ? 'View Consultations' : 'Find a Lawyer'}
                    </NeuButton>
                  }
                />
              </div>
            ) : (
              <>
                {chatHeader}
                {pinnedBar}
                {meetingBanner}
                {messageStream}
                {ratingBlock}
                {composer}
              </>
            )}
          </motion.section>
        </motion.div>

        {reportTarget && (
          <ReportAccountModal
            open={reportOpen}
            threadId={reportTarget.threadId}
            targetName={reportTarget.name}
            targetRole={isLawyer ? 'client' : 'lawyer'}
            onClose={() => setReportOpen(false)}
          />
        )}
      </div>
    </MotionConfig>
  );
}

export default MessagesView;
