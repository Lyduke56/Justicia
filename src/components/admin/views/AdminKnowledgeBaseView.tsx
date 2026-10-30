'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  MOCK_ADMIN_KNOWLEDGE_SOURCES,
  type AdminKnowledgeSource,
} from '@/lib/mock/adminMockData';
import { BookOpenIcon, SparklesIcon } from '@/components/admin/AdminIcons';

function SearchIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function PlusIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function UploadCloudIcon({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
      <polyline points="16 16 12 12 8 16" />
    </svg>
  );
}

function XIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function AdminKnowledgeBaseView() {
  const [sources, setSources] = useState<AdminKnowledgeSource[]>(MOCK_ADMIN_KNOWLEDGE_SOURCES);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<AdminKnowledgeSource | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New source form state
  const [newTitle, setNewTitle] = useState('');
  const [newCitation, setNewCitation] = useState('');
  const [newCategory, setNewCategory] = useState<AdminKnowledgeSource['category']>('Supreme Court Decision');
  const [newSummary, setNewSummary] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const filteredSources = useMemo(() => {
    return sources.filter((s) => {
      if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = s.title.toLowerCase().includes(q);
        const matchCit = s.citationId.toLowerCase().includes(q);
        const matchTags = s.tags.some((t) => t.toLowerCase().includes(q));
        return matchTitle || matchCit || matchTags;
      }
      return true;
    });
  }, [sources, categoryFilter, searchQuery]);

  const handleTriggerReindex = (sourceId: string) => {
    setSources((prev) =>
      prev.map((s) => {
        if (s.id === sourceId) {
          showToast(`Re-indexing triggered for "${s.citationId}". Vector embeddings queued.`);
          return { ...s, status: 'indexing' };
        }
        return s;
      })
    );
    setTimeout(() => {
      setSources((prev) =>
        prev.map((s) => (s.id === sourceId ? { ...s, status: 'indexed', lastIndexedAt: new Date().toISOString() } : s))
      );
      showToast(`Vector embedding complete for "${sourceId}".`);
    }, 2500);
  };

  const handleCreateSource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newCitation.trim()) {
      showToast('Please fill out document title and citation ID.');
      return;
    }

    const newDoc: AdminKnowledgeSource = {
      id: `src-custom-${Date.now()}`,
      citationId: newCitation,
      title: newTitle,
      category: newCategory,
      promulgationDate: new Date().toISOString().split('T')[0],
      lastIndexedAt: new Date().toISOString(),
      version: '1.0-Admin-Uploaded',
      status: 'indexed',
      totalChunks: 85,
      fileSizeBytes: 240000,
      fileFormat: 'PDF',
      tags: ['Admin Ingest', 'Philippine Law'],
      summary: newSummary || 'Uploaded legal authority document.',
    };

    setSources((prev) => [newDoc, ...prev]);
    setIsUploadModalOpen(false);
    setNewTitle('');
    setNewCitation('');
    setNewSummary('');
    showToast(`Successfully ingested "${newDoc.citationId}". 85 vector chunks stored.`);
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
              Knowledge Base
            </span>
          </div>

          <h1 className="font-cormorant text-4xl sm:text-5xl font-medium text-[#34150F] tracking-tight leading-[1.1] mt-1">
            Philippine Legal Knowledge Base
          </h1>
          <p className="text-sm text-[#7D6855] mt-1.5 max-w-2xl">
            Manage the vectorized legal corpus feeding the AI Legal Assistant. Index Supreme Court En Banc decisions, Republic Acts, and codified statutes.
          </p>
        </div>

        {/* Upload Button */}
        <button
          onClick={() => setIsUploadModalOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#C58B3C] text-[#23150F] font-semibold text-xs tracking-wide shadow-[4px_4px_10px_rgba(0,0,0,0.1),-3px_-3px_10px_rgba(255,255,255,0.8)] hover:bg-[#B37B2F] transition-all shrink-0 self-start md:self-auto"
        >
          <PlusIcon className="w-4 h-4" />
          <span>Ingest Legal Document</span>
        </button>
      </div>

      {/* ─── Toast Feedback ──────────────────────────────────────────────── */}
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 p-4 rounded-2xl bg-[#23150F] text-[#ded7cb] border border-[#C58B3C]/50 shadow-2xl text-xs flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="w-2 h-2 rounded-full bg-[#C58B3C] animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ─── Metric Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div
          className="p-5 rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB]"
          style={{ boxShadow: '6px 6px 14px rgba(0,0,0,0.05), -6px -6px 14px rgba(255,255,255,0.9)' }}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#7D6855]">
            Ingested Sources
          </span>
          <div className="mt-2 font-cormorant text-3xl font-bold text-[#34150F]">{sources.length}</div>
          <p className="text-[10px] text-[#A69584] mt-0.5">Primary authorities</p>
        </div>

        <div
          className="p-5 rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB]"
          style={{ boxShadow: '6px 6px 14px rgba(0,0,0,0.05), -6px -6px 14px rgba(255,255,255,0.9)' }}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#7D6855]">
            Vector Chunks
          </span>
          <div className="mt-2 font-cormorant text-3xl font-bold text-[#C58B3C]">
            {sources.reduce((acc, curr) => acc + curr.totalChunks, 0).toLocaleString()}
          </div>
          <p className="text-[10px] text-[#A69584] mt-0.5">768-dim embeddings</p>
        </div>

        <div
          className="p-5 rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB]"
          style={{ boxShadow: '6px 6px 14px rgba(0,0,0,0.05), -6px -6px 14px rgba(255,255,255,0.9)' }}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#7D6855]">
            Supreme Court Rulings
          </span>
          <div className="mt-2 font-cormorant text-3xl font-bold text-[#34150F]">
            {sources.filter((s) => s.category === 'Supreme Court Decision').length}
          </div>
          <p className="text-[10px] text-[#A69584] mt-0.5">Landmark En Banc</p>
        </div>

        <div
          className="p-5 rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB]"
          style={{ boxShadow: '6px 6px 14px rgba(0,0,0,0.05), -6px -6px 14px rgba(255,255,255,0.9)' }}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
            Pipeline Health
          </span>
          <div className="mt-2 font-cormorant text-2xl font-bold text-emerald-900">
            100% Synced
          </div>
          <p className="text-[10px] text-emerald-700/80 mt-0.5">Supabase pgvector</p>
        </div>
      </div>

      {/* ─── Search & Category Filters ─────────────────────────────────────── */}
      <div
        className="p-5 rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB] space-y-4"
        style={{ boxShadow: '6px 6px 16px rgba(0,0,0,0.06), -6px -6px 16px rgba(255,255,255,0.9)' }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C7A6B]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by citation (e.g. G.R. 234142), title, or tag..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[#F5EDE2] border border-[#D8CAAD] text-xs text-[#34150F] placeholder-[#A69584] focus:outline-none focus:border-[#C58B3C] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.06)]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8C7A6B] hover:text-[#34150F]"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#7D6855]">Corpus Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#F5EDE2] border border-[#D8CAAD] text-xs font-medium text-[#34150F] focus:outline-none focus:border-[#C58B3C]"
            >
              <option value="all">All Categories</option>
              <option value="Supreme Court Decision">Supreme Court Decisions</option>
              <option value="Republic Act">Republic Acts</option>
              <option value="Civil & Penal Code">Civil & Penal Codes</option>
              <option value="Rules of Court">Rules of Court</option>
            </select>
          </div>
        </div>
      </div>

      {/* ─── Sources Grid / Table ─────────────────────────────────────────── */}
      <div
        className="rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB] overflow-hidden"
        style={{ boxShadow: '6px 6px 16px rgba(0,0,0,0.06), -6px -6px 16px rgba(255,255,255,0.9)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#E5D7C5] text-[#5C4535] uppercase tracking-wider font-semibold border-b border-[#D8CAAD]">
              <tr>
                <th className="py-3.5 px-6">Legal Authority & Citation</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Vector Chunks</th>
                <th className="py-3.5 px-4">Promulgated</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8DCCB]">
              {filteredSources.length > 0 ? (
                filteredSources.map((source) => (
                  <tr
                    key={source.id}
                    onClick={() => setSelectedSource(source)}
                    className="hover:bg-[#F5EDE2]/70 transition cursor-pointer"
                  >
                    {/* Citation & Title */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-2xl bg-[#D4C1AB] text-[#34150F] font-bold text-xs flex items-center justify-center shrink-0 border border-[#D9C9B6]">
                          ⚖️
                        </div>
                        <div>
                          <span className="font-bold text-[#34150F] block">{source.title}</span>
                          <span className="text-[11px] font-mono text-[#C58B3C] font-semibold">{source.citationId}</span>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-4 px-4 text-[#5C4535]">
                      <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#E5D7C5] border border-[#D8CAAD]">
                        {source.category}
                      </span>
                    </td>

                    {/* Vector Chunks */}
                    <td className="py-4 px-4">
                      <span className="font-mono font-bold text-[#34150F]">{source.totalChunks.toLocaleString()}</span>
                      <span className="text-[10px] text-[#A69584] block">({(source.fileSizeBytes / 1000000).toFixed(1)} MB)</span>
                    </td>

                    {/* Date */}
                    <td className="py-4 px-4 text-[#7D6855]">
                      {new Date(source.promulgationDate).toLocaleDateString('en-PH')}
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          source.status === 'indexed'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : source.status === 'indexing'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                            : 'bg-stone-100 text-stone-700'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${source.status === 'indexed' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        <span className="capitalize">{source.status}</span>
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedSource(source)}
                          className="px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-[#23150F] text-[#ded7cb] hover:bg-[#C58B3C] hover:text-[#23150F] transition"
                        >
                          Inspect
                        </button>
                        <button
                          onClick={() => handleTriggerReindex(source.id)}
                          className="px-3 py-1.5 rounded-xl text-[11px] font-semibold border border-[#D8CAAD] text-[#5C4535] hover:bg-[#E5D7C5] transition"
                        >
                          Re-index
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-[#7D6855]">
                    No legal authorities found matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Source Detail Drawer ──────────────────────────────────────────── */}
      {selectedSource && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedSource(null)}
          />

          <div className="relative w-full max-w-lg bg-[#EFE5D8] h-full shadow-2xl p-6 sm:p-8 flex flex-col justify-between overflow-y-auto border-l border-[#D8CAAD] z-10 animate-in slide-in-from-right duration-200">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#D8CAAD]">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#C58B3C]">
                    Corpus Authority
                  </span>
                  <h2 className="font-cormorant text-2xl font-bold text-[#34150F]">
                    {selectedSource.citationId}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedSource(null)}
                  className="p-2 rounded-full hover:bg-[#E5D7C5] text-[#5C4535]"
                >
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-bold text-[#7D6855] block">Title</span>
                  <p className="text-sm font-semibold text-[#34150F] mt-0.5">{selectedSource.title}</p>
                </div>

                <div className="p-4 rounded-2xl bg-[#F5EDE2] border border-[#D8CAAD] space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[#7D6855]">Category:</span>
                    <span className="font-semibold text-[#34150F]">{selectedSource.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#7D6855]">Vector Chunks:</span>
                    <span className="font-mono font-bold text-[#34150F]">{selectedSource.totalChunks} chunks</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#7D6855]">Promulgation Date:</span>
                    <span className="text-[#34150F]">{selectedSource.promulgationDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#7D6855]">Last Indexed:</span>
                    <span className="text-[#34150F]">{new Date(selectedSource.lastIndexedAt).toLocaleString('en-PH')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#7D6855]">Format & Size:</span>
                    <span className="text-[#34150F]">{selectedSource.fileFormat} ({(selectedSource.fileSizeBytes / 1000).toFixed(0)} KB)</span>
                  </div>
                </div>

                <div>
                  <span className="font-bold text-[#7D6855] block mb-1">Subject Tags</span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSource.tags.map((t) => (
                      <span key={t} className="px-2.5 py-1 rounded-xl bg-[#C58B3C]/15 border border-[#C58B3C]/30 text-[#8A5A1B] text-[11px] font-medium">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="font-bold text-[#7D6855] block mb-1">Jurisprudential Scope & Summary</span>
                  <div className="p-3.5 rounded-2xl bg-[#F5EDE2] border border-[#D8CAAD] text-[#5C4535] leading-relaxed">
                    {selectedSource.summary}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-[#D8CAAD] space-y-2">
              <button
                onClick={() => handleTriggerReindex(selectedSource.id)}
                className="w-full py-3 rounded-xl bg-[#23150F] text-[#ded7cb] text-xs font-semibold hover:bg-[#C58B3C] hover:text-[#23150F] transition"
              >
                Re-embed Vectors (pgvector)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Upload Legal Document Modal ───────────────────────────────────── */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsUploadModalOpen(false)}
          />

          <div
            className="relative w-full max-w-xl bg-[#EFE5D8] rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#D8CAAD] z-10 space-y-5 animate-in zoom-in-95 duration-150"
            style={{ boxShadow: '8px 8px 24px rgba(0,0,0,0.15)' }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#D8CAAD]">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#C58B3C]">
                  Corpus Ingestion
                </span>
                <h3 className="font-cormorant text-2xl font-bold text-[#34150F]">
                  Add Legal Authority Document
                </h3>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="p-2 rounded-full hover:bg-[#E5D7C5] text-[#5C4535]"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSource} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-[#34150F] block mb-1">Document Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Revised Corporation Code (Republic Act No. 11232)"
                  className="w-full p-2.5 rounded-xl bg-[#F5EDE2] border border-[#D8CAAD] text-xs text-[#34150F] placeholder-[#A69584] focus:outline-none focus:border-[#C58B3C]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#34150F] block mb-1">Citation ID / Docket</label>
                  <input
                    type="text"
                    required
                    value={newCitation}
                    onChange={(e) => setNewCitation(e.target.value)}
                    placeholder="e.g. RA 11232 or G.R. 201844"
                    className="w-full p-2.5 rounded-xl bg-[#F5EDE2] border border-[#D8CAAD] text-xs text-[#34150F] placeholder-[#A69584] focus:outline-none focus:border-[#C58B3C]"
                  />
                </div>

                <div>
                  <label className="font-bold text-[#34150F] block mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-[#F5EDE2] border border-[#D8CAAD] text-xs text-[#34150F] focus:outline-none focus:border-[#C58B3C]"
                  >
                    <option value="Supreme Court Decision">Supreme Court Decision</option>
                    <option value="Republic Act">Republic Act</option>
                    <option value="Civil & Penal Code">Civil & Penal Code</option>
                    <option value="Rules of Court">Rules of Court</option>
                    <option value="Executive Order">Executive Order</option>
                    <option value="DOJ Circular">DOJ Circular</option>
                  </select>
                </div>
              </div>

              {/* Upload Dropzone */}
              <div className="p-6 rounded-2xl border-2 border-dashed border-[#D8CAAD] bg-[#FAF6F0] text-center space-y-2 cursor-pointer hover:border-[#C58B3C] transition">
                <div className="w-10 h-10 rounded-full bg-[#E5D7C5] text-[#C58B3C] flex items-center justify-center mx-auto">
                  <UploadCloudIcon className="w-5 h-5" />
                </div>
                <div className="font-semibold text-xs text-[#34150F]">
                  Upload PDF or DOCX file
                </div>
                <p className="text-[10px] text-[#A69584]">
                  Automated OCR, semantic paragraph chunking, and 768-dim embeddings generation.
                </p>
              </div>

              <div>
                <label className="font-bold text-[#34150F] block mb-1">Scope & Brief Description</label>
                <textarea
                  rows={3}
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  placeholder="Summary of legal principles and doctrine established..."
                  className="w-full p-2.5 rounded-xl bg-[#F5EDE2] border border-[#D8CAAD] text-xs text-[#34150F] placeholder-[#A69584] focus:outline-none focus:border-[#C58B3C]"
                />
              </div>

              <div className="pt-3 border-t border-[#D8CAAD] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#D8CAAD] text-xs font-semibold text-[#5C4535] hover:bg-[#E5D7C5] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#C58B3C] text-[#23150F] text-xs font-bold hover:bg-[#B37B2F] transition shadow-md"
                >
                  Ingest & Vectorize
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
