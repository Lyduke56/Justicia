'use client';

import React, { useState } from 'react';
import { GearIcon, ShieldCheckIcon, SparklesIcon, DocumentTextIcon } from './AdminIcons';

export function AdminSettingsView() {
  const [activeTab, setActiveTab] = useState<'general' | 'operations' | 'features' | 'policies'>('general');
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  // General settings
  const [platformName, setPlatformName] = useState('Justicia — Philippine AI Legal Aid & Counsel Network');
  const [supportEmail, setSupportEmail] = useState('support@justicia.ph');
  const [legalVersion, setLegalVersion] = useState('v2.4 (October 2026)');

  // Maintenance & Ops
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceBanner, setMaintenanceBanner] = useState('Justicia is performing scheduled Supreme Court circular index maintenance. All urgent consultation rooms remain online.');
  const [registrationGate, setRegistrationGate] = useState<'open' | 'review' | 'paused'>('review');

  // Feature Flags
  const [aiAssistantActive, setAiAssistantActive] = useState(true);
  const [aiModel, setAiModel] = useState('ph-jurisprudence-v2');
  const [videoConferencingProvider, setVideoConferencingProvider] = useState('daily');
  const [paymentGatewayMode, setPaymentGatewayMode] = useState<'sandbox' | 'live'>('sandbox');

  // Policy & Fee Caps
  const [maxHourlyCap, setMaxHourlyCap] = useState('10000');
  const [platformFeePercent, setPlatformFeePercent] = useState('10');
  const [cancellationWindowHours, setCancellationWindowHours] = useState('24');
  const [auditLogRetentionDays, setAuditLogRetentionDays] = useState('365');

  const triggerSave = (msg = 'System settings updated.') => {
    setSavedMessage(msg);
    setTimeout(() => setSavedMessage(null), 3000);
  };

  return (
    <div className="p-4 sm:p-8 lg:p-10 max-w-5xl mx-auto space-y-6">
      {/* ─── Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-cormorant text-3xl sm:text-4xl font-bold text-[#34150F]">
            System <span className="text-[#C58B3C]">Settings</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#7D6855] mt-1">
            Global platform governance, maintenance controls, AI parameters, and judicial compliance rules.
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
          onClick={() => setActiveTab('general')}
          className={`pb-2 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
            activeTab === 'general'
              ? 'border-[#C58B3C] text-[#34150F]'
              : 'border-transparent text-[#7D6855] hover:text-[#34150F]'
          }`}
        >
          Platform Configuration
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('operations')}
          className={`pb-2 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
            activeTab === 'operations'
              ? 'border-[#C58B3C] text-[#34150F]'
              : 'border-transparent text-[#7D6855] hover:text-[#34150F]'
          }`}
        >
          Maintenance & Access Gate
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('features')}
          className={`pb-2 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
            activeTab === 'features'
              ? 'border-[#C58B3C] text-[#34150F]'
              : 'border-transparent text-[#7D6855] hover:text-[#34150F]'
          }`}
        >
          Feature Flags & AI Engine
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('policies')}
          className={`pb-2 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
            activeTab === 'policies'
              ? 'border-[#C58B3C] text-[#34150F]'
              : 'border-transparent text-[#7D6855] hover:text-[#34150F]'
          }`}
        >
          Fee Caps & Retention Policies
        </button>
      </div>

      {/* ─── Platform Configuration ────────────────────────────────────── */}
      {activeTab === 'general' && (
        <div className="neu-card rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[#D8C7B4]/60">
            <div>
              <h3 className="font-cormorant font-bold text-xl text-[#34150F]">
                General Platform Identity
              </h3>
              <p className="text-xs text-[#7D6855]">
                Information shown in official email notices and footer documentation.
              </p>
            </div>
            <button
              type="button"
              onClick={() => triggerSave('Platform identity saved')}
              className="neu-btn-peach px-4 py-1.5 rounded-xl text-xs font-bold text-[#34150F]"
            >
              Save Changes
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold text-[#7D6855] uppercase mb-1">Platform Brand Title</label>
              <input
                type="text"
                value={platformName}
                onChange={(e) => setPlatformName(e.target.value)}
                className="w-full neu-inset px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[#34150F]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#7D6855] uppercase mb-1">Official Support & Helpdesk Email</label>
              <input
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                className="w-full neu-inset px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[#34150F]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#7D6855] uppercase mb-1">Published Legal Terms Version</label>
              <input
                type="text"
                value={legalVersion}
                onChange={(e) => setLegalVersion(e.target.value)}
                className="w-full neu-inset px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[#34150F]"
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── Maintenance & Ops ─────────────────────────────────────────── */}
      {activeTab === 'operations' && (
        <div className="neu-card rounded-3xl p-6 sm:p-8 space-y-6">
          <h3 className="font-cormorant font-bold text-xl text-[#34150F] pb-3 border-b border-[#D8C7B4]/60">
            System Operational Modes & Access Gating
          </h3>

          <div className="space-y-4 text-xs text-[#34150F]">
            {/* Maintenance Mode */}
            <div className="neu-plate rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm">System Maintenance Mode</h4>
                  <p className="text-[11px] text-[#7D6855]">
                    Displays a top banner and restricts non-essential updates while database migrations occur.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={maintenanceMode}
                  onChange={(e) => {
                    setMaintenanceMode(e.target.checked);
                    triggerSave(e.target.checked ? 'Maintenance mode enabled' : 'Maintenance mode disabled');
                  }}
                  className="w-5 h-5 accent-[#C58B3C] cursor-pointer"
                />
              </div>

              {maintenanceMode && (
                <div className="pt-2 animate-in fade-in">
                  <label className="block text-[10px] font-bold text-[#7D6855] uppercase mb-1">Public Broadcast Banner</label>
                  <textarea
                    rows={2}
                    value={maintenanceBanner}
                    onChange={(e) => setMaintenanceBanner(e.target.value)}
                    className="w-full neu-inset px-3 py-2 rounded-xl text-xs text-[#34150F]"
                  />
                </div>
              )}
            </div>

            {/* Registration Gate */}
            <div className="neu-plate rounded-2xl p-5 space-y-3">
              <h4 className="font-bold text-sm">New Lawyer Registration Gate</h4>
              <p className="text-[11px] text-[#7D6855]">
                Control onboarding access for new Philippine Bar applicant attorneys.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {[
                  { id: 'open', label: 'Open Registration' },
                  { id: 'review', label: 'Mandatory Admin Review' },
                  { id: 'paused', label: 'Temporarily Paused' },
                ].map((gate) => (
                  <button
                    key={gate.id}
                    type="button"
                    onClick={() => {
                      setRegistrationGate(gate.id as any);
                      triggerSave(`Registration gate set to ${gate.label}`);
                    }}
                    className={`py-2.5 px-3 rounded-xl font-bold transition-all ${
                      registrationGate === gate.id
                        ? 'neu-btn-peach text-[#34150F] border border-[#C58B3C]'
                        : 'neu-inset-sm text-[#7D6855]'
                    }`}
                  >
                    {gate.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Feature Flags & AI ────────────────────────────────────────── */}
      {activeTab === 'features' && (
        <div className="neu-card rounded-3xl p-6 sm:p-8 space-y-6">
          <h3 className="font-cormorant font-bold text-xl text-[#34150F] pb-3 border-b border-[#D8C7B4]/60">
            Feature Flags & AI Legal Engine Orchestration
          </h3>

          <div className="space-y-4 text-xs text-[#34150F]">
            <div className="neu-plate rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm">AI Legal Research Assistant</h4>
                  <p className="text-[11px] text-[#7D6855]">
                    Enable or disable conversational legal retrieval across Civil, Labor, and Corporation codes.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={aiAssistantActive}
                  onChange={(e) => {
                    setAiAssistantActive(e.target.checked);
                    triggerSave(e.target.checked ? 'AI Assistant active' : 'AI Assistant paused');
                  }}
                  className="w-5 h-5 accent-[#C58B3C] cursor-pointer"
                />
              </div>

              {aiAssistantActive && (
                <div className="pt-2">
                  <label className="block text-[10px] font-bold text-[#7D6855] uppercase mb-1">Target Engine Model</label>
                  <select
                    value={aiModel}
                    onChange={(e) => {
                      setAiModel(e.target.value);
                      triggerSave(`AI Model set to ${e.target.value}`);
                    }}
                    className="neu-inset px-3 py-2 rounded-xl text-xs font-semibold text-[#34150F]"
                  >
                    <option value="ph-jurisprudence-v2">Justicia-PH Jurisprudence v2 (Optimized for PH Codes)</option>
                    <option value="gemini-2.5-flash">Google Gemini 2.5 Flash</option>
                  </select>
                </div>
              )}
            </div>

            {/* Video Provider */}
            <div className="neu-plate rounded-2xl p-5 space-y-2">
              <h4 className="font-bold text-sm">Consultation Video Conferencing Engine</h4>
              <p className="text-[11px] text-[#7D6855]">WebRTC infrastructure for attorney-client face-to-face sessions.</p>
              <select
                value={videoConferencingProvider}
                onChange={(e) => {
                  setVideoConferencingProvider(e.target.value);
                  triggerSave(`Video provider set to ${e.target.value}`);
                }}
                className="neu-inset px-3 py-2 rounded-xl text-xs font-semibold text-[#34150F]"
              >
                <option value="daily">Daily.co (Encrypted WebRTC PH Rooms)</option>
                <option value="jitsi">Jitsi Meet On-Premise Gateway</option>
              </select>
            </div>

            {/* Payment Mode */}
            <div className="neu-plate rounded-2xl p-5 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm">PayMongo / Maya Payment Gateway Environment</h4>
                <p className="text-[11px] text-[#7D6855]">Toggle between test sandbox and live credit card / e-wallet processing.</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentGatewayMode('sandbox');
                    triggerSave('Payment gateway set to Sandbox Test Mode');
                  }}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs ${
                    paymentGatewayMode === 'sandbox'
                      ? 'bg-amber-600 text-white'
                      : 'neu-inset-sm text-[#7D6855]'
                  }`}
                >
                  🧪 Sandbox Mode
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentGatewayMode('live');
                    triggerSave('Payment gateway set to Live Production Mode');
                  }}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs ${
                    paymentGatewayMode === 'live'
                      ? 'bg-emerald-700 text-white'
                      : 'neu-inset-sm text-[#7D6855]'
                  }`}
                >
                  🚀 Live Production
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Policies & Fee Caps ───────────────────────────────────────── */}
      {activeTab === 'policies' && (
        <div className="neu-card rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[#D8C7B4]/60">
            <div>
              <h3 className="font-cormorant font-bold text-xl text-[#34150F]">
                Fee Caps & Audit Compliance
              </h3>
              <p className="text-xs text-[#7D6855]">
                Ethical fee constraints in accordance with the Supreme Court Code of Professional Responsibility and Accountability (CPRA).
              </p>
            </div>
            <button
              type="button"
              onClick={() => triggerSave('Regulatory policies saved')}
              className="neu-btn-peach px-4 py-1.5 rounded-xl text-xs font-bold text-[#34150F]"
            >
              Save Policies
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="neu-plate rounded-2xl p-4 space-y-2">
              <label className="block font-bold">Hourly Consultation Fee Ceiling (₱)</label>
              <p className="text-[11px] text-[#7D6855]">Maximum rate attorneys can set per hour on Justicia.</p>
              <input
                type="number"
                value={maxHourlyCap}
                onChange={(e) => setMaxHourlyCap(e.target.value)}
                className="w-full neu-inset px-3 py-2 rounded-xl font-bold text-[#34150F]"
              />
            </div>

            <div className="neu-plate rounded-2xl p-4 space-y-2">
              <label className="block font-bold">Platform Retainer Commission (%)</label>
              <p className="text-[11px] text-[#7D6855]">Administrative infrastructure percentage deducted from consultations.</p>
              <input
                type="number"
                value={platformFeePercent}
                onChange={(e) => setPlatformFeePercent(e.target.value)}
                className="w-full neu-inset px-3 py-2 rounded-xl font-bold text-[#34150F]"
              />
            </div>

            <div className="neu-plate rounded-2xl p-4 space-y-2">
              <label className="block font-bold">Client Cancellation Refund Window (Hours)</label>
              <p className="text-[11px] text-[#7D6855]">Notice required before consultation start time for 100% refund.</p>
              <input
                type="number"
                value={cancellationWindowHours}
                onChange={(e) => setCancellationWindowHours(e.target.value)}
                className="w-full neu-inset px-3 py-2 rounded-xl font-bold text-[#34150F]"
              />
            </div>

            <div className="neu-plate rounded-2xl p-4 space-y-2">
              <label className="block font-bold">Security Audit Log Retention (Days)</label>
              <p className="text-[11px] text-[#7D6855]">Duration system audit events remain immutable in database.</p>
              <select
                value={auditLogRetentionDays}
                onChange={(e) => setAuditLogRetentionDays(e.target.value)}
                className="w-full neu-inset px-3 py-2 rounded-xl font-semibold text-[#34150F]"
              >
                <option value="90">90 Days</option>
                <option value="180">180 Days</option>
                <option value="365">365 Days (1 Year)</option>
                <option value="730">730 Days (2 Years)</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
