'use client';

import React, { useState } from 'react';

export function ClientSettingsView() {
  const [activeTab, setActiveTab] = useState<'notifications' | 'privacy' | 'security' | 'display'>('notifications');
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  // Notifications state
  const [emailConsults, setEmailConsults] = useState(true);
  const [smsHearings, setSmsHearings] = useState(true);
  const [aiSuggestions, setAiSuggestions] = useState(true);
  const [newsletterUpdates, setNewsletterUpdates] = useState(false);

  // Privacy state
  const [clientPrivilegeEncryption, setClientPrivilegeEncryption] = useState(true);
  const [aiHistoryRetention, setAiHistoryRetention] = useState('30days');

  // Security state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [autoLogoutTime, setAutoLogoutTime] = useState('30');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Language
  const [language, setLanguage] = useState('en');

  const triggerSave = (msg = 'Settings updated successfully') => {
    setSavedMessage(msg);
    setTimeout(() => setSavedMessage(null), 3000);
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;
    if (newPassword !== confirmPassword) {
      alert('New password and confirm password do not match.');
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    triggerSave('Password updated securely.');
  };

  return (
    <div className="p-4 sm:p-8 lg:p-10 max-w-5xl mx-auto space-y-6">
      {/* ─── Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-cormorant text-3xl sm:text-4xl font-bold text-[#34150F]">
            Client <span className="text-[#C58B3C]">Settings</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#7D6855] mt-1">
            Privacy controls, urgent court hearing notifications, and account credentials.
          </p>
        </div>

        {savedMessage && (
          <span className="text-xs font-semibold text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-3 py-1.5 rounded-xl animate-in fade-in">
            ✓ {savedMessage}
          </span>
        )}
      </div>

      {/* ─── Tabs ──────────────────────────────────────────────────────── */}
      <div className="flex border-b border-[#D8C7B4] gap-2 sm:gap-4 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('notifications')}
          className={`pb-2 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
            activeTab === 'notifications'
              ? 'border-[#C58B3C] text-[#34150F]'
              : 'border-transparent text-[#7D6855] hover:text-[#34150F]'
          }`}
        >
          Notifications & Alerts
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('privacy')}
          className={`pb-2 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
            activeTab === 'privacy'
              ? 'border-[#C58B3C] text-[#34150F]'
              : 'border-transparent text-[#7D6855] hover:text-[#34150F]'
          }`}
        >
          Privacy & Confidentiality
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
          Security & Password
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('display')}
          className={`pb-2 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
            activeTab === 'display'
              ? 'border-[#C58B3C] text-[#34150F]'
              : 'border-transparent text-[#7D6855] hover:text-[#34150F]'
          }`}
        >
          Language & Display
        </button>
      </div>

      {/* ─── Notification Settings ─────────────────────────────────────── */}
      {activeTab === 'notifications' && (
        <div className="neu-card rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[#D8C7B4]/60">
            <h3 className="font-cormorant font-bold text-xl text-[#34150F]">
              Consultation & Legal Alerts
            </h3>
            <button
              type="button"
              onClick={() => triggerSave('Notification preferences saved')}
              className="neu-btn-peach px-4 py-1.5 rounded-xl text-xs font-bold text-[#34150F]"
            >
              Save Preferences
            </button>
          </div>

          <div className="space-y-4 text-xs text-[#34150F]">
            <label className="neu-plate rounded-2xl p-4 flex items-center justify-between cursor-pointer">
              <div>
                <p className="font-bold">Email alerts for scheduled consultations</p>
                <p className="text-[#7D6855] text-[11px] mt-0.5">
                  Receive video room access links and attorney confirmation emails 24h & 1h prior.
                </p>
              </div>
              <input
                type="checkbox"
                checked={emailConsults}
                onChange={(e) => setEmailConsults(e.target.checked)}
                className="w-5 h-5 accent-[#C58B3C] cursor-pointer"
              />
            </label>

            <label className="neu-plate rounded-2xl p-4 flex items-center justify-between cursor-pointer">
              <div>
                <p className="font-bold">SMS alerts for urgent court notices & motion deadlines</p>
                <p className="text-[#7D6855] text-[11px] mt-0.5">
                  Instant text message notifications to your registered Philippine mobile number.
                </p>
              </div>
              <input
                type="checkbox"
                checked={smsHearings}
                onChange={(e) => setSmsHearings(e.target.checked)}
                className="w-5 h-5 accent-[#C58B3C] cursor-pointer"
              />
            </label>

            <label className="neu-plate rounded-2xl p-4 flex items-center justify-between cursor-pointer">
              <div>
                <p className="font-bold">AI Assistant recommendations & legal research digests</p>
                <p className="text-[#7D6855] text-[11px] mt-0.5">
                  In-app updates when relevant Philippine statutory codes or jurisprudence are cited.
                </p>
              </div>
              <input
                type="checkbox"
                checked={aiSuggestions}
                onChange={(e) => setAiSuggestions(e.target.checked)}
                className="w-5 h-5 accent-[#C58B3C] cursor-pointer"
              />
            </label>

            <label className="neu-plate rounded-2xl p-4 flex items-center justify-between cursor-pointer">
              <div>
                <p className="font-bold">Justicia legal advisories & regulatory bulletin</p>
                <p className="text-[#7D6855] text-[11px] mt-0.5">
                  Quarterly digests summarizing major new Philippine laws and Supreme Court rulings.
                </p>
              </div>
              <input
                type="checkbox"
                checked={newsletterUpdates}
                onChange={(e) => setNewsletterUpdates(e.target.checked)}
                className="w-5 h-5 accent-[#C58B3C] cursor-pointer"
              />
            </label>
          </div>
        </div>
      )}

      {/* ─── Privacy & Confidentiality ─────────────────────────────────── */}
      {activeTab === 'privacy' && (
        <div className="neu-card rounded-3xl p-6 sm:p-8 space-y-6">
          <h3 className="font-cormorant font-bold text-xl text-[#34150F] pb-3 border-b border-[#D8C7B4]/60">
            Attorney-Client Privilege & Data Governance
          </h3>

          <div className="space-y-4 text-xs">
            <div className="neu-plate rounded-2xl p-5 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-[#34150F]">End-to-End Privileged Encryption</h4>
                  <p className="text-[11px] text-[#7D6855]">
                    Encrypt case documents so only you and your retained counsel have decryption keys.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={clientPrivilegeEncryption}
                  onChange={(e) => setClientPrivilegeEncryption(e.target.checked)}
                  className="w-5 h-5 accent-[#C58B3C] cursor-pointer"
                />
              </div>
            </div>

            <div className="neu-plate rounded-2xl p-5 space-y-2">
              <h4 className="font-bold text-sm text-[#34150F]">AI Legal Assistant Transcript Retention</h4>
              <p className="text-[11px] text-[#7D6855]">
                Control how long conversational legal inquiries with the AI Assistant are preserved.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                {[
                  { id: 'none', label: 'Do Not Store' },
                  { id: '30days', label: 'Store for 30 Days' },
                  { id: 'permanent', label: 'Store Indefinitely' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setAiHistoryRetention(opt.id);
                      triggerSave(`AI retention set to ${opt.label}`);
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                      aiHistoryRetention === opt.id
                        ? 'neu-btn-peach text-[#34150F] border border-[#C58B3C]'
                        : 'neu-inset-sm text-[#7D6855]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="neu-plate rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-sm text-[#34150F]">Export Personal Legal Records</h4>
                <p className="text-[11px] text-[#7D6855]">
                  Download a certified archive of all your consultation logs and messages under RA 10173.
                </p>
              </div>
              <button
                type="button"
                onClick={() => triggerSave('Export archive generated and emailed.')}
                className="neu-btn px-4 py-2 rounded-xl text-xs font-semibold text-[#34150F] hover:text-[#C58B3C] shrink-0"
              >
                📥 Request Data Export
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Security & Password ───────────────────────────────────────── */}
      {activeTab === 'security' && (
        <div className="neu-card rounded-3xl p-6 sm:p-8 space-y-6">
          <h3 className="font-cormorant font-bold text-xl text-[#34150F] pb-3 border-b border-[#D8C7B4]/60">
            Account Security & Access Guards
          </h3>

          <form onSubmit={handlePasswordChange} className="neu-plate rounded-2xl p-5 space-y-4">
            <h4 className="font-bold text-sm text-[#34150F]">Change Password</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-[#7D6855] uppercase mb-1">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full neu-inset px-3 py-2 rounded-xl text-[#34150F] focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#7D6855] uppercase mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full neu-inset px-3 py-2 rounded-xl text-[#34150F] focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#7D6855] uppercase mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type new password"
                  className="w-full neu-inset px-3 py-2 rounded-xl text-[#34150F] focus:outline-none"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="neu-btn-peach px-5 py-2 rounded-xl text-xs font-bold text-[#34150F]"
              >
                Update Password
              </button>
            </div>
          </form>

          {/* Session Inactivity Timeout */}
          <div className="neu-plate rounded-2xl p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-sm text-[#34150F]">Inactivity Confidentiality Guard</h4>
                <p className="text-[11px] text-[#7D6855]">
                  Automatically logs you out when idle to protect sensitive legal documents on shared computers.
                </p>
              </div>
              <select
                value={autoLogoutTime}
                onChange={(e) => {
                  setAutoLogoutTime(e.target.value);
                  triggerSave(`Inactivity timeout set to ${e.target.value} minutes.`);
                }}
                className="neu-inset px-3 py-2 rounded-xl text-xs font-semibold text-[#34150F] focus:outline-none"
              >
                <option value="15">15 Minutes</option>
                <option value="30">30 Minutes (Recommended)</option>
                <option value="60">60 Minutes</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ─── Language & Display ────────────────────────────────────────── */}
      {activeTab === 'display' && (
        <div className="neu-card rounded-3xl p-6 sm:p-8 space-y-6">
          <h3 className="font-cormorant font-bold text-xl text-[#34150F] pb-3 border-b border-[#D8C7B4]/60">
            Language & Regional Localization
          </h3>

          <div className="neu-plate rounded-2xl p-5 space-y-4">
            <div>
              <h4 className="font-bold text-sm text-[#34150F]">Interface & Legal Vocabulary Language</h4>
              <p className="text-[11px] text-[#7D6855]">
                Select your preferred dialect for guidance prompts and AI Assistant legal summaries.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { code: 'en', name: 'English (PH)' },
                { code: 'fil', name: 'Filipino / Tagalog' },
                { code: 'ceb', name: 'Cebuano / Bisaya' },
                { code: 'ilo', name: 'Ilocano' },
              ].map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    setLanguage(lang.code);
                    triggerSave(`Language set to ${lang.name}`);
                  }}
                  className={`py-3 px-4 rounded-2xl text-xs font-bold transition-all text-center ${
                    language === lang.code
                      ? 'neu-btn-peach text-[#34150F] border border-[#C58B3C]'
                      : 'neu-inset-sm text-[#7D6855]'
                  }`}
                >
                  {lang.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
