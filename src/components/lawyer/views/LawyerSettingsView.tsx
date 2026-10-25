'use client';

import React, { useState } from 'react';

export function LawyerSettingsView() {
  const [activeTab, setActiveTab] = useState<'availability' | 'payout' | 'intake' | 'notifications'>('availability');
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  // Availability state
  const [workDays, setWorkDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [bufferTime, setBufferTime] = useState('15');
  const [vacationMode, setVacationMode] = useState(false);

  // Payout state
  const [payoutMethod, setPayoutMethod] = useState<'bank' | 'gcash' | 'maya'>('bank');
  const [bankName, setBankName] = useState('Bank of the Philippine Islands (BPI)');
  const [accountNumber, setAccountNumber] = useState('1234-5678-90');
  const [accountName, setAccountName] = useState('Atty. Maria Santos');
  const [tinNumber, setTinNumber] = useState('123-456-789-000');

  // Intake preferences
  const [autoAcceptVerified, setAutoAcceptVerified] = useState(true);
  const [requireBrief, setRequireBrief] = useState(true);
  const [minLeadTime, setMinLeadTime] = useState('24');
  const [maxDailyConsults, setMaxDailyConsults] = useState('4');

  // Notifications
  const [smsUrgent, setSmsUrgent] = useState(true);
  const [emailCalendar, setEmailCalendar] = useState(true);
  const [googleCalendarSync, setGoogleCalendarSync] = useState(true);

  const triggerSave = (msg = 'Practice settings updated.') => {
    setSavedMessage(msg);
    setTimeout(() => setSavedMessage(null), 3000);
  };

  const toggleDay = (day: string) => {
    setWorkDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  return (
    <div className="p-4 sm:p-8 lg:p-10 max-w-5xl mx-auto space-y-6">
      {/* ─── Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-cormorant text-3xl sm:text-4xl font-bold text-[#34150F]">
            Counsel <span className="text-[#C58B3C]">Settings</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#7D6855] mt-1">
            Configure calendar availability, consultation payouts, and client intake parameters.
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
          onClick={() => setActiveTab('availability')}
          className={`pb-2 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
            activeTab === 'availability'
              ? 'border-[#C58B3C] text-[#34150F]'
              : 'border-transparent text-[#7D6855] hover:text-[#34150F]'
          }`}
        >
          Working Hours & Calendar
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('payout')}
          className={`pb-2 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
            activeTab === 'payout'
              ? 'border-[#C58B3C] text-[#34150F]'
              : 'border-transparent text-[#7D6855] hover:text-[#34150F]'
          }`}
        >
          Payouts & BIR TIN
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('intake')}
          className={`pb-2 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
            activeTab === 'intake'
              ? 'border-[#C58B3C] text-[#34150F]'
              : 'border-transparent text-[#7D6855] hover:text-[#34150F]'
          }`}
        >
          Client Intake Rules
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('notifications')}
          className={`pb-2 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
            activeTab === 'notifications'
              ? 'border-[#C58B3C] text-[#34150F]'
              : 'border-transparent text-[#7D6855] hover:text-[#34150F]'
          }`}
        >
          Calendar Sync & Alerts
        </button>
      </div>

      {/* ─── Availability ──────────────────────────────────────────────── */}
      {activeTab === 'availability' && (
        <div className="neu-card rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[#D8C7B4]/60">
            <div>
              <h3 className="font-cormorant font-bold text-xl text-[#34150F]">
                Weekly Consultation Hours
              </h3>
              <p className="text-xs text-[#7D6855]">
                Only active slots are offered to clients in the consultation booking catalog.
              </p>
            </div>
            <button
              type="button"
              onClick={() => triggerSave('Schedule saved')}
              className="neu-btn-peach px-4 py-1.5 rounded-xl text-xs font-bold text-[#34150F]"
            >
              Save Schedule
            </button>
          </div>

          <div className="space-y-5 text-xs text-[#34150F]">
            <div>
              <label className="block text-[11px] font-bold text-[#7D6855] uppercase tracking-wider mb-2">
                Available Consultation Days
              </label>
              <div className="flex flex-wrap gap-2">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                  const active = workDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`px-4 py-2.5 rounded-xl font-bold transition-all ${
                        active
                          ? 'neu-plate-sm text-[#34150F] border border-[#C58B3C]'
                          : 'neu-inset-sm text-[#7D6855]'
                      }`}
                    >
                      {active ? '✓ ' : ''}{day}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-[#7D6855] uppercase mb-1">Daily Start Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full neu-inset px-3 py-2 rounded-xl text-xs font-semibold text-[#34150F]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#7D6855] uppercase mb-1">Daily End Time</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full neu-inset px-3 py-2 rounded-xl text-xs font-semibold text-[#34150F]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#7D6855] uppercase mb-1">Buffer Between Consults</label>
                <select
                  value={bufferTime}
                  onChange={(e) => setBufferTime(e.target.value)}
                  className="w-full neu-inset px-3 py-2 rounded-xl text-xs font-semibold text-[#34150F]"
                >
                  <option value="10">10 Minutes</option>
                  <option value="15">15 Minutes</option>
                  <option value="30">30 Minutes</option>
                </select>
              </div>
            </div>

            {/* Vacation Mode Toggle */}
            <div className="neu-plate rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="font-bold">Out of Office / Vacation Mode</p>
                <p className="text-[11px] text-[#7D6855]">
                  Temporarily pause new booking requests while keeping existing retained client consultations.
                </p>
              </div>
              <input
                type="checkbox"
                checked={vacationMode}
                onChange={(e) => {
                  setVacationMode(e.target.checked);
                  triggerSave(e.target.checked ? 'Vacation mode activated' : 'Vacation mode turned off');
                }}
                className="w-5 h-5 accent-[#C58B3C] cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── Payout & BIR TIN ───────────────────────────────────────────── */}
      {activeTab === 'payout' && (
        <div className="neu-card rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[#D8C7B4]/60">
            <div>
              <h3 className="font-cormorant font-bold text-xl text-[#34150F]">
                Disbursement Account & Tax Records
              </h3>
              <p className="text-xs text-[#7D6855]">
                Consultation earnings are settled weekly via Philippine PESONet or InstaPay.
              </p>
            </div>
            <button
              type="button"
              onClick={() => triggerSave('Payout account updated')}
              className="neu-btn-peach px-4 py-1.5 rounded-xl text-xs font-bold text-[#34150F]"
            >
              Save Account
            </button>
          </div>

          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'bank', label: '🏦 Bank Transfer (PESONet)' },
                { id: 'gcash', label: '📱 GCash Pro' },
                { id: 'maya', label: '💳 Maya Business' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPayoutMethod(m.id as any)}
                  className={`py-3 px-3 rounded-2xl text-xs font-bold transition-all text-center ${
                    payoutMethod === m.id
                      ? 'neu-btn-peach text-[#34150F] border border-[#C58B3C]'
                      : 'neu-inset-sm text-[#7D6855]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-[#7D6855] uppercase mb-1">Bank / Provider</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full neu-inset px-3 py-2.5 rounded-xl text-xs font-semibold text-[#34150F]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#7D6855] uppercase mb-1">Account Number / Mobile Number</label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full neu-inset px-3 py-2.5 rounded-xl text-xs font-mono font-semibold text-[#34150F]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#7D6855] uppercase mb-1">Account Beneficiary Name</label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full neu-inset px-3 py-2.5 rounded-xl text-xs font-semibold text-[#34150F]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#7D6855] uppercase mb-1">Bureau of Internal Revenue (BIR) TIN</label>
                <input
                  type="text"
                  value={tinNumber}
                  onChange={(e) => setTinNumber(e.target.value)}
                  placeholder="000-000-000-000"
                  className="w-full neu-inset px-3 py-2.5 rounded-xl text-xs font-mono font-semibold text-[#34150F]"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Intake Rules ──────────────────────────────────────────────── */}
      {activeTab === 'intake' && (
        <div className="neu-card rounded-3xl p-6 sm:p-8 space-y-6">
          <h3 className="font-cormorant font-bold text-xl text-[#34150F] pb-3 border-b border-[#D8C7B4]/60">
            Client Consultation Intake Policy
          </h3>

          <div className="space-y-4 text-xs text-[#34150F]">
            <label className="neu-plate rounded-2xl p-4 flex items-center justify-between cursor-pointer">
              <div>
                <p className="font-bold">Auto-Confirm Verified Philippine Clients</p>
                <p className="text-[#7D6855] text-[11px] mt-0.5">
                  Appointments are immediately booked into your calendar without requiring manual counsel approval.
                </p>
              </div>
              <input
                type="checkbox"
                checked={autoAcceptVerified}
                onChange={(e) => setAutoAcceptVerified(e.target.checked)}
                className="w-5 h-5 accent-[#C58B3C] cursor-pointer"
              />
            </label>

            <label className="neu-plate rounded-2xl p-4 flex items-center justify-between cursor-pointer">
              <div>
                <p className="font-bold">Require Case Intake Brief Questionnaire</p>
                <p className="text-[#7D6855] text-[11px] mt-0.5">
                  Clients must fill out a 3-question case summary before finalizing their consultation booking.
                </p>
              </div>
              <input
                type="checkbox"
                checked={requireBrief}
                onChange={(e) => setRequireBrief(e.target.checked)}
                className="w-5 h-5 accent-[#C58B3C] cursor-pointer"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="neu-plate rounded-2xl p-4">
                <label className="block font-bold text-xs mb-1">Minimum Booking Lead Time</label>
                <p className="text-[#7D6855] text-[11px] mb-2">Advance notice required before a session.</p>
                <select
                  value={minLeadTime}
                  onChange={(e) => setMinLeadTime(e.target.value)}
                  className="w-full neu-inset px-3 py-2 rounded-xl text-xs font-semibold text-[#34150F]"
                >
                  <option value="12">12 Hours</option>
                  <option value="24">24 Hours (Standard)</option>
                  <option value="48">48 Hours</option>
                </select>
              </div>

              <div className="neu-plate rounded-2xl p-4">
                <label className="block font-bold text-xs mb-1">Daily Consultation Ceiling</label>
                <p className="text-[#7D6855] text-[11px] mb-2">Maximum appointment slots per day.</p>
                <select
                  value={maxDailyConsults}
                  onChange={(e) => setMaxDailyConsults(e.target.value)}
                  className="w-full neu-inset px-3 py-2 rounded-xl text-xs font-semibold text-[#34150F]"
                >
                  <option value="3">3 Sessions / Day</option>
                  <option value="4">4 Sessions / Day</option>
                  <option value="6">6 Sessions / Day</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Calendar Sync ─────────────────────────────────────────────── */}
      {activeTab === 'notifications' && (
        <div className="neu-card rounded-3xl p-6 sm:p-8 space-y-6">
          <h3 className="font-cormorant font-bold text-xl text-[#34150F] pb-3 border-b border-[#D8C7B4]/60">
            External Calendar Synchronization
          </h3>

          <div className="space-y-4 text-xs">
            <div className="neu-plate rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="font-bold text-sm text-[#34150F]">Google Calendar Real-Time Sync</p>
                <p className="text-[11px] text-[#7D6855]">
                  Automatically block dates on Justicia when court hearings or external trials are scheduled.
                </p>
              </div>
              <input
                type="checkbox"
                checked={googleCalendarSync}
                onChange={(e) => setGoogleCalendarSync(e.target.checked)}
                className="w-5 h-5 accent-[#C58B3C] cursor-pointer"
              />
            </div>

            <div className="neu-plate rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="font-bold text-sm text-[#34150F]">SMS Consultation Urgent Reminders</p>
                <p className="text-[11px] text-[#7D6855]">
                  Receive an automated SMS 30 minutes prior to a client video consultation session.
                </p>
              </div>
              <input
                type="checkbox"
                checked={smsUrgent}
                onChange={(e) => setSmsUrgent(e.target.checked)}
                className="w-5 h-5 accent-[#C58B3C] cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
