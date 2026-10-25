'use client';

import React, { useState } from 'react';
import { UserCircleIcon, GearIcon } from './ClientIcons';

interface ClientProfileViewProps {
  initialData?: {
    fullName?: string;
    email?: string;
    phone?: string;
    birthdate?: string;
    gender?: string;
    address?: string;
    citizenship?: string;
    idType?: string;
    idNumber?: string;
    emergencyContact?: string;
    emergencyPhone?: string;
  };
}

export function ClientProfileView({ initialData }: ClientProfileViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'personal' | 'identity' | 'activity'>('personal');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [formData, setFormData] = useState({
    fullName: initialData?.fullName || 'Juan Dela Cruz',
    email: initialData?.email || 'juan.delacruz@example.com',
    phone: initialData?.phone || '+63 917 123 4567',
    birthdate: initialData?.birthdate || '1990-05-15',
    gender: initialData?.gender || 'Male',
    address: initialData?.address || 'Unit 402, Legaspi Towers, Paseo de Roxas, Makati City, Metro Manila',
    citizenship: initialData?.citizenship || 'Filipino',
    idType: initialData?.idType || 'Philippine National ID (PhilID)',
    idNumber: initialData?.idNumber || '4821-9034-7182-5501',
    emergencyContact: initialData?.emergencyContact || 'Maria Dela Cruz (Spouse)',
    emergencyPhone: initialData?.emergencyPhone || '+63 918 987 6543',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditing(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3500);
  };

  return (
    <div className="p-4 sm:p-8 lg:p-10 max-w-5xl mx-auto space-y-6">
      {/* ─── Header Banner ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-cormorant text-3xl sm:text-4xl font-bold text-[#34150F]">
            Client <span className="text-[#C58B3C]">Profile</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#7D6855] mt-1">
            Personal identity and legal consultation records registered in the Republic of the Philippines.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {savedSuccess && (
            <span className="text-xs font-semibold text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-3 py-1.5 rounded-xl animate-in fade-in">
              ✓ Changes saved
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="neu-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-[#34150F] hover:text-[#C58B3C] flex items-center gap-2"
          >
            {isEditing ? 'Cancel Editing' : '✎ Edit Profile'}
          </button>
        </div>
      </div>

      {/* ─── Profile Overview Card ─────────────────────────────────────── */}
      <div className="neu-card rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full neu-inset flex items-center justify-center text-[#5C4535] relative shrink-0">
            <UserCircleIcon className="w-14 h-14 sm:w-16 sm:h-16 text-[#C58B3C]" />
            <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-emerald-600 border-2 border-[#ECE1D2] flex items-center justify-center text-[10px] text-white font-bold" title="Verified Client">
              ✓
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-cormorant font-bold text-2xl sm:text-3xl text-[#34150F]">
                {formData.fullName}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-[#DFC5A4] text-[#34150F] text-[10px] font-bold tracking-wider uppercase">
                Verified Client
              </span>
            </div>
            <p className="text-xs text-[#7D6855]">{formData.email}</p>
            <p className="text-xs text-[#5C4535] font-medium">{formData.address.split(',')[0]} • {formData.citizenship}</p>
          </div>
        </div>

        {/* Quick KPI stats */}
        <div className="grid grid-cols-3 gap-3 self-stretch md:self-auto">
          <div className="neu-inset-sm rounded-2xl p-3 text-center">
            <span className="block text-lg font-bold text-[#34150F]">2</span>
            <span className="text-[10px] uppercase font-semibold text-[#7D6855]">Consults</span>
          </div>
          <div className="neu-inset-sm rounded-2xl p-3 text-center">
            <span className="block text-lg font-bold text-[#C58B3C]">1</span>
            <span className="text-[10px] uppercase font-semibold text-[#7D6855]">Active Case</span>
          </div>
          <div className="neu-inset-sm rounded-2xl p-3 text-center">
            <span className="block text-lg font-bold text-[#34150F]">4</span>
            <span className="text-[10px] uppercase font-semibold text-[#7D6855]">Docs</span>
          </div>
        </div>
      </div>

      {/* ─── Navigation Tabs ───────────────────────────────────────────── */}
      <div className="flex border-b border-[#D8C7B4] gap-2 sm:gap-4 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('personal')}
          className={`pb-2 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
            activeTab === 'personal'
              ? 'border-[#C58B3C] text-[#34150F]'
              : 'border-transparent text-[#7D6855] hover:text-[#34150F]'
          }`}
        >
          Personal & Contact Details
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('identity')}
          className={`pb-2 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
            activeTab === 'identity'
              ? 'border-[#C58B3C] text-[#34150F]'
              : 'border-transparent text-[#7D6855] hover:text-[#34150F]'
          }`}
        >
          Government ID & Verification
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
          Legal History & Privacy
        </button>
      </div>

      {/* ─── Tab Content ────────────────────────────────────────────────── */}
      {activeTab === 'personal' && (
        <form onSubmit={handleSave} className="neu-card rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[#D8C7B4]/60">
            <h3 className="font-cormorant font-bold text-xl text-[#34150F]">
              Personal Information
            </h3>
            {isEditing && (
              <span className="text-xs text-[#C58B3C] font-medium">Edit Mode Active</span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-[#7D6855] uppercase tracking-wider mb-1">
                Full Legal Name
              </label>
              {isEditing ? (
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  className="w-full neu-inset px-3.5 py-2.5 rounded-xl text-[#34150F] focus:outline-none"
                  required
                />
              ) : (
                <div className="neu-inset-sm px-3.5 py-2.5 rounded-xl font-medium text-[#34150F]">
                  {formData.fullName}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#7D6855] uppercase tracking-wider mb-1">
                Email Address
              </label>
              <div className="neu-inset-sm px-3.5 py-2.5 rounded-xl font-medium text-[#5C4535] bg-[#E2D4C0]">
                {formData.email} <span className="text-[10px] text-[#7D6855] ml-1">(Primary Login)</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#7D6855] uppercase tracking-wider mb-1">
                Contact Mobile Number
              </label>
              {isEditing ? (
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full neu-inset px-3.5 py-2.5 rounded-xl text-[#34150F] focus:outline-none"
                />
              ) : (
                <div className="neu-inset-sm px-3.5 py-2.5 rounded-xl font-medium text-[#34150F]">
                  {formData.phone}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#7D6855] uppercase tracking-wider mb-1">
                Date of Birth
              </label>
              {isEditing ? (
                <input
                  type="date"
                  name="birthdate"
                  value={formData.birthdate}
                  onChange={handleChange}
                  className="w-full neu-inset px-3.5 py-2.5 rounded-xl text-[#34150F] focus:outline-none"
                />
              ) : (
                <div className="neu-inset-sm px-3.5 py-2.5 rounded-xl font-medium text-[#34150F]">
                  {formData.birthdate}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#7D6855] uppercase tracking-wider mb-1">
                Gender
              </label>
              {isEditing ? (
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full neu-inset px-3.5 py-2.5 rounded-xl text-[#34150F] focus:outline-none"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              ) : (
                <div className="neu-inset-sm px-3.5 py-2.5 rounded-xl font-medium text-[#34150F]">
                  {formData.gender}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#7D6855] uppercase tracking-wider mb-1">
                Citizenship
              </label>
              {isEditing ? (
                <input
                  type="text"
                  name="citizenship"
                  value={formData.citizenship}
                  onChange={handleChange}
                  className="w-full neu-inset px-3.5 py-2.5 rounded-xl text-[#34150F] focus:outline-none"
                />
              ) : (
                <div className="neu-inset-sm px-3.5 py-2.5 rounded-xl font-medium text-[#34150F]">
                  {formData.citizenship}
                </div>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-[#7D6855] uppercase tracking-wider mb-1">
                Residential / Service Address
              </label>
              {isEditing ? (
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  rows={2}
                  className="w-full neu-inset px-3.5 py-2.5 rounded-xl text-[#34150F] focus:outline-none"
                />
              ) : (
                <div className="neu-inset-sm px-3.5 py-2.5 rounded-xl font-medium text-[#34150F]">
                  {formData.address}
                </div>
              )}
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="pt-4 border-t border-[#D8C7B4]/60">
            <h4 className="font-cormorant font-bold text-lg text-[#34150F] mb-3">
              Emergency Contact & Next of Kin
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-[#7D6855] uppercase tracking-wider mb-1">
                  Contact Person & Relationship
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    name="emergencyContact"
                    value={formData.emergencyContact}
                    onChange={handleChange}
                    className="w-full neu-inset px-3.5 py-2.5 rounded-xl text-[#34150F] focus:outline-none"
                  />
                ) : (
                  <div className="neu-inset-sm px-3.5 py-2.5 rounded-xl font-medium text-[#34150F]">
                    {formData.emergencyContact}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#7D6855] uppercase tracking-wider mb-1">
                  Emergency Phone
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    name="emergencyPhone"
                    value={formData.emergencyPhone}
                    onChange={handleChange}
                    className="w-full neu-inset px-3.5 py-2.5 rounded-xl text-[#34150F] focus:outline-none"
                  />
                ) : (
                  <div className="neu-inset-sm px-3.5 py-2.5 rounded-xl font-medium text-[#34150F]">
                    {formData.emergencyPhone}
                  </div>
                )}
              </div>
            </div>
          </div>

          {isEditing && (
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-5 py-2 rounded-xl text-xs font-semibold text-[#5C4535] hover:bg-[#DFC5A4]/40"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="neu-btn-peach px-6 py-2.5 rounded-xl text-xs font-bold text-[#34150F] hover:text-[#C58B3C]"
              >
                Save Details
              </button>
            </div>
          )}
        </form>
      )}

      {activeTab === 'identity' && (
        <div className="neu-card rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[#D8C7B4]/60">
            <div>
              <h3 className="font-cormorant font-bold text-xl text-[#34150F]">
                Philippine Government Identification
              </h3>
              <p className="text-xs text-[#7D6855]">
                Verified under the Philippine Data Privacy Act of 2012 (RA 10173).
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-600/15 text-emerald-800 border border-emerald-400 text-xs font-bold">
              ✓ Identity Verified
            </span>
          </div>

          <div className="neu-plate rounded-2xl p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[10px] font-bold text-[#7D6855] uppercase tracking-wider block">ID Type</span>
                <span className="font-medium text-[#34150F] mt-1 block">{formData.idType}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#7D6855] uppercase tracking-wider block">PhilID / Card Number</span>
                <span className="font-mono font-medium text-[#34150F] mt-1 block">{formData.idNumber}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#7D6855] uppercase tracking-wider block">Verification Date</span>
                <span className="font-medium text-[#34150F] mt-1 block">September 12, 2026</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#7D6855] uppercase tracking-wider block">Issuing Authority</span>
                <span className="font-medium text-[#34150F] mt-1 block">Philippine Statistics Authority (PSA)</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl neu-inset text-xs text-[#5C4535] space-y-2">
            <p className="font-semibold text-[#34150F]">🔒 Attorney-Client Confidentiality Protected</p>
            <p className="leading-relaxed text-[11px] text-[#7D6855]">
              Your verified identity confirms your standing when retaining Philippine legal counsel. Documents transmitted through Justicia remain privileged communications between you and your appointed attorney.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="neu-card rounded-3xl p-6 sm:p-8 space-y-6">
          <h3 className="font-cormorant font-bold text-xl text-[#34150F] pb-3 border-b border-[#D8C7B4]/60">
            Recent Consultations & Retainer Activity
          </h3>

          <div className="space-y-3">
            <div className="neu-plate rounded-2xl p-4 flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-sm text-[#34150F]">Labor Dispute Consultation</h4>
                <p className="text-xs text-[#7D6855]">with Atty. Maria Santos • NLRC Case advisory</p>
                <span className="inline-block mt-1 text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Completed
                </span>
              </div>
              <span className="text-xs text-[#5C4535] font-medium">Oct 14, 2026</span>
            </div>

            <div className="neu-plate rounded-2xl p-4 flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-sm text-[#34150F]">Real Estate Title Conveyance</h4>
                <p className="text-xs text-[#7D6855]">with Atty. Fernando Reyes • Deed of Absolute Sale</p>
                <span className="inline-block mt-1 text-[10px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                  Active Retainer
                </span>
              </div>
              <span className="text-xs text-[#5C4535] font-medium">Oct 22, 2026</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
