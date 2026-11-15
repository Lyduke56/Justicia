'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MessagesIcon, ScaleIcon, SendPaperPlaneIcon } from '@/components/client/ClientIcons';
import {
  getMessageThreadsAction,
  getMessagesForThreadAction,
  sendDirectMessageAction,
} from '@/app/actions/consultationActions';

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
}

export function MessagesView({ role = 'client' }: { role?: 'client' | 'lawyer' } = {}) {
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [messages, setMessages] = useState<Record<string, MessageItem[]>>({});
  const [sending, setSending] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load threads (and refresh them periodically so new conversations / last messages show up).
  useEffect(() => {
    let active = true;
    // Deep link from "Message Client" / "Message Channel": /…/messages?thread=<consultationId>
    const requestedThread =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('thread') : null;

    const loadThreads = () =>
      getMessageThreadsAction().then((dbThreads) => {
        if (!active) return;
        const list = Array.isArray(dbThreads) ? dbThreads : [];
        setThreads(list);
        setActiveThreadId((current) => {
          if (current && list.some((t) => t.id === current)) return current;
          if (requestedThread && list.some((t) => t.id === requestedThread)) return requestedThread;
          return list[0]?.id ?? null;
        });
      });

    loadThreads();
    const timer = setInterval(loadThreads, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [role]);

  // Load messages for the active thread and poll for replies from the other party.
  useEffect(() => {
    if (!activeThreadId) return;
    let active = true;
    const loadMessages = () =>
      getMessagesForThreadAction(activeThreadId).then((loadedMsgs) => {
        if (!active) return;
        setMessages((prev) => ({
          ...prev,
          [activeThreadId]: Array.isArray(loadedMsgs) ? loadedMsgs : [],
        }));
      });
    loadMessages();
    const timer = setInterval(loadMessages, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [activeThreadId]);

  // Auto-scroll messages stream to bottom when active messages change
  const activeMessages = (activeThreadId && messages[activeThreadId]) || [];
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages.length, activeThreadId]);

  const activeThread = threads.find((t) => t.id === activeThreadId) || threads[0];

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
                    onClick={() => setActiveThreadId(thread.id)}
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
              </div>

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
    </div>
  );
}

export default MessagesView;
