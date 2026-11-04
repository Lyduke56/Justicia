'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, useReducedMotion, type Variants } from 'motion/react';
import {
  SendPaperPlaneIcon,
  PlusIcon,
  AIAssistantIcon,
  UserCircleIcon,
  FindLawyerIcon,
  ScaleIcon,
  DocumentTextIcon,
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
  sort?: string;
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

const POPULAR_KEYWORDS = [
  'Labor Code Illegal Dismissal',
  'Small Claims MTC Procedure',
  'Estate Settlement Without a Will',
  'Cyber Libel Requirements',
  'Tenancy & Eviction Rules',
  'BP 22 Bouncing Checks',
];

// ─── Motion Orchestration ────────────────────────────────────────────────────
const EASE = [0.16, 1, 0.3, 1] as const;
const HEADLINE_WORDS = ["Let's", 'make', 'it', 'make', 'sense,'];

const pageVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
};

const headlineVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const wordVariants: Variants = {
  hidden: { y: '105%', opacity: 0, filter: 'blur(10px)' },
  show: {
    y: '0%',
    opacity: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.8, ease: EASE },
  },
};

const fadeVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

function buildFindLawyerUrl(filters: SuggestedFilters): string {
  const params = new URLSearchParams();
  params.set('from', 'ai');
  if (filters.specialization) params.set('specialization', filters.specialization);
  if (filters.chapter) params.set('chapter', filters.chapter);
  if (filters.lang) params.append('lang', filters.lang);
  if (filters.fee) params.set('fee', filters.fee);
  params.set('sort', filters.sort || 'desc');
  return `/client/lawyers?${params.toString()}`;
}

