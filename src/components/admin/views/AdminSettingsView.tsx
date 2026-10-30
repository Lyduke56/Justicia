'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  MOCK_ADMIN_SETTINGS,
  MOCK_ADMIN_USERS,
  type AdminSystemSettings,
} from '@/lib/mock/adminMockData';
import { GearIcon, ShieldCheckIcon, UserCircleIcon } from '@/components/admin/AdminIcons';

function PlusIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
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

type SettingsTab = 'general' | 'consultation' | 'security' | 'admins';

export function AdminSettingsView() {
  const [settings, setSettings] = useState<AdminSystemSettings>(MOCK_ADMIN_SETTINGS);
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [adminUsers, setAdminUsers] = useState(MOCK_ADMIN_USERS.filter((u) => u.role === 'admin'));
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Invite Admin form
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteDesignation, setInviteDesignation] = useState('Compliance Officer');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('Platform settings saved and propagated across all runtime nodes.');
  };

  const handleInviteAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) {
      showToast('Please enter administrator name and email.');
      return;
    }

    const newAdmin = {
      id: `usr-ad-${Date.now()}`,
      fullName: `${inviteName} (${inviteDesignation})`,
      email: inviteEmail,
      role: 'admin' as const,
      status: 'active' as const,
      mfaEnabled: true,
      location: 'Metro Manila',
      casesCount: 0,
      consultationsCount: 0,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };

    setAdminUsers((prev) => [...prev, newAdmin]);
    setIsInviteModalOpen(false);
    setInviteName('');
    setInviteEmail('');
    showToast(`Administrator invitation sent to ${inviteEmail}.`);
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
              System Settings
            </span>
          </div>

          <h1 className="font-cormorant text-4xl sm:text-5xl font-medium text-[#34150F] tracking-tight leading-[1.1] mt-1">
            Platform Settings & Governance
          </h1>
          <p className="text-sm text-[#7D6855] mt-1.5 max-w-2xl">
            Configure global marketplace policies, consultation fee safeguards, emergency maintenance mode, and administrator credentials.
          </p>
        </div>

        {/* Security Audit Link */}
        <Link
          href="/admin/settings/security-audit-log"
          className="px-4 py-2.5 rounded-2xl bg-[#EFE5D8] border border-[#D8CAAD] text-xs font-semibold text-[#5C4535] hover:bg-[#E5D7C5] transition shadow-sm self-start md:self-auto"
          style={{ boxShadow: '3px 3px 8px rgba(0,0,0,0.04), -3px -3px 8px rgba(255,255,255,0.8)' }}
        >
          View Security Audit Trail →
        </Link>
      </div>

      {/* ─── Toast Feedback ──────────────────────────────────────────────── */}
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 p-4 rounded-2xl bg-[#23150F] text-[#ded7cb] border border-[#C58B3C]/50 shadow-2xl text-xs flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="w-2 h-2 rounded-full bg-[#C58B3C] animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ─── Settings Tabs Bar ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[#E5D7C5] border border-[#D8CAAD] text-xs max-w-fit overflow-x-auto">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2 rounded-xl font-semibold transition ${
            activeTab === 'general'
              ? 'bg-[#EFE5D8] text-[#34150F] shadow-sm'
              : 'text-[#7D6855] hover:text-[#34150F]'
          }`}
        >
          General Configuration
        </button>

        <button
          onClick={() => setActiveTab('consultation')}
          className={`px-4 py-2 rounded-xl font-semibold transition ${
            activeTab === 'consultation'
              ? 'bg-[#EFE5D8] text-[#34150F] shadow-sm'
              : 'text-[#7D6855] hover:text-[#34150F]'
          }`}
        >
          Consultation & Commission
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2 rounded-xl font-semibold transition ${
            activeTab === 'security'
              ? 'bg-[#EFE5D8] text-[#34150F] shadow-sm'
              : 'text-[#7D6855] hover:text-[#34150F]'
          }`}
        >
          Security & Access Limits
        </button>

        <button
          onClick={() => setActiveTab('admins')}
          className={`px-4 py-2 rounded-xl font-semibold transition ${
            activeTab === 'admins'
              ? 'bg-[#EFE5D8] text-[#34150F] shadow-sm'
              : 'text-[#7D6855] hover:text-[#34150F]'
          }`}
        >
          Admin Accounts ({adminUsers.length})
        </button>
      </div>

      {/* ─── TAB 1: General Configuration ─────────────────────────────────── */}
      {activeTab === 'general' && (
        <form
          onSubmit={handleSaveSettings}
          className="p-6 sm:p-8 rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB] space-y-6"
          style={{ boxShadow: '6px 6px 16px rgba(0,0,0,0.06), -6px -6px 16px rgba(255,255,255,0.9)' }}
        >
          <div className="border-b border-[#D8CAAD] pb-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#C58B3C]">
              Platform Metadata
            </span>
            <h2 className="font-cormorant text-2xl font-bold text-[#34150F] mt-0.5">
              General Identity & Maintenance
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            <div className="space-y-1.5 md:col-span-2">
              <label className="font-bold text-[#34150F]">Platform Public Name</label>
              <input
                type="text"
                value={settings.platformName}
                onChange={(e) => setSettings({ ...settings, platformName: e.target.value })}
                className="w-full p-3 rounded-xl bg-[#F5EDE2] border border-[#D8CAAD] text-xs text-[#34150F] focus:outline-none focus:border-[#C58B3C]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-[#34150F]">Public Support Email</label>
              <input
                type="email"
                value={settings.contactEmail}
                onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                className="w-full p-3 rounded-xl bg-[#F5EDE2] border border-[#D8CAAD] text-xs text-[#34150F] focus:outline-none focus:border-[#C58B3C]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-[#34150F]">Official Hotline Number</label>
              <input
                type="text"
                value={settings.hotline}
                onChange={(e) => setSettings({ ...settings, hotline: e.target.value })}
                className="w-full p-3 rounded-xl bg-[#F5EDE2] border border-[#D8CAAD] text-xs text-[#34150F] focus:outline-none focus:border-[#C58B3C]"
              />
            </div>
          </div>

          {/* Maintenance Mode Box */}
          <div className="p-5 rounded-2xl bg-[#F5EDE2] border border-[#D8CAAD] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-xs text-[#34150F] block">
                  Maintenance Mode (Platform Downtime)
                </span>
                <p className="text-[11px] text-[#7D6855] mt-0.5">
                  When enabled, non-admin visitors will be presented with the maintenance message.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  const next = !settings.maintenanceMode;
                  setSettings({ ...settings, maintenanceMode: next });
                  showToast(next ? 'Maintenance mode enabled.' : 'Maintenance mode disabled.');
                }}
                className={`w-12 h-6 flex items-center rounded-full p-1 transition duration-300 ${
                  settings.maintenanceMode ? 'bg-rose-600 justify-end' : 'bg-gray-400 justify-start'
                }`}
              >
                <div className="bg-white w-4 h-4 rounded-full shadow-md transform transition" />
              </button>
            </div>

            {settings.maintenanceMode && (
              <div className="space-y-1.5 pt-2">
                <label className="text-[11px] font-bold text-rose-900 block">
                  Maintenance Notice Message
                </label>
                <textarea
                  rows={2}
                  value={settings.maintenanceNotice}
                  onChange={(e) => setSettings({ ...settings, maintenanceNotice: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-[#FAF6F0] border border-rose-300 text-xs text-rose-900 focus:outline-none"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end pt-3">
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-[#C58B3C] text-[#23150F] text-xs font-bold hover:bg-[#B37B2F] transition shadow-md"
            >
              Save Configuration
            </button>
          </div>
        </form>
      )}

      {/* ─── TAB 2: Consultation Policies ─────────────────────────────────── */}
      {activeTab === 'consultation' && (
        <form
          onSubmit={handleSaveSettings}
          className="p-6 sm:p-8 rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB] space-y-6"
          style={{ boxShadow: '6px 6px 16px rgba(0,0,0,0.06), -6px -6px 16px rgba(255,255,255,0.9)' }}
        >
          <div className="border-b border-[#D8CAAD] pb-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#C58B3C]">
              Economic Safeguards
            </span>
            <h2 className="font-cormorant text-2xl font-bold text-[#34150F] mt-0.5">
              Consultation Rates & Escrow Commission
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-[#34150F]">Platform Commission Rate (%)</label>
              <input
                type="number"
                min="0"
                max="30"
                value={settings.platformCommissionPercent}
                onChange={(e) => setSettings({ ...settings, platformCommissionPercent: parseInt(e.target.value, 10) })}
                className="w-full p-3 rounded-xl bg-[#F5EDE2] border border-[#D8CAAD] text-xs font-mono font-bold text-[#34150F] focus:outline-none focus:border-[#C58B3C]"
              />
              <p className="text-[10px] text-[#A69584]">Deducted from lawyer escrow payout on completed consultation.</p>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-[#34150F]">Minimum Allowable Hourly Rate (₱)</label>
              <input
                type="number"
                step="100"
                value={settings.consultationFeeMin}
                onChange={(e) => setSettings({ ...settings, consultationFeeMin: parseInt(e.target.value, 10) })}
                className="w-full p-3 rounded-xl bg-[#F5EDE2] border border-[#D8CAAD] text-xs font-mono font-bold text-[#34150F] focus:outline-none focus:border-[#C58B3C]"
              />
              <p className="text-[10px] text-[#A69584]">Prevents predatory undercutting below minimum standard.</p>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-[#34150F]">Maximum Allowable Hourly Rate (₱)</label>
              <input
                type="number"
                step="500"
                value={settings.consultationFeeMax}
                onChange={(e) => setSettings({ ...settings, consultationFeeMax: parseInt(e.target.value, 10) })}
                className="w-full p-3 rounded-xl bg-[#F5EDE2] border border-[#D8CAAD] text-xs font-mono font-bold text-[#34150F] focus:outline-none focus:border-[#C58B3C]"
              />
              <p className="text-[10px] text-[#A69584]">Cap for standard directory booking without custom retainer.</p>
            </div>
          </div>

          <div className="flex justify-end pt-3">
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-[#C58B3C] text-[#23150F] text-xs font-bold hover:bg-[#B37B2F] transition shadow-md"
            >
              Save Economic Policies
            </button>
          </div>
        </form>
      )}

      {/* ─── TAB 3: Security & Access Limits ──────────────────────────────── */}
      {activeTab === 'security' && (
        <form
          onSubmit={handleSaveSettings}
          className="p-6 sm:p-8 rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB] space-y-6"
          style={{ boxShadow: '6px 6px 16px rgba(0,0,0,0.06), -6px -6px 16px rgba(255,255,255,0.9)' }}
        >
          <div className="border-b border-[#D8CAAD] pb-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#C58B3C]">
              Access Guardrails
            </span>
            <h2 className="font-cormorant text-2xl font-bold text-[#34150F] mt-0.5">
              Security Enforcement & Session Limits
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-[#34150F]">Inactivity Auto-Logout (Minutes)</label>
              <input
                type="number"
                min="5"
                max="120"
                value={settings.sessionTimeoutMinutes}
                onChange={(e) => setSettings({ ...settings, sessionTimeoutMinutes: parseInt(e.target.value, 10) })}
                className="w-full p-3 rounded-xl bg-[#F5EDE2] border border-[#D8CAAD] text-xs font-mono font-bold text-[#34150F] focus:outline-none focus:border-[#C58B3C]"
              />
              <p className="text-[10px] text-[#A69584]">Current setting enforced by AdminShell hook (30 min default).</p>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-[#34150F]">Anti-Brute Force Lockout Threshold</label>
              <input
                type="number"
                min="3"
                max="10"
                value={settings.maxFailedLoginsBeforeLock}
                onChange={(e) => setSettings({ ...settings, maxFailedLoginsBeforeLock: parseInt(e.target.value, 10) })}
                className="w-full p-3 rounded-xl bg-[#F5EDE2] border border-[#D8CAAD] text-xs font-mono font-bold text-[#34150F] focus:outline-none focus:border-[#C58B3C]"
              />
              <p className="text-[10px] text-[#A69584]">Failed attempts before account is locked for 15 minutes.</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#F5EDE2] border border-[#D8CAAD] flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-[#34150F] block">Mandatory 2FA/MFA for All Administrators</span>
              <p className="text-[11px] text-[#7D6855] mt-0.5">
                Requires TOTP hardware authenticator for any login targeting the /admin portal.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
              Enforced
            </span>
          </div>

          <div className="flex justify-end pt-3">
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-[#C58B3C] text-[#23150F] text-xs font-bold hover:bg-[#B37B2F] transition shadow-md"
            >
              Save Security Limits
            </button>
          </div>
        </form>
      )}

      {/* ─── TAB 4: Admin Accounts Roster ─────────────────────────────────── */}
      {activeTab === 'admins' && (
        <div
          className="p-6 sm:p-8 rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB] space-y-6"
          style={{ boxShadow: '6px 6px 16px rgba(0,0,0,0.06), -6px -6px 16px rgba(255,255,255,0.9)' }}
        >
          <div className="flex items-center justify-between border-b border-[#D8CAAD] pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#C58B3C]">
                Privileged Access
              </span>
              <h2 className="font-cormorant text-2xl font-bold text-[#34150F] mt-0.5">
                Platform Administrators Roster
              </h2>
            </div>

            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#C58B3C] text-[#23150F] font-semibold text-xs tracking-wide shadow-sm hover:bg-[#B37B2F] transition"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Invite Admin</span>
            </button>
          </div>

          <div className="divide-y divide-[#D8CAAD]">
            {adminUsers.map((admin) => (
              <div key={admin.id} className="py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#23150F] text-[#C58B3C] font-bold text-xs flex items-center justify-center shrink-0 border border-[#3E271D]">
                    {admin.fullName.charAt(0)}
                  </div>
                  <div>
                    <span className="font-bold text-xs text-[#34150F] block">{admin.fullName}</span>
                    <span className="text-[11px] text-[#7D6855]">{admin.email}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Active Admin
                  </span>
                  <button
                    onClick={() => showToast(`Credentials audited for ${admin.fullName}.`)}
                    className="px-3 py-1.5 rounded-xl text-[11px] font-semibold border border-[#D8CAAD] text-[#5C4535] hover:bg-[#E5D7C5] transition"
                  >
                    Audit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Invite Admin Modal ────────────────────────────────────────────── */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsInviteModalOpen(false)}
          />

          <div
            className="relative w-full max-w-md bg-[#EFE5D8] rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#D8CAAD] z-10 space-y-5 animate-in zoom-in-95 duration-150"
            style={{ boxShadow: '8px 8px 24px rgba(0,0,0,0.15)' }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#D8CAAD]">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#C58B3C]">
                  Delegated Governance
                </span>
                <h3 className="font-cormorant text-2xl font-bold text-[#34150F]">
                  Invite Platform Administrator
                </h3>
              </div>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="p-2 rounded-full hover:bg-[#E5D7C5] text-[#5C4535]"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInviteAdmin} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-[#34150F] block mb-1">Full Legal Name</label>
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. Atty. Rodrigo Fernandez"
                  className="w-full p-2.5 rounded-xl bg-[#F5EDE2] border border-[#D8CAAD] text-xs text-[#34150F] focus:outline-none focus:border-[#C58B3C]"
                />
              </div>

              <div>
                <label className="font-bold text-[#34150F] block mb-1">Official Email Address</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="e.g. r.fernandez@justicia.ph"
                  className="w-full p-2.5 rounded-xl bg-[#F5EDE2] border border-[#D8CAAD] text-xs text-[#34150F] focus:outline-none focus:border-[#C58B3C]"
                />
              </div>

              <div>
                <label className="font-bold text-[#34150F] block mb-1">Administrative Designation</label>
                <select
                  value={inviteDesignation}
                  onChange={(e) => setInviteDesignation(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#F5EDE2] border border-[#D8CAAD] text-xs text-[#34150F] focus:outline-none focus:border-[#C58B3C]"
                >
                  <option value="Compliance Officer">Compliance Officer</option>
                  <option value="Legal Auditor">Legal Auditor</option>
                  <option value="System Administrator">System Administrator</option>
                  <option value="Super Administrator">Super Administrator</option>
                </select>
              </div>

              <div className="pt-3 border-t border-[#D8CAAD] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#D8CAAD] text-xs font-semibold text-[#5C4535] hover:bg-[#E5D7C5] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#C58B3C] text-[#23150F] text-xs font-bold hover:bg-[#B37B2F] transition shadow-md"
                >
                  Send Admin Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
