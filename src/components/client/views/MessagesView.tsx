'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { MessagesIcon, ScaleIcon, SendPaperPlaneIcon } from '@/components/client/ClientIcons';
import { sendDirectMessageAction, type ThreadContext } from '@/app/actions/consultationActions';
import { fetchLive } from '@/lib/live/fetchLive';
import { useLiveRefresh, useViewActive } from '@/components/live/LiveProvider';
import { addLawyerReviewAction } from '@/app/actions/reviewActions';
import { ReportAccountModal } from '@/components/shared/ReportAccountModal';
import { ConsultationRatingDialog } from '@/components/client/ConsultationRatingDialog';

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

const RATE_DISMISS_KEY = 'justicia_rate_prompt_dismissed';

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

export function MessagesView({ role = 'client' }: { role?: 'client' | 'lawyer' } = {}) {
  const isLawyer = role === 'lawyer';
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [messages, setMessages] = useState<Record<string, MessageItem[]>>({});
  const [sending, setSending] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const viewActive = useViewActive();

  // Deep link from "Message Client" / "Message Channel": /…/messages?thread=<consultationId>.
  // Read reactively: this tab may already be mounted (kept alive) when the link is followed.
  const requestedThread = useSearchParams().get('thread');
  const requestedThreadRef = useRef<string | null>(requestedThread);
  useEffect(() => {
    requestedThreadRef.current = requestedThread;
  }, [requestedThread]);
  const findRequested = (list: ThreadItem[], requested: string | null) =>
    requested ? list.find((t) => t.id === requested || t.consultationIds?.includes(requested)) : undefined;

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
        }),
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

  useEffect(() => {
    loadMessages(activeThreadId);
  }, [activeThreadId, loadMessages]);

  // Replies, new conversations and system messages arrive live (Supabase Realtime).
  // Without a live connection, poll — only while this tab is on screen.
  useLiveRefresh(['messages', 'consultations'], loadThreads, { fallbackMs: 15000 });
  useLiveRefresh(['messages'], () => loadMessages(), { fallbackMs: 5000 });

  // Auto-scroll messages stream to bottom when active messages change
  const activeMessages = (activeThreadId && messages[activeThreadId]) || [];
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages.length, activeThreadId]);

  const activeThread = threads.find((t) => t.id === activeThreadId) || threads[0];

  // Conversation options menu (Report …)
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ threadId: string; name: string } | null>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!optionsOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (optionsRef.current && !optionsRef.current.contains(e.target as Node)) setOptionsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOptionsOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [optionsOpen]);

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
    setActiveThreadId(id);
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = inputMessage.trim();
    if (!content || !activeThreadId || sending) return;

    const threadId = activeThreadId;
    const tempId = `m-${Date.now()}`;
    const newMsg: MessageItem = {
      id: tempId,
      sender: 'me',
      content,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => ({
      ...prev,
      [threadId]: [...(prev[threadId] || []), newMsg],
    }));
    setInputMessage('');

    setSending(true);
    try {
      const res = await sendDirectMessageAction(threadId, content);
      if ('message' in res && res.message) {
        const saved = res.message;
        setMessages((prev) => ({
          ...prev,
          [threadId]: (prev[threadId] || []).map((m) => (m.id === tempId ? saved : m)),
        }));
        setThreads((prev) =>
          prev.map((t) => (t.id === threadId ? { ...t, lastMessage: `You: ${content}`, time: saved.time } : t))
        );
      } else {
        setMessages((prev) => ({
          ...prev,
          [threadId]: (prev[threadId] || []).filter((m) => m.id !== tempId),
        }));
        setInputMessage(content);
        alert(('error' in res && res.error) || 'Your message could not be sent.');
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="px-4 sm:px-8 lg:px-12 xl:px-16 py-5 sm:py-7 max-w-[1300px] mx-auto w-full min-h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)] flex flex-col bg-[#E5D8CB]">
      <h1 className="sr-only">Messages — Justicia Philippine Legal Intelligence</h1>

      <div className="flex-1 min-h-0 flex flex-col md:grid md:grid-cols-12 gap-5 lg:gap-6 items-stretch">
        {/* Left Column: Thread List (4 cols) */}
        <div className="md:col-span-4 lg:col-span-4 neu-raised bg-[#E5D8CB] rounded-[24px] p-4 sm:p-5 flex flex-col h-72 md:h-full md:min-h-0 shrink-0 md:shrink overflow-hidden space-y-3.5">
          <div className="flex items-center justify-between pb-3.5 border-b border-[#D8C6B0]/60 px-1 shrink-0">
            <h2 className="font-lora font-bold text-sm sm:text-base text-[#34150F] tracking-tight">
              Active Consultations
            </h2>
            <span className="neu-raised-sm bg-[#E5D8CB] px-2.5 py-0.5 rounded-full font-lora text-[11px] font-semibold text-[#D39758] tracking-wide select-none">
              {threads.length}
            </span>
          </div>

          <div className="space-y-2.5 flex-1 min-h-0 overflow-y-auto pr-1 py-1 neu-scrollbar-discrete">
            {threads.length === 0 ? (
              <div className="py-12 px-3 text-center my-auto">
                <div className="neu-raised-sm size-12 rounded-full bg-[#E5D8CB] flex items-center justify-center mx-auto mb-3 text-[#A89685]">
                  <MessagesIcon className="w-5 h-5 text-[#A89685]" />
                </div>
                <p className="font-lora text-xs sm:text-sm font-semibold text-[#34150F]">No Active Consultations</p>
                <p className="font-inter text-[11px] text-[#7D6855] mt-1.5 leading-relaxed max-w-[240px] mx-auto">
                  {role === 'lawyer'
                    ? 'Once a client consultation is booked and confirmed, a communication channel will appear here.'
                    : 'Once a consultation is booked and confirmed by an attorney, a communication channel will appear here.'}
                </p>
              </div>
            ) : (
              threads.map((thread) => {
                const isSelected = activeThreadId === thread.id;
                return (
                  <button
                    type="button"
                    key={thread.id}
                    onClick={() => selectThread(thread.id)}
                    className={`p-3.5 rounded-[18px] cursor-pointer transition-all text-left w-full select-none ${
                      isSelected
                        ? 'neu-recessed bg-[#E5D8CB] ring-1 ring-[#C58B3C]/45'
                        : 'neu-raised-sm bg-[#E5D8CB] hover:brightness-[1.015] active:scale-[0.985]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-lora font-bold text-xs sm:text-[13.5px] text-[#34150F] truncate leading-tight">
                        {thread.name}
                      </h3>
                      <span className="font-inter text-[10px] text-[#8C7A6B] shrink-0 font-medium">
                        {thread.time}
                      </span>
                    </div>
                    <p className="font-inter text-[11px] text-[#5C4535] mt-1.5 truncate leading-snug">
                      {thread.lastMessage}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Chat Window (8 cols) */}
        <div className="md:col-span-8 lg:col-span-8 neu-raised bg-[#E5D8CB] rounded-[24px] flex flex-col justify-between overflow-hidden min-h-[460px] md:min-h-0 md:h-full flex-1">
          {threads.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#E5D8CB]">
              <div className="neu-raised size-16 rounded-full bg-[#E5D8CB] flex items-center justify-center text-2xl mb-4 text-[#D39758]">
                <ScaleIcon className="w-8 h-8 text-[#D39758]" />
              </div>
              <h3 className="font-lora text-lg sm:text-xl font-bold text-[#34150F]">
                No Message Thread Selected
              </h3>
              <p className="font-inter text-xs text-[#7D6855] max-w-sm mt-1.5 leading-relaxed">
                {role === 'lawyer'
                  ? 'Consultations confirmed with your clients will appear here for confidential communication and case coordination.'
                  : 'Book a consultation with an attorney or select an active consultation from the list to access your communication channel.'}
              </p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="p-4 sm:p-5 bg-[#E5D8CB] border-b border-[#D8C6B0]/60 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="neu-raised-sm size-10 sm:size-11 rounded-full bg-[#E5D8CB] text-[#C58B3C] font-lora font-bold text-sm sm:text-base flex items-center justify-center shrink-0">
                    {activeThread?.name?.charAt(0) || '⚖'}
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-lora font-bold text-sm sm:text-base text-[#34150F] truncate leading-tight">
                      {activeThread?.name || 'Active Session'}
                    </h2>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <span className="font-inter text-[10.5px] font-semibold text-emerald-800 tracking-wide truncate">
                        Encrypted &amp; Privileged Attorney Channel
                      </span>
                    </div>
                  </div>
                </div>

                {activeThread && (
                  <div ref={optionsRef} className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setOptionsOpen((open) => !open)}
                      aria-label="Conversation options"
                      aria-haspopup="menu"
                      aria-expanded={optionsOpen}
                      className="neu-raised-sm size-9 rounded-full bg-[#E5D8CB] text-[#5C4535] hover:text-[#34150F] flex items-center justify-center active:scale-95 transition cursor-pointer"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <circle cx="12" cy="5" r="1.8" />
                        <circle cx="12" cy="12" r="1.8" />
                        <circle cx="12" cy="19" r="1.8" />
                      </svg>
                    </button>
                    {optionsOpen && (
                      <div role="menu" className="absolute right-0 top-full mt-2 z-30 w-56 neu-raised bg-[#E5D8CB] rounded-[16px] p-1.5">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setOptionsOpen(false);
                            setReportTarget({ threadId: activeThread.id, name: activeThread.name });
                          }}
                          className="w-full flex items-start gap-2.5 rounded-[12px] px-3 py-2.5 text-left hover:bg-[#DCCDBB] transition cursor-pointer"
                        >
                          <svg className="w-4 h-4 mt-0.5 text-rose-800 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M4 21V4m0 0h11l-1.5 4L15 12H4" />
                          </svg>
                          <span className="min-w-0">
                            <span className="block font-inter text-xs font-semibold text-rose-900">
                              Report {role === 'lawyer' ? 'client' : 'attorney'}
                            </span>
                            <span className="block font-inter text-[10.5px] text-[#7D6855] mt-0.5 leading-snug">
                              Tell the Justicia team about misconduct, with proof.
                            </span>
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Meeting announcement: shown from 15 minutes before a confirmed consultation until it ends */}
              {meeting && (
                <div className="px-4 sm:px-5 pt-3.5 bg-[#E5D8CB] shrink-0">
                  <div
                    role={meeting.meetingUrl ? 'link' : 'status'}
                    tabIndex={meeting.meetingUrl ? 0 : undefined}
                    onClick={() => meeting.meetingUrl && window.open(meeting.meetingUrl, '_blank', 'noopener,noreferrer')}
                    onKeyDown={(e) => {
                      if (meeting.meetingUrl && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        window.open(meeting.meetingUrl, '_blank', 'noopener,noreferrer');
                      }
                    }}
                    className={`neu-raised-sm !bg-[#D39758]/25 rounded-[18px] p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${
                      meeting.meetingUrl ? 'cursor-pointer hover:brightness-[1.02] active:scale-[0.995] transition' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <span className="relative mt-1 flex h-2.5 w-2.5 shrink-0">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-[#C58B3C] opacity-60 animate-ping motion-reduce:animate-none" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#C58B3C]" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-lora font-bold text-xs sm:text-sm text-[#34150F] leading-snug">
                          {meetingMinutes > 0
                            ? `Your ${meeting.method === 'audio' ? 'audio call' : 'video consultation'} starts in ${meetingMinutes} minute${meetingMinutes === 1 ? '' : 's'}`
                            : `Your ${meeting.method === 'audio' ? 'audio call' : 'video consultation'} is happening now`}
                        </p>
                        <p className="font-inter text-[11px] text-[#5C4535] mt-0.5 truncate">
                          {meeting.scheduleLabel} · {meeting.subject}
                        </p>
                      </div>
                    </div>
                    {meeting.meetingUrl ? (
                      <a
                        href={meeting.meetingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="neu-btn-caramel shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-[12px] text-white text-xs font-inter font-semibold shadow-md active:scale-95 transition"
                      >
                        Join Meeting
                      </a>
                    ) : (
                      <span className="shrink-0 font-inter text-[11px] text-[#7D6855] italic">
                        {role === 'lawyer' ? 'Add the Google Meet link from Consultations.' : 'The meeting link will appear here once your attorney adds it.'}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Messages Scroll Area */}
              <div className="p-4 sm:p-6 space-y-4 flex-1 min-h-0 overflow-y-auto bg-[#E5D8CB] neu-scrollbar-discrete">
                {activeMessages.length === 0 ? (
                  <div className="py-16 text-center">
                    <div className="neu-raised-sm size-11 rounded-full bg-[#E5D8CB] flex items-center justify-center mx-auto mb-2.5 text-[#A89685]">
                      <ScaleIcon className="w-5 h-5 text-[#A89685]" />
                    </div>
                    <p className="font-lora text-xs sm:text-sm font-semibold text-[#34150F]">
                      No messages in this consultation yet
                    </p>
                    <p className="font-inter text-[11px] text-[#7D6855] mt-1">
                      Start the conversation below.
                    </p>
                  </div>
                ) : (
                  activeMessages.map((msg) => {
                    if (msg.sender === 'system') {
                      return (
                        <div key={msg.id} className="text-center my-3">
                          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full neu-recessed bg-[#E5D8CB] font-inter text-[10.5px] font-medium text-[#5C4535]">
                            <ScaleIcon className="w-3.5 h-3.5 text-[#C58B3C] shrink-0" />
                            <span>{msg.content}</span>
                          </span>
                        </div>
                      );
                    }

                    const isMe = msg.sender === 'me';
                    return (
                      <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <div
                          className={`max-w-[85%] sm:max-w-md p-3.5 sm:p-4 rounded-[20px] text-xs sm:text-[13.5px] leading-relaxed ${
                            isMe
                              ? 'bg-[#34150F] text-[#FAF6F0] rounded-br-xs font-inter shadow-md'
                              : 'neu-raised bg-[#E5D8CB] text-[#34150F] rounded-bl-xs font-lora'
                          }`}
                        >
                          {msg.content}
                        </div>
                        <span className="font-inter text-[9px] text-[#8E7E70] mt-1 px-1 font-medium">
                          {msg.time}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Rate-your-lawyer prompt (clients, after a finished consultation that hasn't been rated) */}
              {(ratePrompt || ratingThanks) && (
                <div className="px-3.5 sm:px-4 pt-3 bg-[#E5D8CB] border-t border-[#D8C6B0]/60 shrink-0">
                  {ratingThanks && !ratePrompt ? (
                    <div role="status" className="flex items-center justify-between gap-3 rounded-[14px] bg-amber-100/90 border border-amber-300 px-4 py-2.5 text-xs text-amber-900">
                      <span>Thank you! Your rating has been submitted.</span>
                      <button type="button" onClick={() => setRatingThanks(false)} className="font-semibold hover:underline cursor-pointer">
                        Dismiss
                      </button>
                    </div>
                  ) : ratePrompt ? (
                    <div className="neu-recessed bg-[#E5D8CB] rounded-[16px] p-3.5 sm:p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <ScaleIcon className="w-4 h-4 text-[#C58B3C] shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="font-lora font-bold text-xs sm:text-[13.5px] text-[#34150F] leading-snug">
                              Would you like to rate {ratePrompt.lawyerName}?
                            </p>
                            <p className="font-inter text-[11px] text-[#7D6855] mt-0.5">
                              Your consultation on {ratePrompt.dateLabel} has ended. Your review helps other clients.
                            </p>
                          </div>
                        </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => dismissRating(ratePrompt.consultationId)}
                              className="px-3 py-1.5 rounded-[10px] font-inter text-[11px] font-semibold text-[#5C4535] hover:text-[#34150F] cursor-pointer"
                            >
                              Not now
                            </button>
                            <button
                              type="button"
                              onClick={() => setRatingOpen(true)}
                              className="neu-btn-caramel px-4 py-1.5 rounded-[10px] text-white text-[11px] font-inter font-semibold shadow-md active:scale-95 cursor-pointer"
                            >
                              Rate Lawyer
                            </button>
                          </div>
                      </div>

                      {ratingOpen && (
                        <ConsultationRatingDialog lawyerName={ratePrompt.lawyerName} busy={ratingBusy}
                          onClose={() => { setRatingOpen(false); setRatingError(null); }}>
                        <form onSubmit={submitRating} className="space-y-2.5">
                          <div className="flex items-center gap-1" role="radiogroup" aria-label="Star rating">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <button
                                key={s}
                                type="button"
                                role="radio"
                                aria-checked={ratingStars === s}
                                aria-label={`${s} star${s === 1 ? '' : 's'}`}
                                onClick={() => setRatingStars(s)}
                                className="p-0.5 cursor-pointer active:scale-90 transition"
                              >
                                <svg
                                  viewBox="0 0 20 20"
                                  className={`w-6 h-6 ${s <= ratingStars ? 'text-[#C58B3C] fill-[#C58B3C]' : 'text-[#CBB8A4] fill-transparent'}`}
                                  stroke="currentColor"
                                  strokeWidth="1.2"
                                >
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              </button>
                            ))}
                          </div>
                          <textarea
                            aria-label="Consultation feedback"
                            value={ratingComment}
                            onChange={(e) => setRatingComment(e.target.value)}
                            maxLength={5000}
                            rows={2}
                            disabled={ratingBusy}
                            placeholder="Share how the consultation went…"
                            className="w-full neu-recessed bg-[#E5D8CB] rounded-[12px] px-3.5 py-2.5 text-xs sm:text-[13px] font-lora text-[#34150F] placeholder-[#9A8270]/70 focus:outline-none focus:ring-2 focus:ring-[#B9833C]/40 resize-y"
                          />
                          {ratingError && (
                            <p role="alert" className="font-inter text-[11px] text-rose-800">{ratingError}</p>
                          )}
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled={ratingBusy}
                              onClick={() => { setRatingOpen(false); setRatingError(null); }}
                              className="px-3 py-1.5 rounded-[10px] font-inter text-[11px] font-semibold text-[#5C4535] hover:text-[#34150F] cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={ratingBusy}
                              className="neu-btn-caramel px-4 py-1.5 rounded-[10px] text-white text-[11px] font-inter font-semibold shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                              {ratingBusy ? 'Submitting…' : 'Submit Rating'}
                            </button>
                          </div>
                        </form>
                        </ConsultationRatingDialog>
                      )}
                    </div>
                  ) : null}
                </div>
              )}

              {/* Chat Input Bar */}
              <div className="p-3.5 sm:p-4 bg-[#E5D8CB] border-t border-[#D8C6B0]/60 shrink-0">
                <form onSubmit={handleSendMessage} className="flex items-center gap-2.5">
                  <div className="neu-recessed bg-[#E5D8CB] relative flex items-center flex-1 h-11 sm:h-12 rounded-[14px] px-3.5 sm:px-4 transition-all focus-within:ring-2 focus-within:ring-[#B9833C]/40">
                    <input
                      type="text"
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      placeholder="Type your confidential consultation message or query…"
                      className="w-full bg-transparent text-[#34150F] placeholder-[#9A8270]/70 font-lora text-xs sm:text-[13.5px] focus:outline-none font-normal"
                      disabled={sending}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={sending || !inputMessage.trim()}
                    className="neu-btn-caramel px-4.5 sm:px-5 py-2.5 sm:py-3 rounded-[12px] text-white text-xs font-inter font-semibold transition-all flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shrink-0"
                    aria-label="Send message"
                  >
                    <SendPaperPlaneIcon className="w-4 h-4 text-white" />
                    <span className="hidden sm:inline">{sending ? 'Sending…' : 'Send'}</span>
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>

      {reportTarget && (
        <ReportAccountModal
          threadId={reportTarget.threadId}
          targetName={reportTarget.name}
          targetRole={role === 'lawyer' ? 'client' : 'lawyer'}
          onClose={() => setReportTarget(null)}
        />
      )}
    </div>
  );
}

export default MessagesView;
