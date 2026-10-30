'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  MOCK_ADMIN_AI_CONFIG,
  MOCK_ADMIN_AI_QUERIES,
  type AdminAIConfig,
  type AdminAISampleQuery,
} from '@/lib/mock/adminMockData';
import { SparklesIcon, ShieldCheckIcon } from '@/components/admin/AdminIcons';

function SlidersIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
}

function CheckIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function AlertTriangleIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function AdminAIManagementView() {
  const [config, setConfig] = useState<AdminAIConfig>(MOCK_ADMIN_AI_CONFIG);
  const [queries, setQueries] = useState<AdminAISampleQuery[]>(MOCK_ADMIN_AI_QUERIES);
  const [newKeyword, setNewKeyword] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSaveConfig = () => {
    showToast('AI pipeline configuration saved and pushed to Gemini runtime.');
  };

  const handleAddKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;
    if (config.escalationKeywords.includes(newKeyword.trim())) return;
    setConfig((prev) => ({
      ...prev,
      escalationKeywords: [...prev.escalationKeywords, newKeyword.trim()],
    }));
    setNewKeyword('');
    showToast(`Added "${newKeyword.trim()}" to escalation triggers.`);
  };

  const handleRemoveKeyword = (keyword: string) => {
    setConfig((prev) => ({
      ...prev,
      escalationKeywords: prev.escalationKeywords.filter((k) => k !== keyword),
    }));
  };

  const handleToggleQueryFlag = (queryId: string) => {
    setQueries((prev) =>
      prev.map((q) => {
        if (q.id === queryId) {
          const next = !q.flaggedForReview;
          showToast(next ? 'Query flagged for prompt engineering review.' : 'Query review mark cleared.');
          return { ...q, flaggedForReview: next };
        }
        return q;
      })
    );
  };

  return (
    <div className="p-6 sm:p-10 lg:p-12 max-w-7xl mx-auto space-y-8">
      {/* ─── Breadcrumb & Header ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/dashboard"
              className="text-[11px] font-bold tracking-[0.2em] text-[#7D6855] hover:text-[#34150F] uppercase"
            >
              Platform Overview
            </Link>
            <span className="text-[#A69584]">/</span>
            <span className="text-[11px] font-bold tracking-[0.2em] text-[#C58B3C] uppercase">
              AI Management
            </span>
          </div>

          <h1 className="font-cormorant text-4xl sm:text-5xl font-medium text-[#34150F] tracking-tight leading-[1.1] mt-1">
            Justicia AI Governance & RAG Controls
          </h1>
          <p className="text-sm text-[#7D6855] mt-1.5 max-w-2xl">
            Configure Google Gemini 3.8 Flash legal reasoning parameters, retrieval similarity thresholds, guardrails, and automated human attorney escalation.
          </p>
        </div>

        {/* Master Kill-switch */}
        <div className="flex items-center gap-3">
          <div
            className="p-3 rounded-2xl bg-[#EFE5D8] border border-[#E8DCCB] flex items-center gap-3"
            style={{ boxShadow: '4px 4px 10px rgba(0,0,0,0.05), -4px -4px 10px rgba(255,255,255,0.8)' }}
          >
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#7D6855] block">
                Assistant Operational Status
              </span>
              <span className={`text-xs font-bold ${config.assistantEnabled ? 'text-emerald-700' : 'text-rose-700'}`}>
                {config.assistantEnabled ? 'Live & Serving Queries' : 'Emergency Disabled'}
              </span>
            </div>

            <button
              onClick={() => {
                const next = !config.assistantEnabled;
                setConfig((prev) => ({ ...prev, assistantEnabled: next }));
                showToast(next ? 'AI Legal Assistant re-enabled.' : 'AI Legal Assistant disabled. Emergency kill-switch activated.');
              }}
              className={`w-12 h-6 flex items-center rounded-full p-1 transition duration-300 ${
                config.assistantEnabled ? 'bg-emerald-600 justify-end' : 'bg-gray-400 justify-start'
              }`}
            >
              <div className="bg-white w-4 h-4 rounded-full shadow-md transform transition" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── Toast Feedback ──────────────────────────────────────────────── */}
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 p-4 rounded-2xl bg-[#23150F] text-[#ded7cb] border border-[#C58B3C]/50 shadow-2xl text-xs flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="w-2 h-2 rounded-full bg-[#C58B3C] animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ─── Top Cards: Model Architecture & Status ────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div
          className="p-6 rounded-3xl bg-[#23150F] text-[#ded7cb] border border-[#352219] space-y-3 shadow-xl"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#C58B3C]">
              Active Foundation Model
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="font-cormorant text-2xl font-bold text-white">
            Gemini 3.8 Flash
          </div>
          <p className="text-xs text-[#A69584]">
            Configured with high-fidelity Philippine legal reasoning prompt and 768-dim text-embedding-004 vectors.
          </p>
        </div>

        <div
          className="p-6 rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB] space-y-2"
          style={{ boxShadow: '6px 6px 14px rgba(0,0,0,0.05), -6px -6px 14px rgba(255,255,255,0.9)' }}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#7D6855]">
            Average Confidence Score
          </span>
          <div className="font-cormorant text-3xl font-bold text-[#34150F]">92.8%</div>
          <p className="text-[11px] text-[#A69584]">
            Grounding verification across 5,000+ indexed Philippine Supreme Court decisions.
          </p>
        </div>

        <div
          className="p-6 rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB] space-y-2"
          style={{ boxShadow: '6px 6px 14px rgba(0,0,0,0.05), -6px -6px 14px rgba(255,255,255,0.9)' }}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#7D6855]">
            Human Escalation Triggers
          </span>
          <div className="font-cormorant text-3xl font-bold text-[#C58B3C]">
            {config.escalationKeywords.length} Active Keywords
          </div>
          <p className="text-[11px] text-[#A69584]">
            Detects urgent court hearings, criminal arrest threats, and physical abuse.
          </p>
        </div>
      </div>

      {/* ─── Two-Column Configuration Panels ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column (5 cols): RAG Precision Sliders */}
        <div
          className="lg:col-span-5 p-6 sm:p-7 rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB] space-y-6 self-start"
          style={{ boxShadow: '6px 6px 16px rgba(0,0,0,0.06), -6px -6px 16px rgba(255,255,255,0.9)' }}
        >
          <div className="border-b border-[#D8CAAD] pb-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#C58B3C]">
              Inference Tuning
            </span>
            <h2 className="font-cormorant text-2xl font-bold text-[#34150F] mt-0.5">
              RAG Pipeline Hyperparameters
            </h2>
            <p className="text-xs text-[#7D6855] mt-1">
              Adjust vector similarity matching and generative creativity.
            </p>
          </div>

          <div className="space-y-6 text-xs">
            {/* Similarity Threshold */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-[#34150F]">Cosine Similarity Threshold</span>
                <span className="font-mono font-bold text-[#C58B3C] bg-[#FAF6F0] px-2 py-0.5 rounded-lg border border-[#D8CAAD]">
                  {config.similarityThreshold.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0.50"
                max="0.95"
                step="0.01"
                value={config.similarityThreshold}
                onChange={(e) => setConfig({ ...config, similarityThreshold: parseFloat(e.target.value) })}
                className="w-full accent-[#C58B3C] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#A69584]">
                <span>0.50 (Broader matching)</span>
                <span>0.95 (Strict exact citation)</span>
              </div>
            </div>

            {/* Top-K Chunks */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-[#34150F]">Retrieved Context Chunks (Top-K)</span>
                <span className="font-mono font-bold text-[#C58B3C] bg-[#FAF6F0] px-2 py-0.5 rounded-lg border border-[#D8CAAD]">
                  {config.topK} Chunks
                </span>
              </div>
              <input
                type="range"
                min="2"
                max="10"
                step="1"
                value={config.topK}
                onChange={(e) => setConfig({ ...config, topK: parseInt(e.target.value, 10) })}
                className="w-full accent-[#C58B3C] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#A69584]">
                <span>2 (Fastest, low context)</span>
                <span>10 (Comprehensive legal analysis)</span>
              </div>
            </div>

            {/* Temperature */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-[#34150F]">Generative Temperature</span>
                <span className="font-mono font-bold text-[#C58B3C] bg-[#FAF6F0] px-2 py-0.5 rounded-lg border border-[#D8CAAD]">
                  {config.temperature.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="0.8"
                step="0.05"
                value={config.temperature}
                onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                className="w-full accent-[#C58B3C] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#A69584]">
                <span>0.0 (Deterministic / Exact statutory text)</span>
                <span>0.8 (Creative explanation)</span>
              </div>
            </div>

            {/* Escalation Keywords */}
            <div className="pt-4 border-t border-[#D8CAAD] space-y-3">
              <span className="font-bold text-[#34150F] block">
                Automatic Referral Keywords (Tagalog & English)
              </span>
              <p className="text-[11px] text-[#7D6855]">
                Queries matching these terms will trigger an immediate recommendation to book counsel.
              </p>

              <form onSubmit={handleAddKeyword} className="flex gap-2">
                <input
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder="Add keyword (e.g., warrant)..."
                  className="flex-1 px-3 py-2 rounded-xl bg-[#F5EDE2] border border-[#D8CAAD] text-xs text-[#34150F] placeholder-[#A69584] focus:outline-none focus:border-[#C58B3C]"
                />
                <button
                  type="submit"
                  className="px-3 py-2 rounded-xl bg-[#23150F] text-[#ded7cb] text-xs font-semibold hover:bg-[#C58B3C] hover:text-[#23150F] transition"
                >
                  Add
                </button>
              </form>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {config.escalationKeywords.map((k) => (
                  <span
                    key={k}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#F5EDE2] border border-[#D8CAAD] text-[#5C4535] text-[11px] font-medium"
                  >
                    <span>{k}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(k)}
                      className="text-[#8C7A6B] hover:text-red-700 font-bold"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={handleSaveConfig}
              className="w-full py-3 rounded-2xl bg-[#C58B3C] text-[#23150F] text-xs font-bold hover:bg-[#B37B2F] transition shadow-md"
            >
              Apply Hyperparameters
            </button>
          </div>
        </div>

        {/* Right Column (7 cols): System Prompt Editor & Sample Logs */}
        <div className="lg:col-span-7 space-y-6">
          {/* System Prompt Editor */}
          <div
            className="p-6 sm:p-7 rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB] space-y-4"
            style={{ boxShadow: '6px 6px 16px rgba(0,0,0,0.06), -6px -6px 16px rgba(255,255,255,0.9)' }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#D8CAAD]">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#C58B3C]">
                  Guardrails & Directive
                </span>
                <h3 className="font-cormorant text-2xl font-bold text-[#34150F]">
                  AI System Persona & Prompt
                </h3>
              </div>
              <button
                onClick={() => {
                  setConfig((prev) => ({ ...prev, systemPrompt: MOCK_ADMIN_AI_CONFIG.systemPrompt }));
                  showToast('System prompt reset to platform baseline.');
                }}
                className="text-xs text-[#7D6855] hover:text-[#34150F] font-semibold underline"
              >
                Reset Default
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-[#34150F] block">
                Primary Directive (Injected into every Gemini context window)
              </label>
              <textarea
                rows={9}
                value={config.systemPrompt}
                onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                className="w-full p-3.5 rounded-2xl bg-[#23150F] text-[#ded7cb] font-mono text-xs border border-[#3E271D] focus:outline-none focus:border-[#C58B3C] leading-relaxed shadow-inner"
              />

              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-bold text-[#34150F] block">
                  Mandatory Legal Disclaimer (Appended to all AI outputs)
                </label>
                <textarea
                  rows={3}
                  value={config.disclaimerText}
                  onChange={(e) => setConfig({ ...config, disclaimerText: e.target.value })}
                  className="w-full p-3 rounded-xl bg-[#F5EDE2] border border-[#D8CAAD] text-xs text-[#5C4535] focus:outline-none focus:border-[#C58B3C]"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSaveConfig}
                  className="px-5 py-2.5 rounded-xl bg-[#23150F] text-[#ded7cb] text-xs font-semibold hover:bg-[#C58B3C] hover:text-[#23150F] transition"
                >
                  Save Directive
                </button>
              </div>
            </div>
          </div>

          {/* Sample Query Quality Inspector */}
          <div
            className="p-6 rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB] space-y-4"
            style={{ boxShadow: '6px 6px 16px rgba(0,0,0,0.06), -6px -6px 16px rgba(255,255,255,0.9)' }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#D8CAAD]">
              <h3 className="font-cormorant text-xl font-bold text-[#34150F]">
                Sampled Output Quality Review
              </h3>
              <span className="text-[10px] text-[#A69584] uppercase font-bold">
                Anonymized Queries
              </span>
            </div>

            <div className="space-y-3">
              {queries.map((q) => (
                <div
                  key={q.id}
                  className="p-4 rounded-2xl bg-[#F5EDE2] border border-[#D8CAAD] space-y-2.5 text-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-[#34150F] leading-snug">
                      "{q.userQuery}"
                    </p>
                    <span
                      className={`shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        q.confidenceScore >= 0.90
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {(q.confidenceScore * 100).toFixed(0)}% Confidence
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#7D6855]">
                    <span className="font-semibold text-[#34150F]">Citations:</span>
                    {q.matchedCitations.map((c) => (
                      <span key={c} className="px-2 py-0.5 rounded-md bg-[#FAF6F0] border border-[#D8CAAD] text-[#8A5A1B] font-mono text-[10px]">
                        {c}
                      </span>
                    ))}
                  </div>

                  {q.flagReason && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
                      ⚠ {q.flagReason}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-[#D8CAAD]/50">
                    <span className="text-[10px] text-[#A69584]">
                      {new Date(q.timestamp).toLocaleTimeString('en-PH')}
                    </span>
                    <button
                      onClick={() => handleToggleQueryFlag(q.id)}
                      className={`text-[11px] font-semibold transition ${
                        q.flaggedForReview
                          ? 'text-rose-700 hover:text-rose-900'
                          : 'text-[#7D6855] hover:text-[#34150F]'
                      }`}
                    >
                      {q.flaggedForReview ? 'Clear Flag' : 'Flag for Correction'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
