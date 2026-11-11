'use client';

import React, { useState, useEffect } from 'react';
import { MessagesIcon } from '@/components/client/ClientIcons';
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

  const activeThread = threads.find((t) => t.id === activeThreadId) || threads[0];
  const activeMessages = (activeThreadId && messages[activeThreadId]) || [];

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
    <div className="p-4 sm:p-8 lg:p-10 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="font-cormorant text-3xl sm:text-4xl font-medium text-[#34150F]">
          Privileged <span className="text-[#C58B3C]">Messages</span>
        </h1>
        <p className="text-xs sm:text-sm text-[#7D6855] mt-0.5">
          Confidential attorney-client consultation communication protected by Philippine legal privilege.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 min-h-[550px] items-stretch">
        {/* Left Column: Thread List (4 cols) */}
        <div
          className="md:col-span-4 rounded-3xl p-4 bg-[#EFE5D8] border border-[#E8DCCB] space-y-3 flex flex-col"
          style={{ boxShadow: '6px 6px 14px rgba(0,0,0,0.05), -6px -6px 14px rgba(255,255,255,0.9)' }}
        >
          <div className="flex items-center justify-between pb-2 border-b border-[#D8CAAD]/60 px-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5C4535]">
              Active Consultations ({threads.length})
            </span>
          </div>

          <div className="space-y-2 flex-1 overflow-y-auto">
            {threads.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <MessagesIcon className="w-8 h-8 text-[#A69584] mx-auto mb-2 opacity-60" />
                <p className="text-xs font-semibold text-[#5C4535]">No Active Consultations</p>
                <p className="text-[11px] text-[#8C7A6B] mt-1">
                  Once a consultation is booked and confirmed by an attorney, a privileged communication channel will appear here.
                </p>
              </div>
            ) : (
              threads.map((thread) => {
                const isSelected = activeThreadId === thread.id;
                return (
                  <div
                    key={thread.id}
                    onClick={() => setActiveThreadId(thread.id)}
                    className={`p-3.5 rounded-2xl cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[#DFC5A4] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.12)] border border-[#C8B59E]'
                        : 'bg-[#F5EDE2] hover:bg-[#E8DCCB] border border-[#E5D7C5]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-cormorant font-bold text-sm text-[#34150F] truncate">
                        {thread.name}
                      </h3>
                      <span className="text-[10px] text-[#8C7A6B] shrink-0 font-medium">
                        {thread.time}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#6E5948] mt-1 truncate">
                      {thread.lastMessage}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Chat Window (8 cols) */}
        <div
          className="md:col-span-8 rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB] flex flex-col justify-between overflow-hidden"
          style={{ boxShadow: '6px 6px 16px rgba(0,0,0,0.06), -6px -6px 16px rgba(255,255,255,0.9)' }}
        >
          {threads.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#F5EDE2]/50">
              <div className="w-16 h-16 rounded-full bg-[#E5D7C5] flex items-center justify-center text-2xl mb-3 text-[#5C4535] shadow-inner">
                ⚖
              </div>
              <h3 className="font-cormorant text-xl font-bold text-[#34150F]">
                No Message Thread Selected
              </h3>
              <p className="text-xs text-[#7D6855] max-w-sm mt-1 leading-relaxed">
                Book a consultation with an attorney or check pending requests. Once approved, you can share evidence, briefs, and follow-up queries here.
              </p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="p-4 sm:p-5 bg-[#E5D7C5] border-b border-[#D8CAAD] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#D4C1AB] text-[#34150F] font-bold text-sm flex items-center justify-center border border-[#C8B59E]">
                    {activeThread?.name?.charAt(0) || '⚖'}
                  </div>
                  <div>
                    <h2 className="font-cormorant font-bold text-base text-[#34150F]">
                      {activeThread?.name || 'Active Session'}
                    </h2>
                    <span className="text-[10px] font-semibold text-emerald-800 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Encrypted & Privileged Attorney Channel
                    </span>
                  </div>
                </div>
              </div>

              {/* Messages Scroll Area */}
              <div className="p-5 sm:p-6 space-y-4 flex-1 overflow-y-auto max-h-[420px] bg-[#F5EDE2]/50">
                {activeMessages.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#8C7A6B]">
                    No messages in this consultation yet. Start the conversation below.
                  </div>
                ) : (
                  activeMessages.map((msg) => {
                    if (msg.sender === 'system') {
                      return (
                        <div key={msg.id} className="text-center my-2">
                          <span className="inline-block px-4 py-1.5 rounded-full bg-[#E5D7C5] text-[10px] font-semibold text-[#5C4535] border border-[#D8CAAD]">
                            ⚖ {msg.content}
                          </span>
                        </div>
                      );
                    }

                    const isMe = msg.sender === 'me';
                    return (
                      <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <div
                          className={`max-w-md p-3.5 rounded-2xl text-xs sm:text-[13px] leading-relaxed shadow-sm ${
                            isMe
                              ? 'bg-[#23150F] text-[#ded7cb] rounded-br-xs'
                              : 'bg-[#E5D7C5] text-[#34150F] border border-[#D8CAAD] rounded-bl-xs'
                          }`}
                        >
                          {msg.content}
                        </div>
                        <span className="text-[9px] text-[#A69584] mt-1 px-1">{msg.time}</span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Chat Input Bar */}
              <form onSubmit={handleSendMessage} className="p-4 bg-[#E5D7C5] border-t border-[#D8CAAD] flex items-center gap-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Type your confidential consultation message or query..."
                  className="flex-1 rounded-2xl py-2.5 px-4 bg-[#F5EDE2] text-xs text-[#23150F] placeholder-[#8C7A6B] focus:outline-none border border-[#D8CAAD]"
                />
                <button
                  type="submit"
                  disabled={sending || !inputMessage.trim()}
                  className="px-5 py-2.5 rounded-2xl bg-[#C58B3C] text-white hover:bg-[#B3792E] text-xs font-bold transition disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  Send
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default MessagesView;
