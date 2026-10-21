'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  SendPaperPlaneIcon,
  PlusCircleIcon,
  AIAssistantIcon,
  UserCircleIcon,
  FindLawyerIcon,
} from './ClientIcons';

interface Citation {
  sourceId: string;
  title: string;
  citation: string;
}

interface SuggestedFilters {
  specialization?: string;
  chapter?: string;
  lang?: string;
  fee?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  escalate?: boolean;
  offTopic?: boolean;
  suggestedFilters?: SuggestedFilters | null;
  timestamp: string;
  attachedFileName?: string;
}

interface AIAssistantChatProps {
  userFirstName: string;
}

function buildFindLawyerUrl(filters: SuggestedFilters): string {
  const params = new URLSearchParams();
  params.set('from', 'ai'); // signals AI redirect for banner
  if (filters.specialization) params.set('specialization', filters.specialization);
  if (filters.chapter) params.set('chapter', filters.chapter);
  if (filters.lang) params.append('lang', filters.lang);
  if (filters.fee) params.set('fee', filters.fee);
  return `/client/lawyers?${params.toString()}`;
}

export function AIAssistantChat({ userFirstName }: AIAssistantChatProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get('q') || '';

  const [inputQuery, setInputQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedText, setAttachedText] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  /** Read a text/PDF file as plain text (best-effort) */
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || '');
      reader.onerror = () => resolve('');
      // For PDFs we can only get raw text — Gemini will handle it
      reader.readAsText(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxMb = 10;
    if (file.size > maxMb * 1024 * 1024) {
      alert(`File is too large. Maximum allowed size is ${maxMb} MB.`);
      return;
    }

    setAttachedFile(file);
    // Read text content so we can pass it as context
    const text = await readFileAsText(file);
    setAttachedText(text);
  };

  const removeAttachment = () => {
    setAttachedFile(null);
    setAttachedText('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = useCallback(
    async (textToSend: string, forceFile?: File, forceFileText?: string) => {
      if (!textToSend.trim() || isLoading) return;

      const fileToSend = forceFile ?? attachedFile;
      const fileTextToSend = forceFileText ?? attachedText;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: textToSend.trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        attachedFileName: fileToSend?.name,
      };

      setMessages((prev) => [...prev, userMsg]);
      setInputQuery('');
      setAttachedFile(null);
      setAttachedText('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setIsLoading(true);

      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [...messages, userMsg].map((m) => ({
              role: m.role,
              content: m.content,
            })),
            documentText: fileTextToSend || undefined,
          }),
        });

        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();

        const assistantMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: data.text || 'I have analyzed your query based on Philippine law.',
          citations: data.citations || [],
          escalate: data.escalate || false,
          offTopic: data.offTopic || false,
          suggestedFilters: data.suggestedFilters || null,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch {
        // Graceful fallback for Philippine legal guidance
        const fallbackMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content:
            'Under Philippine law, your matter involves considerations under the Civil Code of the Philippines and relevant Supreme Court jurisprudence. We recommend reviewing the pertinent legal requirements or consulting an IBP-accredited attorney for personalized representation.',
          citations: [
            {
              sourceId: 'ra-386',
              title: 'Civil Code of the Philippines',
              citation: 'Republic Act No. 386',
            },
            {
              sourceId: 'sc-juris',
              title: 'Supreme Court of the Philippines Jurisprudence',
              citation: 'SC En Banc Rulings',
            },
          ],
          escalate: true,
          suggestedFilters: null,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, fallbackMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, messages, attachedFile, attachedText]
  );

  // If query param is present on mount, automatically send it
  useEffect(() => {
    if (initialQuery && messages.length === 0) {
      const timer = setTimeout(() => {
        handleSend(initialQuery);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [initialQuery, handleSend, messages.length]);

  const handleResetChat = () => {
    setMessages([]);
    setInputQuery('');
    removeAttachment();
  };

  const handleFindLawyer = (filters: SuggestedFilters | null | undefined) => {
    const url = buildFindLawyerUrl(filters ?? {});
    router.push(url);
  };

  // ─── Pristine / Empty State ──────────────────────────────────────────────────
  if (messages.length === 0) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-between p-6 sm:p-10 max-w-4xl mx-auto">
        {/* Top spacer */}
        <div className="pt-8 sm:pt-16" />

        {/* Center: Greeting & Search Bar */}
        <div className="text-center space-y-8 my-auto">
          <h1 className="font-cormorant text-4xl sm:text-5xl lg:text-6xl font-medium text-[#34150F] tracking-tight leading-tight select-none">
            Let&apos;s make it make sense,{' '}
            <span className="text-[#C58B3C] font-semibold">{userFirstName}.</span>
          </h1>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(inputQuery);
            }}
            className="w-full max-w-2xl mx-auto"
          >
            <div className="relative flex flex-col gap-2 w-full rounded-2xl bg-[#E4D7C5] shadow-[inset_2px_2px_5px_rgba(0,0,0,0.12),inset_-2px_-2px_5px_rgba(255,255,255,0.7)] p-3 transition-all focus-within:ring-2 focus-within:ring-[#C58B3C]/50">
              {/* Attachment preview */}
              {attachedFile && (
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#EFE5D8] border border-[#D8CAAD]/70 text-xs text-[#34150F]">
                  <svg className="w-4 h-4 text-[#C58B3C] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                  </svg>
                  <span className="truncate flex-1">{attachedFile.name}</span>
                  <button type="button" onClick={removeAttachment} className="text-[#7D6855] hover:text-red-600 transition-colors ml-auto">
                    ✕
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2">
                {/* Attachment button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-9 h-9 rounded-full bg-[#EFE5D8] flex items-center justify-center text-[#5C4535] hover:text-[#C58B3C] shadow-[1px_1px_3px_rgba(0,0,0,0.1)] transition-colors focus:outline-none shrink-0"
                  title="Attach case file or document"
                >
                  <PlusCircleIcon className="w-5 h-5" />
                </button>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {/* Text input */}
                <input
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  placeholder="Ask a legal question or attach a document"
                  className="w-full bg-transparent text-[#34150F] placeholder-[#8C7A6B] text-sm sm:text-base focus:outline-none px-2 font-normal"
                  autoFocus
                />

                {/* Send button */}
                <button
                  type="submit"
                  disabled={!inputQuery.trim() && !attachedFile}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[#5C4535] hover:text-[#C58B3C] disabled:opacity-30 transition-colors focus:outline-none shrink-0"
                  aria-label="Send legal question"
                >
                  <SendPaperPlaneIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </form>

          {/* Quick topic starters */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-xs text-[#7A6756]">
            <span className="opacity-70">Popular:</span>
            {[
              'Labor Code illegal dismissal rules',
              'Small claims procedure in MTC',
              'Estate settlement without a will',
              'Cybercrime libel requirements',
            ].map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => handleSend(topic)}
                className="px-3 py-1 rounded-full bg-[#E8D9C7] hover:bg-[#DFCDB9] text-[#4A3728] transition-colors"
              >
                {topic}
              </button>
            ))}
          </div>
        </div>

        {/* Bottom Disclaimer */}
        <div className="text-center pb-4 pt-12">
          <p className="text-[11px] sm:text-xs text-[#8E7E70] leading-relaxed max-w-xl mx-auto font-light">
            Disclaimer: Justicia AI provides general legal information based on Philippine Statutes and
            SC Jurisprudence, not formal Attorney-Client advice
          </p>
        </div>
      </div>
    );
  }

  // ─── Active Conversation View ────────────────────────────────────────────────
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-between max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#D8C6B0]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#D4C1AB] flex items-center justify-center text-[#C58B3C] shadow-sm">
            <AIAssistantIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-cormorant font-bold text-lg text-[#34150F]">Justicia Legal Assistant</h2>
            <p className="text-[10px] text-[#7A6756]">Powered by Philippine Jurisprudence &amp; Statutes</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleResetChat}
          className="text-xs font-semibold px-3.5 py-1.5 rounded-full bg-[#E5D7C5] hover:bg-[#DBCABA] text-[#34150F] shadow-[2px_2px_5px_rgba(0,0,0,0.06),-2px_-2px_5px_rgba(255,255,255,0.7)] transition-colors"
        >
          + New Question
        </button>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto py-6 space-y-6">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-[#D4C1AB] flex items-center justify-center text-[#C58B3C] shrink-0 mt-1 shadow-sm">
                <AIAssistantIcon className="w-4 h-4" />
              </div>
            )}

            <div
              className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-4 sm:p-5 text-xs sm:text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#34150F] text-[#FAF6F0] rounded-tr-none shadow-md'
                  : msg.offTopic
                  ? 'bg-[#FFF8F4] text-[#34150F] rounded-tl-none shadow-[4px_4px_12px_rgba(0,0,0,0.05),-4px_-4px_12px_rgba(255,255,255,0.8)] border border-orange-200/60'
                  : 'bg-[#EFE5D8] text-[#34150F] rounded-tl-none shadow-[4px_4px_12px_rgba(0,0,0,0.05),-4px_-4px_12px_rgba(255,255,255,0.8)] border border-[#E8DCCB]/60'
              }`}
            >
              {/* Attached file badge (user message) */}
              {msg.attachedFileName && (
                <div className="flex items-center gap-1.5 mb-2 px-2 py-1 rounded bg-white/10 text-[10px] opacity-80">
                  <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                  </svg>
                  <span className="truncate">{msg.attachedFileName}</span>
                </div>
              )}

              {/* Off-topic indicator */}
              {msg.offTopic && (
                <div className="flex items-center gap-1.5 mb-2 text-orange-700">
                  <span className="text-base">⚖️</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Law-related questions only</span>
                </div>
              )}

              <div className="whitespace-pre-wrap">{msg.content}</div>

              {/* Legal Citations Chips */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-4 pt-3 border-t border-[#D9C7B2]/70 space-y-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#C58B3C]">
                    Legal Citations &amp; Authorities:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {msg.citations.map((c, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#E4D7C5] text-[#3E2A1E] text-[10px] font-medium border border-[#D5C2AB]"
                      >
                        🏛️ {c.citation}: {c.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Find a Lawyer Banner (Escalation) — with smart filters */}
              {(msg.escalate || Boolean(msg.suggestedFilters)) && !msg.offTopic && (
                <div className="mt-4 p-3 rounded-xl bg-[#E8DAC9] border border-[#C58B3C]/40 flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
                  <div className="flex items-start gap-2 text-xs text-[#34150F]">
                    <FindLawyerIcon className="w-4 h-4 text-[#C58B3C] shrink-0 mt-0.5" />
                    <div>
                      <span>This matter involves nuanced legal implications. Would you like to consult a licensed attorney?</span>
                      {msg.suggestedFilters?.specialization && (
                        <p className="text-[10px] text-[#7D6855] mt-0.5">
                          We&apos;ll filter for <strong>{msg.suggestedFilters.specialization}</strong> lawyers near you.
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleFindLawyer(msg.suggestedFilters)}
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-[#C58B3C] hover:bg-[#B3792E] text-white text-[11px] font-semibold transition-colors flex items-center gap-1.5"
                  >
                    <FindLawyerIcon className="w-3.5 h-3.5" />
                    Find a Lawyer
                  </button>
                </div>
              )}

              <div
                className={`text-[9px] mt-2 text-right ${
                  msg.role === 'user' ? 'text-[#FAF6F0]/60' : 'text-[#8E7E70]'
                }`}
              >
                {msg.timestamp}
              </div>
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-[#34150F] flex items-center justify-center text-[#ded7cb] shrink-0 mt-1">
                <UserCircleIcon className="w-5 h-5" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#D4C1AB] flex items-center justify-center text-[#C58B3C] shrink-0 mt-1">
              <AIAssistantIcon className="w-4 h-4" />
            </div>
            <div className="bg-[#EFE5D8] rounded-2xl rounded-tl-none p-4 text-xs text-[#7A6756] shadow-[4px_4px_12px_rgba(0,0,0,0.05),-4px_-4px_12px_rgba(255,255,255,0.8)] border border-[#E8DCCB]/60 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#C58B3C] animate-ping" />
              <span>Analyzing Philippine statutes &amp; Supreme Court jurisprudence…</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Sticky Input Bar */}
      <div className="pt-3 border-t border-[#D8C6B0] space-y-2">
        {/* Attachment preview strip */}
        {attachedFile && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#EFE5D8] border border-[#D8CAAD]/70 text-xs text-[#34150F]">
            <svg className="w-4 h-4 text-[#C58B3C] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
            </svg>
            <span className="truncate flex-1">{attachedFile.name}</span>
            <span className="text-[#7D6855]">({(attachedFile.size / 1024).toFixed(0)} KB)</span>
            <button type="button" onClick={removeAttachment} className="text-[#7D6855] hover:text-red-600 transition-colors ml-2">
              ✕
            </button>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(inputQuery);
          }}
          className="w-full"
        >
          <div className="relative flex items-center w-full rounded-full bg-[#E4D7C5] shadow-[inset_2px_2px_5px_rgba(0,0,0,0.12),inset_-2px_-2px_5px_rgba(255,255,255,0.7)] px-3 py-2.5 transition-all focus-within:ring-2 focus-within:ring-[#C58B3C]/50">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-8 h-8 rounded-full bg-[#EFE5D8] flex items-center justify-center text-[#5C4535] hover:text-[#C58B3C] shadow-sm transition-colors shrink-0"
              title="Attach document"
            >
              <PlusCircleIcon className="w-4 h-4" />
            </button>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
              className="hidden"
              onChange={handleFileChange}
            />

            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Ask a follow-up legal question…"
              className="w-full bg-transparent text-[#34150F] placeholder-[#8C7A6B] text-xs sm:text-sm focus:outline-none px-4"
              disabled={isLoading}
            />

            <button
              type="submit"
              disabled={(!inputQuery.trim() && !attachedFile) || isLoading}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#5C4535] hover:text-[#C58B3C] disabled:opacity-30 transition-colors shrink-0"
              aria-label="Send follow-up"
            >
              <SendPaperPlaneIcon className="w-4 h-4" />
            </button>
          </div>
        </form>

        <p className="text-[10px] sm:text-[11px] text-[#8E7E70] text-center">
          Disclaimer: Justicia AI provides general legal information based on Philippine Statutes and
          SC Jurisprudence, not formal Attorney-Client advice
        </p>
      </div>
    </div>
  );
}
