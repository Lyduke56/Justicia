'use client';

import React, { useState } from 'react';
import { UserCircleIcon, ScaleIcon, ShieldCheckIcon } from '@/components/admin/AdminIcons';
import { StarIcon } from '@/components/client/ClientIcons';

interface LawyerProfileViewProps {
  initialData?: {
    fullName?: string;
    rollNumber?: string;
    ibpChapter?: string;
    barPasserYear?: string;
    lawSchool?: string;
    about?: string;
    practiceAreas?: string[];
    languages?: string[];
    feeInitial?: number;
    feeStandard?: number;
    feeExtended?: number;
    phone?: string;
    email?: string;
    officeAddress?: string;
  };
}

const DEFAULT_PRACTICE_AREAS = [
  'Labor & Employment',
  'Civil Litigation',
  'Corporate & Commercial',
  'Family & Custody Law',
  'Real Estate & Property',
];

const ALL_PRACTICE_OPTIONS = [
  'Labor & Employment',
  'Civil Litigation',
  'Corporate & Commercial',
  'Family & Custody Law',
  'Real Estate & Property',
  'Criminal Law',
  'Taxation Law',
  'Intellectual Property',
  'Immigration Law',
  'Maritime Law',
];

export function LawyerProfileView({ initialData }: LawyerProfileViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'credentials' | 'practice' | 'fees' | 'bio' | 'preview'>('credentials');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [form, setForm] = useState({
    fullName: initialData?.fullName || 'Atty. Maria Santos',
    rollNumber: initialData?.rollNumber || '78910',
    ibpChapter: initialData?.ibpChapter || 'Quezon City Chapter',
    barPasserYear: initialData?.barPasserYear || '2016',
    lawSchool: initialData?.lawSchool || 'University of the Philippines College of Law',
    about: initialData?.about || 'Senior practicing attorney with a decade of expertise in Philippine labor relations, civil disputes, and corporate compliance. Dedicated to providing ethical, accessible, and strategic counsel.',
    practiceAreas: initialData?.practiceAreas || DEFAULT_PRACTICE_AREAS,
    languages: initialData?.languages || ['Filipino', 'English', 'Tagalog', 'Cebuano'],
    feeInitial: initialData?.feeInitial || 1500,
    feeStandard: initialData?.feeStandard || 2500,
    feeExtended: initialData?.feeExtended || 4500,
    phone: initialData?.phone || '+63 (2) 8876 5432',
    email: initialData?.email || 'atty.santos@justicia.ph',
    officeAddress: initialData?.officeAddress || 'Suite 1205, Cyberscape Gamma, Topaz Rd, Ortigas Center, Pasig City',
  });

  const togglePracticeArea = (area: string) => {
    if (!isEditing) return;
    setForm((prev) => ({
      ...prev,
      practiceAreas: prev.practiceAreas.includes(area)
        ? prev.practiceAreas.filter((a) => a !== area)
        : [...prev.practiceAreas, area],
    }));
  };

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
            Counsel <span className="text-[#C58B3C]">Profile</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#7D6855] mt-1">
            Manage your Philippine Bar credentials, consultation fees, and public client-facing showcase.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {savedSuccess && (
            <span className="text-xs font-semibold text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-3 py-1.5 rounded-xl animate-in fade-in">
              ✓ Profile updated
            </span>
          )}
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'preview' ? 'credentials' : 'preview')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'preview'
                ? 'neu-btn-peach text-[#34150F]'
                : 'neu-btn text-[#34150F] hover:text-[#C58B3C]'
            }`}
          >
            {activeTab === 'preview' ? '← Exit Public Preview' : '👁 View Public Profile'}
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="neu-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-[#34150F] hover:text-[#C58B3C]"
          >
            {isEditing ? 'Cancel' : '✎ Edit Profile'}
          </button>
        </div>
      </div>

      {/* ─── Counsel Overview Card ─────────────────────────────────────── */}
      <div className="neu-card rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full neu-inset flex items-center justify-center text-[#5C4535] relative shrink-0">
            <UserCircleIcon className="w-14 h-14 sm:w-16 sm:h-16 text-[#C58B3C]" />
            <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-emerald-600 border-2 border-[#ECE1D2] flex items-center justify-center text-[10px] text-white font-bold" title="SC Roll Verified">
              ✓
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-cormorant font-bold text-2xl sm:text-3xl text-[#34150F]">
                {form.fullName}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-700/15 border border-emerald-600/30 text-emerald-900 text-[10px] font-bold tracking-wider uppercase">
                SC Roll #{form.rollNumber} • Verified
              </span>
            </div>
            <p className="text-xs text-[#7D6855]">{form.ibpChapter} • Admitted {form.barPasserYear}</p>
            <div className="flex items-center gap-2 pt-1 text-xs text-[#5C4535]">
              <span className="font-bold text-[#C58B3C]">★ 4.9</span>
              <span>(42 Verified Client Reviews)</span>
              <span>•</span>
              <span className="text-emerald-700 font-semibold">100% Response Rate</span>
            </div>
          </div>
        </div>

        {/* Quick Rate & Retainer Pill */}
        <div className="neu-plate rounded-2xl p-4 text-center space-y-1 min-w-[200px]">
          <span className="text-[10px] uppercase font-bold text-[#7D6855] tracking-wider block">Standard 60-min Rate</span>
          <span className="font-cormorant text-2xl font-bold text-[#34150F] block">
            ₱{form.feeStandard.toLocaleString()}
          </span>
          <span className="text-[10px] text-emerald-800 font-medium block">Accepting New Consultations</span>
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
          Bar Credentials & Alma Mater
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('practice')}
          className={`pb-2 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
            activeTab === 'practice'
              ? 'border-[#C58B3C] text-[#34150F]'
              : 'border-transparent text-[#7D6855] hover:text-[#34150F]'
          }`}
        >
          Practice Areas & Specialization
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('fees')}
          className={`pb-2 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
            activeTab === 'fees'
              ? 'border-[#C58B3C] text-[#34150F]'
              : 'border-transparent text-[#7D6855] hover:text-[#34150F]'
          }`}
        >
          Consultation Fee Tiers
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('bio')}
          className={`pb-2 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
            activeTab === 'bio'
              ? 'border-[#C58B3C] text-[#34150F]'
              : 'border-transparent text-[#7D6855] hover:text-[#34150F]'
          }`}
        >
          Biography & Languages
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={`pb-2 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
            activeTab === 'preview'
              ? 'border-[#C58B3C] text-[#34150F]'
              : 'border-transparent text-[#7D6855] hover:text-[#34150F]'
          }`}
        >
          Public Client View
        </button>
      </div>

      {/* ─── Tab Content ────────────────────────────────────────────────── */}
      {activeTab === 'credentials' && (
        <form onSubmit={handleSave} className="neu-card rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[#D8C7B4]/60">
            <h3 className="font-cormorant font-bold text-xl text-[#34150F]">
              Supreme Court of the Philippines Credentials
            </h3>
            <span className="text-xs text-emerald-800 font-semibold">Verified Active Standing</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-[#7D6855] uppercase tracking-wider mb-1">
                Roll of Attorneys Number
              </label>
              <div className="neu-inset-sm px-3.5 py-2.5 rounded-xl font-mono font-bold text-[#34150F]">
                {form.rollNumber}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#7D6855] uppercase tracking-wider mb-1">
                Integrated Bar of the Philippines (IBP) Chapter
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={form.ibpChapter}
                  onChange={(e) => setForm({ ...form, ibpChapter: e.target.value })}
                  className="w-full neu-inset px-3.5 py-2.5 rounded-xl text-[#34150F] focus:outline-none"
                />
              ) : (
                <div className="neu-inset-sm px-3.5 py-2.5 rounded-xl font-medium text-[#34150F]">
                  {form.ibpChapter}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#7D6855] uppercase tracking-wider mb-1">
                Year Admitted to the Philippine Bar
              </label>
              {isEditing ? (
                <input
                  type="number"
                  value={form.barPasserYear}
                  onChange={(e) => setForm({ ...form, barPasserYear: e.target.value })}
                  className="w-full neu-inset px-3.5 py-2.5 rounded-xl text-[#34150F] focus:outline-none"
                />
              ) : (
                <div className="neu-inset-sm px-3.5 py-2.5 rounded-xl font-medium text-[#34150F]">
                  {form.barPasserYear}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#7D6855] uppercase tracking-wider mb-1">
                Law School (Alma Mater)
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={form.lawSchool}
                  onChange={(e) => setForm({ ...form, lawSchool: e.target.value })}
                  className="w-full neu-inset px-3.5 py-2.5 rounded-xl text-[#34150F] focus:outline-none"
                />
              ) : (
                <div className="neu-inset-sm px-3.5 py-2.5 rounded-xl font-medium text-[#34150F]">
                  {form.lawSchool}
                </div>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-[#7D6855] uppercase tracking-wider mb-1">
                Law Chambers / Office Address
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={form.officeAddress}
                  onChange={(e) => setForm({ ...form, officeAddress: e.target.value })}
                  className="w-full neu-inset px-3.5 py-2.5 rounded-xl text-[#34150F] focus:outline-none"
                />
              ) : (
                <div className="neu-inset-sm px-3.5 py-2.5 rounded-xl font-medium text-[#34150F]">
                  {form.officeAddress}
                </div>
              )}
            </div>
          </div>

          {/* MCLE & Accreditation Box */}
          <div className="p-4 rounded-2xl neu-plate flex items-start gap-3 text-xs text-[#34150F]">
            <ShieldCheckIcon className="w-5 h-5 text-[#C58B3C] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Mandatory Continuing Legal Education (MCLE) Compliant</p>
              <p className="text-[#5C4535] text-[11px] mt-0.5">
                Current Compliance Period: MCLE Compliance Period VII. Certificate of compliance on file with Justicia verification board.
              </p>
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
                Save Changes
              </button>
            </div>
          )}
        </form>
      )}

      {activeTab === 'practice' && (
        <div className="neu-card rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[#D8C7B4]/60">
            <div>
              <h3 className="font-cormorant font-bold text-xl text-[#34150F]">
                Practice Areas & Specialization
              </h3>
              <p className="text-xs text-[#7D6855]">
                Select fields of law in which you offer advisory, document drafting, and court representation.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {ALL_PRACTICE_OPTIONS.map((area) => {
              const active = form.practiceAreas.includes(area);
              return (
                <button
                  key={area}
                  type="button"
                  onClick={() => togglePracticeArea(area)}
                  disabled={!isEditing}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                    active
                      ? 'neu-plate-sm text-[#34150F] border border-[#C58B3C]/50'
                      : 'neu-inset-sm text-[#7D6855] hover:text-[#34150F]'
                  }`}
                >
                  {active ? '✓ ' : '+ '}
                  {area}
                </button>
              );
            })}
          </div>

          {isEditing && (
            <p className="text-xs text-[#C58B3C]">
              Tip: Click on tags above to add or remove them from your active practice profile.
            </p>
          )}
        </div>
      )}

      {activeTab === 'fees' && (
        <form onSubmit={handleSave} className="neu-card rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[#D8C7B4]/60">
            <div>
              <h3 className="font-cormorant font-bold text-xl text-[#34150F]">
                Consultation Fee Schedule
              </h3>
              <p className="text-xs text-[#7D6855]">
                Transparent rates in Philippine Pesos (₱) presented to prospective clients before booking.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* 30-min Tier */}
            <div className="neu-plate rounded-2xl p-5 space-y-3">
              <span className="text-[10px] uppercase font-bold text-[#7D6855] tracking-wider block">Quick Advisory (30 min)</span>
              <p className="text-xs text-[#5C4535]">Brief assessment, clarifying immediate legal rights & questions.</p>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#34150F]">₱</span>
                  <input
                    type="number"
                    step="100"
                    value={form.feeInitial}
                    onChange={(e) => setForm({ ...form, feeInitial: Number(e.target.value) })}
                    className="w-full neu-inset px-3 py-1.5 rounded-lg text-sm font-bold text-[#34150F]"
                  />
                </div>
              ) : (
                <span className="font-cormorant text-2xl font-bold text-[#34150F] block">
                  ₱{form.feeInitial.toLocaleString()}
                </span>
              )}
            </div>

            {/* 60-min Tier */}
            <div className="neu-plate rounded-2xl p-5 space-y-3 border-2 border-[#C58B3C]/50 relative">
              <span className="absolute -top-3 right-4 px-2 py-0.5 rounded-full bg-[#C58B3C] text-white text-[9px] font-bold uppercase tracking-wider">
                Most Popular
              </span>
              <span className="text-[10px] uppercase font-bold text-[#7D6855] tracking-wider block">Standard Session (60 min)</span>
              <p className="text-xs text-[#5C4535]">Comprehensive legal review, strategy plan, contract overview.</p>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#34150F]">₱</span>
                  <input
                    type="number"
                    step="100"
                    value={form.feeStandard}
                    onChange={(e) => setForm({ ...form, feeStandard: Number(e.target.value) })}
                    className="w-full neu-inset px-3 py-1.5 rounded-lg text-sm font-bold text-[#34150F]"
                  />
                </div>
              ) : (
                <span className="font-cormorant text-2xl font-bold text-[#34150F] block">
                  ₱{form.feeStandard.toLocaleString()}
                </span>
              )}
            </div>

            {/* 120-min Tier */}
            <div className="neu-plate rounded-2xl p-5 space-y-3">
              <span className="text-[10px] uppercase font-bold text-[#7D6855] tracking-wider block">Extended Review (120 min)</span>
              <p className="text-xs text-[#5C4535]">Deep-dive contract scrutiny, trial prep, multiple party intake.</p>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#34150F]">₱</span>
                  <input
                    type="number"
                    step="100"
                    value={form.feeExtended}
                    onChange={(e) => setForm({ ...form, feeExtended: Number(e.target.value) })}
                    className="w-full neu-inset px-3 py-1.5 rounded-lg text-sm font-bold text-[#34150F]"
                  />
                </div>
              ) : (
                <span className="font-cormorant text-2xl font-bold text-[#34150F] block">
                  ₱{form.feeExtended.toLocaleString()}
                </span>
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
                Save Fee Structure
              </button>
            </div>
          )}
        </form>
      )}

      {activeTab === 'bio' && (
        <form onSubmit={handleSave} className="neu-card rounded-3xl p-6 sm:p-8 space-y-6">
          <h3 className="font-cormorant font-bold text-xl text-[#34150F] pb-3 border-b border-[#D8C7B4]/60">
            Professional Biography & Spoken Languages
          </h3>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-[#7D6855] uppercase tracking-wider mb-1">
                Professional Overview & Background
              </label>
              {isEditing ? (
                <textarea
                  rows={4}
                  value={form.about}
                  onChange={(e) => setForm({ ...form, about: e.target.value })}
                  className="w-full neu-inset px-3.5 py-2.5 rounded-xl text-[#34150F] focus:outline-none"
                />
              ) : (
                <div className="neu-inset-sm p-4 rounded-xl text-xs leading-relaxed text-[#34150F]">
                  {form.about}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#7D6855] uppercase tracking-wider mb-2">
                Languages Spoken in Consultations
              </label>
              <div className="flex flex-wrap gap-2">
                {form.languages.map((lang) => (
                  <span
                    key={lang}
                    className="neu-plate-sm px-3 py-1 rounded-full text-xs font-medium text-[#34150F]"
                  >
                    🗣 {lang}
                  </span>
                ))}
              </div>
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
                Save Bio
              </button>
            </div>
          )}
        </form>
      )}

      {/* ─── Public Profile Preview ────────────────────────────────────── */}
      {activeTab === 'preview' && (
        <div className="neu-card rounded-3xl p-6 sm:p-10 space-y-6 border-2 border-[#C58B3C]/30">
          <div className="flex items-center justify-between pb-3 border-b border-[#D8C7B4]/60">
            <span className="text-xs uppercase font-bold tracking-wider text-[#C58B3C]">
              ★ Public Client-Facing Profile Preview
            </span>
            <span className="text-xs text-[#7D6855]">
              Previewing as a prospective client
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-full neu-plate flex items-center justify-center text-[#5C4535]">
                <UserCircleIcon className="w-14 h-14 text-[#C58B3C]" />
              </div>
              <div>
                <h3 className="font-cormorant text-3xl font-bold text-[#34150F]">{form.fullName}</h3>
                <p className="text-xs text-[#7D6855]">{form.ibpChapter} • Admitted {form.barPasserYear}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-600/15 text-emerald-800 text-[10px] font-bold">
                    ✓ Verified Attorney
                  </span>
                  <span className="text-xs font-semibold text-[#C58B3C]">★ 4.9 (42 Reviews)</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="neu-btn-peach px-6 py-3 rounded-2xl text-xs sm:text-sm font-bold text-[#34150F] hover:text-[#C58B3C] shadow-lg"
            >
              📅 Book Consultation (₱{form.feeStandard.toLocaleString()})
            </button>
          </div>

          <div className="neu-inset-sm p-4 rounded-2xl text-xs text-[#34150F] leading-relaxed">
            {form.about}
          </div>

          <div className="space-y-2">
            <span className="text-[11px] uppercase font-bold text-[#7D6855] tracking-wider block">
              Core Practice Specializations
            </span>
            <div className="flex flex-wrap gap-2">
              {form.practiceAreas.map((area) => (
                <span
                  key={area}
                  className="neu-plate-sm px-3 py-1 rounded-xl text-xs font-semibold text-[#34150F]"
                >
                  ⚖ {area}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
