'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  MOCK_ADMIN_AUDIT_LOGS,
  type AdminAuditEntry,
} from '@/lib/mock/adminMockData';
import {
  ShieldCheckIcon,
  DocumentTextIcon,
  UserCircleIcon,
} from '@/components/admin/AdminIcons';

function SearchIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function DownloadIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
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

export function AdminSecurityAuditView() {
  const [logs, setLogs] = useState<AdminAuditEntry[]>(MOCK_ADMIN_AUDIT_LOGS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [activeEntry, setActiveEntry] = useState<AdminAuditEntry | null>(null);
  const [isLiveTail, setIsLiveTail] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (selectedCategory !== 'all' && log.category !== selectedCategory) return false;
      if (selectedSeverity !== 'all' && log.severity !== selectedSeverity) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchActor = log.actor.name.toLowerCase().includes(q) || log.actor.email.toLowerCase().includes(q);
        const matchAction = log.action.toLowerCase().includes(q);
        const matchTarget = log.targetId.toLowerCase().includes(q) || log.targetType.toLowerCase().includes(q);
        const matchIp = log.ipAddress.toLowerCase().includes(q);
        return matchActor || matchAction || matchTarget || matchIp;
      }
      return true;
    });
  }, [logs, selectedCategory, selectedSeverity, searchQuery]);

  const handleExportCSV = () => {
    showToast('Exporting tamper-evident CSV with cryptographic checksum...');
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
              Security & Audit Trail
            </span>
          </div>

          <h1 className="font-cormorant text-4xl sm:text-5xl font-medium text-[#34150F] tracking-tight leading-[1.1] mt-1">
            System Security & Audit Trail
          </h1>
          <p className="text-sm text-[#7D6855] mt-1.5 max-w-2xl">
            Immutable log of administrative authorizations, attorney verification decisions, privilege escalations, and system access events.
          </p>
        </div>

        {/* Live Tail & Export */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsLiveTail(!isLiveTail)}
            className={`px-4 py-2.5 rounded-2xl border text-xs font-semibold flex items-center gap-2 transition ${
              isLiveTail
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-sm'
                : 'bg-[#EFE5D8] border-[#D8CAAD] text-[#7D6855]'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isLiveTail ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
            <span>{isLiveTail ? 'Live Tail Active' : 'Live Tail Paused'}</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 rounded-2xl bg-[#C58B3C] text-[#23150F] text-xs font-semibold hover:bg-[#B37B2F] transition flex items-center gap-2 shadow-[3px_3px_8px_rgba(0,0,0,0.1)]"
          >
            <DownloadIcon className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* ─── Toast Feedback ──────────────────────────────────────────────── */}
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 p-4 rounded-2xl bg-[#23150F] text-[#ded7cb] border border-[#C58B3C]/50 shadow-2xl text-xs flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="w-2 h-2 rounded-full bg-[#C58B3C] animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ─── Metric Tiles ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div
          className="p-5 rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB]"
          style={{ boxShadow: '6px 6px 14px rgba(0,0,0,0.05), -6px -6px 14px rgba(255,255,255,0.9)' }}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#7D6855]">Total Events</span>
          <div className="mt-2 font-cormorant text-3xl font-bold text-[#34150F]">{logs.length}</div>
          <p className="text-[10px] text-[#A69584] mt-0.5">Recorded across all modules</p>
        </div>

        <div
          className="p-5 rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB]"
          style={{ boxShadow: '6px 6px 14px rgba(0,0,0,0.05), -6px -6px 14px rgba(255,255,255,0.9)' }}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800">Flagged Critical</span>
          <div className="mt-2 font-cormorant text-3xl font-bold text-rose-900">
            {logs.filter((l) => l.severity === 'critical').length}
          </div>
          <p className="text-[10px] text-rose-700/80 mt-0.5">Anti-brute force lockouts</p>
        </div>

        <div
          className="p-5 rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB]"
          style={{ boxShadow: '6px 6px 14px rgba(0,0,0,0.05), -6px -6px 14px rgba(255,255,255,0.9)' }}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Lawyer Reviews</span>
          <div className="mt-2 font-cormorant text-3xl font-bold text-amber-900">
            {logs.filter((l) => l.category === 'lawyer_verification').length}
          </div>
          <p className="text-[10px] text-amber-700/80 mt-0.5">Bar roll verifications</p>
        </div>

        <div
          className="p-5 rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB]"
          style={{ boxShadow: '6px 6px 14px rgba(0,0,0,0.05), -6px -6px 14px rgba(255,255,255,0.9)' }}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Compliance Integrity</span>
          <div className="mt-2 font-cormorant text-2xl font-bold text-emerald-900">100%</div>
          <p className="text-[10px] text-emerald-700/80 mt-0.5">Append-only DB enforced</p>
        </div>
      </div>

      {/* ─── Search & Filters ──────────────────────────────────────────────── */}
      <div
        className="p-5 rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB] space-y-4"
        style={{ boxShadow: '6px 6px 16px rgba(0,0,0,0.06), -6px -6px 16px rgba(255,255,255,0.9)' }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search input */}
          <div className="relative flex-1 max-w-md">
            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C7A6B]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by actor name, action code, or IP..."
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
            <span className="text-xs font-semibold text-[#7D6855]">Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#F5EDE2] border border-[#D8CAAD] text-xs font-medium text-[#34150F] focus:outline-none focus:border-[#C58B3C]"
            >
              <option value="all">All Categories</option>
              <option value="lawyer_verification">Lawyer Verification</option>
              <option value="auth">Authentication & MFA</option>
              <option value="ai_config">AI & RAG Config</option>
              <option value="knowledge_base">Knowledge Base</option>
              <option value="financial">Financial Escrow</option>
            </select>
          </div>

          {/* Severity Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#7D6855]">Severity:</span>
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#F5EDE2] border border-[#D8CAAD] text-xs font-medium text-[#34150F] focus:outline-none focus:border-[#C58B3C]"
            >
              <option value="all">All Severities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>
      </div>

      {/* ─── Audit Trail Table ─────────────────────────────────────────────── */}
      <div
        className="rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB] overflow-hidden"
        style={{ boxShadow: '6px 6px 16px rgba(0,0,0,0.06), -6px -6px 16px rgba(255,255,255,0.9)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#E5D7C5] text-[#5C4535] uppercase tracking-wider font-semibold border-b border-[#D8CAAD]">
              <tr>
                <th className="py-3.5 px-6">Timestamp</th>
                <th className="py-3.5 px-4">Actor</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">Severity</th>
                <th className="py-3.5 px-4">Target Resource</th>
                <th className="py-3.5 px-4">IP Location</th>
                <th className="py-3.5 px-6 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8DCCB]">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => {
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setActiveEntry(log)}
                      className="hover:bg-[#F5EDE2]/70 transition cursor-pointer"
                    >
                      {/* Timestamp */}
                      <td className="py-4 px-6 text-[#7D6855] whitespace-nowrap">
                        <div className="font-semibold text-[#34150F]">
                          {new Date(log.timestamp).toLocaleTimeString('en-PH')}
                        </div>
                        <div className="text-[10px] text-[#A69584]">
                          {new Date(log.timestamp).toLocaleDateString('en-PH')}
                        </div>
                      </td>

                      {/* Actor */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#D4C1AB] text-[#34150F] font-bold text-[10px] flex items-center justify-center shrink-0">
                            {log.actor.name.charAt(0)}
                          </div>
                          <div>
                            <span className="font-bold text-[#34150F] block truncate max-w-[130px]">
                              {log.actor.name}
                            </span>
                            <span className="text-[10px] text-[#7D6855] uppercase font-semibold">
                              {log.actor.role}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-4 px-4">
                        <div className="font-mono text-xs font-bold text-[#34150F]">{log.action}</div>
                        <span className="text-[10px] text-[#C58B3C] capitalize font-medium">
                          {log.category.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Severity */}
                      <td className="py-4 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            log.severity === 'critical'
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : log.severity === 'high'
                              ? 'bg-orange-100 text-orange-800 border border-orange-300'
                              : log.severity === 'medium'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {log.severity}
                        </span>
                      </td>

                      {/* Target */}
                      <td className="py-4 px-4 font-mono text-[11px] text-[#5C4535]">
                        <div>{log.targetType}</div>
                        <div className="text-[10px] text-[#A69584]">{log.targetId}</div>
                      </td>

                      {/* IP */}
                      <td className="py-4 px-4 text-[#7D6855] text-[11px] whitespace-nowrap">
                        {log.ipAddress}
                      </td>

                      {/* Inspect */}
                      <td className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setActiveEntry(log)}
                          className="px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-[#23150F] text-[#ded7cb] hover:bg-[#C58B3C] hover:text-[#23150F] transition"
                        >
                          View Payload
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-[#7D6855]">
                    No audit records matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Payload Details Modal ─────────────────────────────────────────── */}
      {activeEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setActiveEntry(null)}
          />

          <div
            className="relative w-full max-w-xl bg-[#EFE5D8] rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#D8CAAD] z-10 space-y-5 animate-in zoom-in-95 duration-150"
            style={{ boxShadow: '8px 8px 24px rgba(0,0,0,0.15)' }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#D8CAAD]">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#C58B3C]">
                  Audit Record #{activeEntry.id}
                </span>
                <h3 className="font-cormorant text-2xl font-bold text-[#34150F]">
                  {activeEntry.action}
                </h3>
              </div>
              <button
                onClick={() => setActiveEntry(null)}
                className="p-2 rounded-full hover:bg-[#E5D7C5] text-[#5C4535]"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-[#F5EDE2] border border-[#D8CAAD]">
                <div>
                  <span className="text-[#7D6855] block">Actor</span>
                  <span className="font-bold text-[#34150F]">{activeEntry.actor.name}</span>
                  <span className="text-[10px] text-[#A69584] block">({activeEntry.actor.email})</span>
                </div>
                <div>
                  <span className="text-[#7D6855] block">Timestamp</span>
                  <span className="font-bold text-[#34150F]">
                    {new Date(activeEntry.timestamp).toLocaleString('en-PH')}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-[#34150F] uppercase tracking-wider block mb-1.5">
                  Cryptographic Payload Metadata (JSON)
                </span>
                <pre className="p-4 rounded-2xl bg-[#23150F] text-[#ded7cb] font-mono text-[11px] overflow-x-auto border border-[#352219] max-h-56 leading-relaxed">
                  {JSON.stringify(activeEntry.details, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-3 border-t border-[#D8CAAD] flex justify-end">
              <button
                onClick={() => setActiveEntry(null)}
                className="px-5 py-2.5 rounded-xl bg-[#23150F] text-[#ded7cb] text-xs font-semibold hover:bg-[#C58B3C] hover:text-[#23150F] transition"
              >
                Close Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