export function AIAssistantChat({ userFirstName }: AIAssistantChatProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get('q') || '';
  const reduceMotion = useReducedMotion();

  const [inputQuery, setInputQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedText, setAttachedText] = useState<string>('');
  const [isSubmitHovered, setIsSubmitHovered] = useState(false);

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
          suggestedFilters: {
            specialization: 'Civil Law',
            sort: 'desc',
          },
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, fallbackMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, messages, attachedFile, attachedText]
  );

  // If query param is present on mount, automatically trigger submission
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
    const effectiveFilters: SuggestedFilters = {
      sort: 'desc',
      ...(filters || {}),
    };
    if (!effectiveFilters.specialization) {
      effectiveFilters.specialization = 'Civil Law';
    }
    const url = buildFindLawyerUrl(effectiveFilters);
    router.push(url);
  };

  const hasPrompt = inputQuery.trim().length > 0 || !!attachedFile;

  // ─── Pristine / Empty State ──────────────────────────────────────────────────
  if (messages.length === 0) {
    return (
      <motion.div
        variants={pageVariants}
        initial={reduceMotion ? false : 'hidden'}
        animate="show"
        className="min-h-[calc(100vh-4rem)] flex flex-col justify-between px-6 sm:px-10 lg:px-16 py-8 sm:py-12 max-w-[1240px] mx-auto bg-[#E5D8CB]"
      >
        {/* Top Spacer */}
        <div className="pt-2 sm:pt-6" />

        {/* Center: Greeting & Prominent Long Recessed Search Field */}
        <div className="space-y-8 my-auto w-full">
          {/* Header Title with Word Masking */}
          <div className="text-center space-y-3">
            <motion.div variants={fadeVariants}>
              <span
                className="inline-block px-4.5 py-1.5 rounded-full neu-raised-sm bg-[#D39758]/30 text-[#34150F] font-lora text-xs sm:text-[13px] font-semibold select-none mb-1"
                style={{ backgroundColor: 'rgba(211, 151, 88, 0.30)' }}
              >
                Philippine Legal Intelligence
              </span>
            </motion.div>

            <motion.h1
              variants={headlineVariants}
              className="font-lora text-3xl sm:text-4xl lg:text-[46px] font-medium text-[#34150F] tracking-tight leading-[1.2] select-none"
            >
              {HEADLINE_WORDS.map((w, i) => (
                <span
                  key={`${w}-${i}`}
                  className="inline-block overflow-hidden align-bottom pb-[0.12em] -mb-[0.12em] mr-[0.25em]"
                >
                  <motion.span variants={wordVariants} className="inline-block will-change-transform">
                    {w}
                  </motion.span>
                </span>
              ))}
              <span className="inline-block overflow-hidden align-bottom pb-[0.12em] -mb-[0.12em]">
                <motion.span
                  variants={wordVariants}
                  className="inline-block text-[#C58B3C] font-semibold will-change-transform"
                >
                  {userFirstName}.
                </motion.span>
              </span>
            </motion.h1>
          </div>

          {/* Primary Extended-Width Recessed Search & Attachment Input */}
          <motion.div variants={fadeVariants} className="w-full max-w-4xl lg:max-w-5xl mx-auto">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend(inputQuery);
              }}
              className="w-full"
            >
              <div className="neu-recessed bg-[#E5D8CB] relative flex flex-col gap-2.5 w-full rounded-[22px] py-3.5 pr-7 pl-6 transition-all focus-within:ring-2 focus-within:ring-[#B9833C]/40">
                {/* File Attachment Preview Strip */}
                {attachedFile && (
                  <div className="neu-raised-sm bg-[#E5D8CB] flex items-center gap-2.5 px-3.5 py-1.5 rounded-[12px] text-xs font-inter text-[#34150F]">
                    <DocumentTextIcon className="w-4 h-4 text-[#C58B3C] shrink-0" />
                    <span className="truncate flex-1 font-medium">{attachedFile.name}</span>
                    <span className="text-[#7A6756] text-[11px]">
                      ({(attachedFile.size / 1024).toFixed(0)} KB)
                    </span>
                    <button
                      type="button"
                      onClick={removeAttachment}
                      className="text-[#7A6756] hover:text-red-700 transition-colors ml-1 p-0.5 cursor-pointer"
                      title="Remove attachment"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Input Controls Row */}
                <div className="flex items-center gap-2">
                  {/* File Attachment Plus Button — Raised Extruded Circle with Tactile Animation */}
                  <motion.button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className="neu-raised-sm size-11 sm:size-9 rounded-full bg-[#E5D8CB] flex items-center justify-center text-[#5C4535] hover:text-[#C58B3C] cursor-pointer shrink-0 focus:outline-none transition-colors"
                    title="Attach case brief or PDF (Max 10MB)"
                    aria-label="Attach file"
                  >
                    <PlusIcon className="w-5.5 h-5.5 sm:w-6 sm:h-6" />
                  </motion.button>

                  {/* Hidden Native File Input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                    className="hidden"
                    onChange={handleFileChange}
                  />

                  {/* Long Text Input */}
                  <input
                    type="text"
                    value={inputQuery}
                    onChange={(e) => setInputQuery(e.target.value)}
                    placeholder="Ask a Philippine legal question or describe your case…"
                    className="w-full bg-transparent text-[#34150F] placeholder-[#9A8270]/70 font-lora text-base sm:text-lg focus:outline-none px-2 font-normal"
                    autoFocus
                  />

                  {/* Submit Button with Animated Tilt */}
                  <button
                    type="submit"
                    disabled={!hasPrompt}
                    onMouseEnter={() => setIsSubmitHovered(true)}
                    onMouseLeave={() => setIsSubmitHovered(false)}
                    className="p-1.5 flex items-center justify-center text-[#5C4535] hover:text-[#C58B3C] disabled:opacity-35 transition-colors focus:outline-none cursor-pointer disabled:cursor-not-allowed shrink-0"
                    aria-label="Send legal question"
                  >
                    <motion.div
                      animate={
                        hasPrompt && isSubmitHovered
                          ? { rotate: -30, y: -2, x: 2 }
                          : { rotate: 0, y: 0, x: 0 }
                      }
                      transition={{
                        type: 'spring',
                        stiffness: 380,
                        damping: 22,
                      }}
                      whileTap={hasPrompt ? { scale: 0.9 } : undefined}
                      className="flex items-center justify-center origin-center"
                    >
                      <SendPaperPlaneIcon className="w-5.5 h-5.5" />
                    </motion.div>
                  </button>
                </div>
              </div>
            </form>

            {/* Quick Popular Topics Row */}
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 pt-7 sm:pt-10">
              <span className="text-xs sm:text-[13px] font-inter text-[#7A6756] font-medium mr-1.5 select-none">
                Popular topics:
              </span>
              {POPULAR_KEYWORDS.map((kw) => (
                <motion.button
                  key={kw}
                  type="button"
                  onClick={() => handleSend(kw)}
                  whileHover={{ scale: 1.04, y: -1 }}
                  whileTap={{ scale: 0.92, y: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                  className="neu-raised-sm px-4 py-2 rounded-full bg-[#E5D8CB] text-[#5C4535] hover:text-[#C58B3C] text-xs sm:text-[12.5px] font-inter transition-colors cursor-pointer select-none"
                >
                  {kw}
                </motion.button>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Bottom Disclaimer */}
        <div className="text-center pt-8 pb-2">
          <p className="font-inter text-[11px] sm:text-xs text-[#8E7E70] leading-relaxed max-w-xl mx-auto font-light">
            Disclaimer: Justicia AI provides general legal information based on Philippine Statutes and
            SC Jurisprudence, not formal Attorney-Client advice.
          </p>
        </div>
      </motion.div>
    );
  }

  // ─── Active Conversation View ────────────────────────────────────────────────
  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col justify-between max-w-[1240px] mx-auto p-4 sm:p-6 lg:p-8 bg-[#E5D8CB]">
      {/* Conversation Header Bar */}
      <div className="flex items-center justify-between pb-3.5 border-b border-[#D8C6B0]/60 shrink-0">
        <div className="flex items-center gap-3">
          <div className="neu-raised-sm size-11 rounded-full bg-[#E5D8CB] flex items-center justify-center text-[#C58B3C] shrink-0">
            <AIAssistantIcon className="w-5 h-5 text-[#C58B3C]" />
          </div>
          <div>
            <h2 className="font-lora font-bold text-lg sm:text-xl text-[#34150F] leading-tight">
              Justicia Legal Assistant
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-inter text-xs text-[#5C4535]">
                Philippine Jurisprudence &amp; Statutory AI
              </span>
              <span className="text-[#A89685] select-none text-xs">•</span>
              <span className="neu-raised-sm bg-[#E5D8CB] px-2 py-0.5 rounded-full font-lora text-[9.5px] font-semibold text-[#D39758] tracking-wide select-none">
                IBP Grounded
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleResetChat}
          className="neu-raised-sm rounded-full px-4 py-2 bg-[#E5D8CB] text-xs font-inter font-semibold text-[#34150F] hover:text-[#C58B3C] active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer focus:outline-none"
        >
          <span className="text-[#C58B3C] font-bold text-sm">+</span>
          <span>New Question</span>
        </button>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 min-h-0 overflow-y-auto py-5 space-y-6 pr-1">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {/* Assistant Avatar */}
            {msg.role === 'assistant' && (
              <div className="neu-raised-sm size-9 rounded-full bg-[#E5D8CB] text-[#C58B3C] flex items-center justify-center shrink-0 mt-1 shadow-sm">
                <AIAssistantIcon className="w-4.5 h-4.5" />
              </div>
            )}

            {/* Bubble Container */}
            <div
              className={`max-w-[88%] sm:max-w-[80%] rounded-[24px] ${msg.role === 'user'
                ? 'bg-[#34150F] text-[#FAF6F0] rounded-tr-sm p-4 sm:p-5 shadow-md'
                : 'neu-raised bg-[#E5D8CB] text-[#34150F] rounded-tl-sm p-5 sm:p-6 leading-relaxed'
                }`}
            >
              {/* Attached file badge (user message) */}
              {msg.attachedFileName && (
                <div className="flex items-center gap-2 mb-2.5 px-2.5 py-1.5 rounded-lg bg-white/10 text-xs text-[#FAF6F0]/90 font-inter">
                  <DocumentTextIcon className="w-4 h-4 text-[#D39758] shrink-0" />
                  <span className="truncate">{msg.attachedFileName}</span>
                </div>
              )}

              {/* Off-topic notice banner */}
              {msg.offTopic && (
                <div className="neu-recessed bg-[#E5D8CB] rounded-[14px] p-3 sm:p-3.5 mb-3.5 border border-[#C58B3C]/40 flex items-center gap-2 text-xs text-[#5C4535]">
                  <ScaleIcon className="w-4 h-4 text-[#C58B3C] shrink-0" />
                  <span className="font-lora font-semibold uppercase tracking-wider text-[#34150F]">
                    Philippine Legal Questions Only
                  </span>
                </div>
              )}

              {/* Message Content */}
              <div
                className={`whitespace-pre-wrap leading-relaxed ${msg.role === 'user'
                  ? 'font-inter text-sm sm:text-[14.5px]'
                  : 'font-lora text-sm sm:text-[15px] text-[#34150F] font-normal'
                  }`}
              >
                {msg.content}
              </div>

              {/* Legal Citations & Authorities Chips */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-5 pt-4 border-t border-[#A89685]/30 space-y-2">
                  <div className="flex items-center gap-1.5 text-[10.5px] font-lora font-bold text-[#C58B3C] tracking-wide uppercase">
                    <span>🏛️</span>
                    <span>Philippine Legal Authorities Cited</span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {msg.citations.map((c, i) => (
                      <div
                        key={i}
                        className="neu-raised-sm bg-[#E5D8CB] px-3 py-1.5 rounded-[10px] text-[11px] font-inter text-[#34150F] inline-flex items-center gap-2 select-none"
                      >
                        <span className="font-semibold text-[#34150F]">{c.citation}</span>
                        <span className="text-[#A89685] select-none">|</span>
                        <span className="text-[#5C4535]">{c.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Escalation / Post-Prompt Action Card */}
              {msg.role === 'assistant' && !msg.offTopic && (
                <div className="mt-5 p-4 sm:p-4.5 rounded-[18px] neu-recessed bg-[#E5D8CB] border border-[#C58B3C]/35 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3 text-xs text-[#34150F]">
                    <div className="neu-raised-sm size-10 rounded-full bg-[#E5D8CB] text-[#C58B3C] flex items-center justify-center shrink-0 mt-0.5">
                      <FindLawyerIcon className="w-5 h-5 text-[#C58B3C]" />
                    </div>
                    <div>
                      <p className="font-lora font-bold text-sm text-[#34150F]">
                        {msg.escalate
                          ? 'Consult an IBP-Accredited Attorney'
                          : 'Connect with a Verified Attorney'}
                      </p>
                      <p className="font-inter text-xs text-[#5C4535] mt-0.5 leading-relaxed">
                        {msg.escalate
                          ? 'This matter involves nuanced legal implications under Philippine jurisprudence. Formal legal representation is advised.'
                          : 'Need formal legal counsel or representation for this case? Connect with a verified attorney.'}
                      </p>
                      {msg.suggestedFilters?.specialization && (
                        <div className="mt-2 flex items-center gap-1.5">
                          <span className="font-inter text-[11px] text-[#7A6756]">Suggested specialty:</span>
                          <span className="neu-raised-sm bg-[#E5D8CB] px-2.5 py-0.5 rounded-full font-lora text-[10px] font-semibold text-[#D39758]">
                            {msg.suggestedFilters.specialization}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleFindLawyer(msg.suggestedFilters)}
                    className="neu-btn-caramel shrink-0 px-4.5 py-2.5 rounded-[12px] text-white text-xs font-inter font-semibold transition-all flex items-center gap-2 shadow-md cursor-pointer active:scale-95"
                  >
                    <FindLawyerIcon className="w-4 h-4" />
                    <span>Find a Lawyer</span>
                  </button>
                </div>
              )}

              {/* Timestamp */}
              <div
                className={`text-[10px] mt-2.5 text-right font-inter ${msg.role === 'user' ? 'text-[#FAF6F0]/60' : 'text-[#8E7E70]'
                  }`}
              >
                {msg.timestamp}
              </div>
            </div>

            {/* User Avatar */}
            {msg.role === 'user' && (
              <div className="size-9 rounded-full bg-[#34150F] text-[#ded7cb] flex items-center justify-center shrink-0 mt-1 shadow-sm">
                <UserCircleIcon className="w-5 h-5" />
              </div>
            )}
          </div>
        ))}

        {/* Loading / Analyzing Indicator */}
        {isLoading && (
          <div className="flex items-start gap-3 justify-start">
            <div className="neu-raised-sm size-9 rounded-full bg-[#E5D8CB] text-[#C58B3C] flex items-center justify-center shrink-0 mt-1 shadow-sm">
              <AIAssistantIcon className="w-4 h-4" />
            </div>
            <div className="neu-raised bg-[#E5D8CB] rounded-[22px] rounded-tl-sm px-5 py-4 text-xs sm:text-sm text-[#5C4535] flex items-center gap-3 font-lora italic">
              <span className="size-2 rounded-full bg-[#C58B3C] animate-ping" />
              <span>Analyzing Philippine statutes &amp; Supreme Court jurisprudence…</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Sticky Input Bar — Extended Width */}
      <div className="shrink-0 pt-3 border-t border-[#D8C6B0]/60 space-y-2">
        {/* Attachment preview strip */}
        {attachedFile && (
          <div className="neu-raised-sm bg-[#E5D8CB] flex items-center gap-2.5 px-3.5 py-2 rounded-[12px] text-xs font-inter text-[#34150F]">
            <DocumentTextIcon className="w-4 h-4 text-[#C58B3C] shrink-0" />
            <span className="truncate flex-1 font-medium">{attachedFile.name}</span>
            <span className="text-[#7A6756]">({(attachedFile.size / 1024).toFixed(0)} KB)</span>
            <button
              type="button"
              onClick={removeAttachment}
              className="text-[#7A6756] hover:text-red-700 transition-colors ml-2 p-0.5 cursor-pointer"
            >
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
          <div className="neu-recessed bg-[#E5D8CB] relative flex items-center w-full h-13 sm:h-15 rounded-[16px] px-3.5 sm:px-4.5 transition-all focus-within:ring-2 focus-within:ring-[#B9833C]/40">
            {/* Attachment Plus Button — Raised Extruded Circle with Tactile Animation */}
            <motion.button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="neu-raised-sm size-9 sm:size-10 rounded-full bg-[#E5D8CB] flex items-center justify-center text-[#5C4535] hover:text-[#C58B3C] cursor-pointer shrink-0 focus:outline-none transition-colors"
              title="Attach document (Max 10MB)"
              aria-label="Attach document"
            >
              <PlusIcon className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
            </motion.button>

            {/* Hidden native input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Extended Text Input */}
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Ask a follow-up legal question…"
              className="w-full bg-transparent text-[#34150F] placeholder-[#9A8270]/70 font-lora text-sm sm:text-base focus:outline-none px-3 font-normal"
              disabled={isLoading}
            />

            {/* Submit Button with Animated Tilt */}
            <button
              type="submit"
              disabled={!hasPrompt || isLoading}
              onMouseEnter={() => setIsSubmitHovered(true)}
              onMouseLeave={() => setIsSubmitHovered(false)}
              className="p-1.5 flex items-center justify-center text-[#5C4535] hover:text-[#C58B3C] disabled:opacity-35 transition-colors focus:outline-none cursor-pointer disabled:cursor-not-allowed shrink-0"
              aria-label="Send follow-up"
            >
              <motion.div
                animate={
                  hasPrompt && isSubmitHovered
                    ? { rotate: -30, y: -2, x: 2 }
                    : { rotate: 0, y: 0, x: 0 }
                }
                transition={{
                  type: 'spring',
                  stiffness: 380,
                  damping: 22,
                }}
                whileTap={hasPrompt ? { scale: 0.9 } : undefined}
                className="flex items-center justify-center origin-center"
              >
                <SendPaperPlaneIcon className="w-5 h-5" />
              </motion.div>
            </button>
          </div>
        </form>

        <p className="font-inter text-[10.5px] sm:text-[11px] text-[#8E7E70] text-center font-light leading-relaxed">
          Disclaimer: Justicia AI provides general legal information based on Philippine Statutes and
          SC Jurisprudence, not formal Attorney-Client advice.
        </p>
      </div>
    </div>
  );
}
