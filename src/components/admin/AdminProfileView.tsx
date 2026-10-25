'use client';

import React, { useState } from 'react';
import { UserCircleIcon, ShieldCheckIcon, DocumentTextIcon, GearIcon } from './AdminIcons';

interface AdminProfileViewProps {
  initialData?: {
    fullName?: string;
    email?: string;
    adminId?: string;
    department?: string;
    roleTitle?: string;
    clearanceLevel?: string;
  };
}

export function AdminProfileView({ initialData }: AdminProfileViewProps) {
  const [activeTab, setActiveTab] = useState<'credentials' | 'security' | 'activity' | 'permissions'>('credentials');
  const [isEditing, setIsEditing] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [form, setForm] = useState({
    fullName: initialData?.fullName || 'Atty. Rafael Mendoza',
    email: initialData?.email || 'admin.mendoza@justicia.ph',
    adminId: initialData?.adminId || 'ADM-PH-2026-0042',
    department: initialData?.department || 'Judicial Compliance & Platform Operations',
    roleTitle: initialData?.roleTitle || 'Chief System Administrator & Compliance Counsel',
    clearanceLevel: initialData?.clearanceLevel || 'Level 3 — Master Administrator',
    phone: '+63 (2) 8999 1234',
    officeLocation: 'Justicia Operations Center, 18F Cyberpod One, Pasig City',
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditing(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3500);
  };

  return (
    <div className="p-4 sm:p-8 lg:p-10 max-w-5xl mx-auto space-y-6">
      {/* ─── Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-cormorant text-3xl sm:text-4xl font-bold text-[#34150F]">
            Administrator <span className="text-[#C58B3C]">Profile</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#7D6855] mt-1">
            Official system credentials, judicial oversight privileges, and administrative security logs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {savedSuccess && (
            <span className="text-xs font-semibold text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-3 py-1.5 rounded-xl animate-in fade-in">
              ✓ Admin profile saved
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="neu-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-[#34150F] hover:text-[#C58B3C]"
          >
            {isEditing ? 'Cancel' : '✎ Edit Officer Details'}
          </button>
        </div>
      </div>

      {/* ─── Admin Overview Card ───────────────────────────────────────── */}
      <div className="neu-card rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full neu-inset flex items-center justify-center text-[#5C4535] relative shrink-0">
            <UserCircleIcon className="w-14 h-14 sm:w-16 sm:h-16 text-[#C58B3C]" />
            <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-[#C58B3C] border-2 border-[#ECE1D2] flex items-center justify-center text-[10px] text-white font-bold" title="Master Admin">
              ★
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-cormorant font-bold text-2xl sm:text-3xl text-[#34150F]">
                {form.fullName}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-[#C58B3C]/20 text-[#8C6020] border border-[#C58B3C]/40 text-[10px] font-bold tracking-wider uppercase">
                {form.clearanceLevel}
              </span>
            </div>
            <p className="text-xs text-[#7D6855]">{form.roleTitle}</p>
            <p className="text-xs text-[#5C4535] font-mono font-medium">{form.adminId} • {form.email}</p>
          </div>
        </div>

        {/* Security Status Box */}
        <div className="neu-plate rounded-2xl p-4 text-center space-y-1 min-w-[190px]">
          <span className="text-[10px] uppercase font-bold text-[#7D6855] tracking-wider block">Security Status</span>
          <span className="text-xs font-bold text-emerald-800 block">🔒 Hardware 2FA Active</span>
          <span className="text-[10px] text-[#5C4535] block">30-min Inactivity Guard</span>
        </div>
      </div>

      {/* ─── Navigation Tabs ───────────────────────────────────────────── */}
      <div className="flex border-b border-[#D8C7B4] gap-2 sm:gap-4 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('credentials')}
          className={`pb-2 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
            activeTab === 'credentials'
              ? 'border-[#C58B3C] text-[#34150F]'
              : 'border-transparent text-[#7D6855] hover:text-[#34150F]'
          }`}
        >
          Officer Details & Department
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`pb-2 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
            activeTab === 'security'
              ? 'border-[#C58B3C] text-[#34150F]'
              : 'border-transparent text-[#7D6855] hover:text-[#34150F]'
          }`}
        >
          Security & Active Sessions
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('activity')}
          className={`pb-2 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
            activeTab === 'activity'
              ? 'border-[#C58B3C] text-[#34150F]'
              : 'border-transparent text-[#7D6855] hover:text-[#34150F]'
          }`}
        >
          Recent Administrative Actions
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('permissions')}
          className={`pb-2 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
            activeTab === 'permissions'
              ? 'border-[#C58B3C] text-[#34150F]'
              : 'border-transparent text-[#7D6855] hover:text-[#34150F]'
          }`}
        >
          Access Matrix & Privileges
        </button>
      </div>

      {/* ─── Tab Content ────────────────────────────────────────────────── */}
      {activeTab === 'credentials' && (
        <form onSubmit={handleSave} className="neu-card rounded-3xl p-6 sm:p-8 space-y-6">
          <h3 className="font-cormorant font-bold text-xl text-[#34150F] pb-3 border-b border-[#D8C7B4]/60">
            Administrative Officer Credentials
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-[#7D6855] uppercase tracking-wider mb-1">
                Full Name
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className="w-full neu-inset px-3.5 py-2.5 rounded-xl text-[#34150F] focus:outline-none"
                  required
                />
              ) : (
                <div className="neu-inset-sm px-3.5 py-2.5 rounded-xl font-medium text-[#34150F]">
                  {form.fullName}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#7D6855] uppercase tracking-wider mb-1">
                Official Administrator Email
              </label>
              <div className="neu-inset-sm px-3.5 py-2.5 rounded-xl font-medium text-[#5C4535] bg-[#E2D4C0]">
                {form.email}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#7D6855] uppercase tracking-wider mb-1">
                Admin Officer ID
              </label>
              <div className="neu-inset-sm px-3.5 py-2.5 rounded-xl font-mono font-bold text-[#34150F]">
                {form.adminId}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#7D6855] uppercase tracking-wider mb-1">
                Assigned Department
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className="w-full neu-inset px-3.5 py-2.5 rounded-xl text-[#34150F] focus:outline-none"
                />
              ) : (
                <div className="neu-inset-sm px-3.5 py-2.5 rounded-xl font-medium text-[#34150F]">
                  {form.department}
                </div>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-[#7D6855] uppercase tracking-wider mb-1">
                Designated Operations Center
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={form.officeLocation}
                  onChange={(e) => setForm({ ...form, officeLocation: e.target.value })}
                  className="w-full neu-inset px-3.5 py-2.5 rounded-xl text-[#34150F] focus:outline-none"
                />
              ) : (
                <div className="neu-inset-sm px-3.5 py-2.5 rounded-xl font-medium text-[#34150F]">
                  {form.officeLocation}
                </div>
              )}
            </div>
          </div>

          {isEditing && (
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-5 py-2 rounded-xl text-xs font-semibold text-[#5C4535]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="neu-btn-peach px-6 py-2.5 rounded-xl text-xs font-bold text-[#34150F]"
              >
                Save Officer Details
              </button>
            </div>
          )}
        </form>
      )}

      {activeTab === 'security' && (
        <div className="neu-card rounded-3xl p-6 sm:p-8 space-y-6">
          <h3 className="font-cormorant font-bold text-xl text-[#34150F] pb-3 border-b border-[#D8C7B4]/60">
            Security Authentication & Session Safeguards
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="neu-plate rounded-2xl p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-[#34150F]">Two-Factor Authentication (FIDO2)</span>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Enforced
                </span>
              </div>
              <p className="text-[11px] text-[#5C4535]">
                Hardware key (YubiKey 5 NFC) + Authenticator TOTP backup registered.
              </p>
            </div>

            <div className="neu-plate rounded-2xl p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-[#34150F]">Inactivity Logout Guard</span>
                <span className="text-[10px] font-bold text-[#8C6020] bg-[#C58B3C]/20 px-2 py-0.5 rounded-full">
                  30 Minutes
                </span>
              </div>
              <p className="text-[11px] text-[#5C4535]">
                Strict adherence to Philippine government administrative security policies.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="neu-card rounded-3xl p-6 sm:p-8 space-y-4">
          <h3 className="font-cormorant font-bold text-xl text-[#34150F] pb-3 border-b border-[#D8C7B4]/60">
            Recent Audit Log Operations
          </h3>

          <div className="space-y-3">
            <div className="neu-plate rounded-2xl p-4 flex items-center justify-between text-xs">
              <div>
                <p className="font-bold text-[#34150F]">Approved Lawyer Application</p>
                <p className="text-[#7D6855]">Atty. Maria Santos • SC Roll #78910 verified against Supreme Court registry</p>
              </div>
              <span className="text-[#5C4535] font-mono text-[11px]">Today, 11:24 AM</span>
            </div>

            <div className="neu-plate rounded-2xl p-4 flex items-center justify-between text-xs">
              <div>
                <p className="font-bold text-[#34150F]">Knowledge Base Sync: Revised Corporation Code</p>
                <p className="text-[#7D6855]">Updated Republic Act No. 11232 legal embeddings for AI Assistant</p>
              </div>
              <span className="text-[#5C4535] font-mono text-[11px]">Yesterday, 4:15 PM</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'permissions' && (
        <div className="neu-card rounded-3xl p-6 sm:p-8 space-y-4">
          <h3 className="font-cormorant font-bold text-xl text-[#34150F] pb-3 border-b border-[#D8C7B4]/60">
            System Privileges Matrix
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="neu-inset-sm p-3.5 rounded-xl flex items-center justify-between">
              <span className="font-medium text-[#34150F]">Lawyer Verification Queue</span>
              <span className="font-bold text-emerald-800">Full Approval & Reject</span>
            </div>
            <div className="neu-inset-sm p-3.5 rounded-xl flex items-center justify-between">
              <span className="font-medium text-[#34150F]">User Account Moderation</span>
              <span className="font-bold text-emerald-800">Suspend / Reactivate</span>
            </div>
            <div className="neu-inset-sm p-3.5 rounded-xl flex items-center justify-between">
              <span className="font-medium text-[#34150F]">AI Model Prompts & Knowledge Base</span>
              <span className="font-bold text-emerald-800">Publish & Re-Index</span>
            </div>
            <div className="neu-inset-sm p-3.5 rounded-xl flex items-center justify-between">
              <span className="font-medium text-[#34150F]">Security Audit Logs</span>
              <span className="font-bold text-[#8C6020]">Read-Only Immutable</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
