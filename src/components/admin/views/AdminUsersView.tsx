'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  MOCK_ADMIN_USERS,
  type AdminUserAccount,
} from '@/lib/mock/adminMockData';
import {
  UserGroupIcon,
  ShieldCheckIcon,
  ScaleIcon,
  UserCircleIcon,
  HomeIcon,
} from '@/components/admin/AdminIcons';

function SearchIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function LockClosedIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
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

function XIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function AdminUsersView() {
  const [users, setUsers] = useState<AdminUserAccount[]>(MOCK_ADMIN_USERS);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'client' | 'lawyer' | 'admin'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended' | 'unverified'>('all');
  const [selectedUser, setSelectedUser] = useState<AdminUserAccount | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  // KPI counts
  const kpis = useMemo(() => {
    return {
      total: users.length,
      clients: users.filter((u) => u.role === 'client').length,
      lawyers: users.filter((u) => u.role === 'lawyer').length,
      admins: users.filter((u) => u.role === 'admin').length,
    };
  }, [users]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = u.fullName.toLowerCase().includes(q);
        const matchEmail = u.email.toLowerCase().includes(q);
        const matchLoc = u.location.toLowerCase().includes(q);
        return matchName || matchEmail || matchLoc;
      }
      return true;
    });
  }, [users, roleFilter, statusFilter, searchQuery]);

  // User Actions
  const handleToggleStatus = (userId: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const nextStatus = u.status === 'suspended' ? 'active' : 'suspended';
          showToast(`Account for ${u.fullName} is now ${nextStatus.toUpperCase()}.`);
          return { ...u, status: nextStatus };
        }
        return u;
      })
    );
    if (selectedUser?.id === userId) {
      setSelectedUser((prev) => (prev ? { ...prev, status: prev.status === 'suspended' ? 'active' : 'suspended' } : null));
    }
  };

  const handleRoleChange = (userId: string, newRole: 'client' | 'lawyer' | 'admin') => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          showToast(`Updated ${u.fullName} role to ${newRole.toUpperCase()}.`);
          return { ...u, role: newRole };
        }
        return u;
      })
    );
    if (selectedUser?.id === userId) {
      setSelectedUser((prev) => (prev ? { ...prev, role: newRole } : null));
    }
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
              User Accounts
            </span>
          </div>

          <h1 className="font-cormorant text-4xl sm:text-5xl font-medium text-[#34150F] tracking-tight leading-[1.1] mt-1">
            User Accounts & Access Management
          </h1>
          <p className="text-sm text-[#7D6855] mt-1.5 max-w-2xl">
            Oversee all authenticated identities across the Justicia ecosystem. Manage roles, security enforcement, account standing, and multi-factor authentication.
          </p>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => showToast('Exporting user directory CSV with compliance hash...')}
            className="px-4 py-2.5 rounded-2xl bg-[#EFE5D8] border border-[#D8CAAD] text-xs font-semibold text-[#5C4535] hover:bg-[#E5D7C5] transition shadow-sm"
            style={{ boxShadow: '3px 3px 8px rgba(0,0,0,0.04), -3px -3px 8px rgba(255,255,255,0.8)' }}
          >
            Export Directory
          </button>
        </div>
      </div>

      {/* ─── Toast Feedback ──────────────────────────────────────────────── */}
      {notification && (
        <div className="fixed top-20 right-8 z-50 p-4 rounded-2xl bg-[#23150F] text-[#ded7cb] border border-[#C58B3C]/50 shadow-2xl text-xs flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="w-2 h-2 rounded-full bg-[#C58B3C] animate-ping" />
          <span>{notification}</span>
        </div>
      )}

      {/* ─── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div
          onClick={() => { setRoleFilter('all'); setStatusFilter('all'); }}
          className={`cursor-pointer p-5 rounded-3xl bg-[#EFE5D8] border transition-all ${
            roleFilter === 'all' && statusFilter === 'all' ? 'border-[#C58B3C]' : 'border-[#E8DCCB]'
          }`}
          style={{ boxShadow: '6px 6px 14px rgba(0,0,0,0.05), -6px -6px 14px rgba(255,255,255,0.9)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#7D6855]">Total Accounts</span>
            <UserGroupIcon className="w-5 h-5 text-[#5C4535]" />
          </div>
          <div className="mt-2 font-cormorant text-3xl font-bold text-[#34150F]">{kpis.total}</div>
          <p className="text-[10px] text-[#A69584] mt-0.5">All registered identities</p>
        </div>

        <div
          onClick={() => setRoleFilter('client')}
          className={`cursor-pointer p-5 rounded-3xl bg-[#EFE5D8] border transition-all ${
            roleFilter === 'client' ? 'border-[#C58B3C]' : 'border-[#E8DCCB]'
          }`}
          style={{ boxShadow: '6px 6px 14px rgba(0,0,0,0.05), -6px -6px 14px rgba(255,255,255,0.9)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#7D6855]">Clients</span>
            <UserCircleIcon className="w-5 h-5 text-[#C58B3C]" />
          </div>
          <div className="mt-2 font-cormorant text-3xl font-bold text-[#34150F]">{kpis.clients}</div>
          <p className="text-[10px] text-[#A69584] mt-0.5">Seeking legal assistance</p>
        </div>

        <div
          onClick={() => setRoleFilter('lawyer')}
          className={`cursor-pointer p-5 rounded-3xl bg-[#EFE5D8] border transition-all ${
            roleFilter === 'lawyer' ? 'border-[#C58B3C]' : 'border-[#E8DCCB]'
          }`}
          style={{ boxShadow: '6px 6px 14px rgba(0,0,0,0.05), -6px -6px 14px rgba(255,255,255,0.9)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#7D6855]">Attorneys</span>
            <ScaleIcon className="w-5 h-5 text-[#5C4535]" />
          </div>
          <div className="mt-2 font-cormorant text-3xl font-bold text-[#34150F]">{kpis.lawyers}</div>
          <p className="text-[10px] text-[#A69584] mt-0.5">IBP verified or applicants</p>
        </div>

        <div
          onClick={() => setRoleFilter('admin')}
          className={`cursor-pointer p-5 rounded-3xl bg-[#EFE5D8] border transition-all ${
            roleFilter === 'admin' ? 'border-[#C58B3C]' : 'border-[#E8DCCB]'
          }`}
          style={{ boxShadow: '6px 6px 14px rgba(0,0,0,0.05), -6px -6px 14px rgba(255,255,255,0.9)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#7D6855]">Admins</span>
            <ShieldCheckIcon className="w-5 h-5 text-[#C58B3C]" />
          </div>
          <div className="mt-2 font-cormorant text-3xl font-bold text-[#34150F]">{kpis.admins}</div>
          <p className="text-[10px] text-[#A69584] mt-0.5">Platform governance</p>
        </div>
      </div>

      {/* ─── Search & Filter Toolbar ───────────────────────────────────────── */}
      <div
        className="p-5 rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB] space-y-4"
        style={{ boxShadow: '6px 6px 16px rgba(0,0,0,0.06), -6px -6px 16px rgba(255,255,255,0.9)' }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C7A6B]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search user by name, email, or city..."
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

          {/* Role Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#E5D7C5] border border-[#D8CAAD] text-xs self-start lg:self-auto flex-wrap">
            {(['all', 'client', 'lawyer', 'admin'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 rounded-xl capitalize font-semibold transition ${
                  roleFilter === r
                    ? 'bg-[#EFE5D8] text-[#34150F] shadow-sm'
                    : 'text-[#7D6855] hover:text-[#34150F]'
                }`}
              >
                {r === 'all' ? 'All Roles' : `${r}s`}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#7D6855]">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 rounded-xl bg-[#F5EDE2] border border-[#D8CAAD] text-xs font-medium text-[#34150F] focus:outline-none focus:border-[#C58B3C]"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="unverified">Unverified</option>
            </select>
          </div>
        </div>
      </div>

      {/* ─── Users Table ───────────────────────────────────────────────────── */}
      <div
        className="rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB] overflow-hidden"
        style={{ boxShadow: '6px 6px 16px rgba(0,0,0,0.06), -6px -6px 16px rgba(255,255,255,0.9)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#E5D7C5] text-[#5C4535] uppercase tracking-wider font-semibold border-b border-[#D8CAAD]">
              <tr>
                <th className="py-3.5 px-6">User Account</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Standing</th>
                <th className="py-3.5 px-4">Security (MFA)</th>
                <th className="py-3.5 px-4">Location</th>
                <th className="py-3.5 px-4">Activity</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8DCCB]">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((u) => {
                  const isSuspended = u.status === 'suspended';
                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-[#F5EDE2]/70 transition cursor-pointer"
                      onClick={() => setSelectedUser(u)}
                    >
                      {/* Name & Email */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#D4C1AB] text-[#34150F] font-bold text-xs flex items-center justify-center shrink-0 border border-[#D9C9B6]">
                            {u.fullName.charAt(0)}
                          </div>
                          <div>
                            <span className="font-bold text-[#34150F] block">{u.fullName}</span>
                            <span className="text-[11px] text-[#7D6855]">{u.email}</span>
                          </div>
                        </div>
                      </td>

                      {/* Role Pill */}
                      <td className="py-4 px-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            u.role === 'admin'
                              ? 'bg-[#23150F] text-[#C58B3C] border-[#3E271D]'
                              : u.role === 'lawyer'
                              ? 'bg-[#C58B3C]/15 text-[#8A5A1B] border-[#C58B3C]/30'
                              : 'bg-[#E5D7C5] text-[#5C4535] border-[#D8CAAD]'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>

                      {/* Standing Status */}
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            u.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : u.status === 'suspended'
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'active' ? 'bg-emerald-500' : u.status === 'suspended' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                          <span className="capitalize">{u.status}</span>
                        </span>
                      </td>

                      {/* MFA status */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5">
                          {u.mfaEnabled ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                              <LockClosedIcon className="w-3.5 h-3.5 text-emerald-600" />
                              2FA Active
                            </span>
                          ) : (
                            <span className="text-[11px] text-[#A69584]">Disabled</span>
                          )}
                        </div>
                      </td>

                      {/* Location */}
                      <td className="py-4 px-4 text-[#5C4535] text-xs">
                        {u.location}
                      </td>

                      {/* Last Active */}
                      <td className="py-4 px-4 text-[#7D6855] text-[11px]">
                        <div>{new Date(u.lastActiveAt).toLocaleDateString('en-PH')}</div>
                        <div className="text-[10px] text-[#A69584]">
                          {u.casesCount} cases • {u.consultationsCount} consults
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedUser(u)}
                            className="px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-[#23150F] text-[#ded7cb] hover:bg-[#C58B3C] hover:text-[#23150F] transition"
                          >
                            Inspect
                          </button>
                          <button
                            onClick={() => handleToggleStatus(u.id)}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition ${
                              isSuspended
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                            }`}
                          >
                            {isSuspended ? 'Reinstate' : 'Suspend'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-[#7D6855]">
                    No accounts matching the search filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Slide-over Detail Drawer ──────────────────────────────────────── */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedUser(null)}
          />

          {/* Drawer content */}
          <div className="relative w-full max-w-lg bg-[#EFE5D8] h-full shadow-2xl p-6 sm:p-8 flex flex-col justify-between overflow-y-auto border-l border-[#D8CAAD] z-10 animate-in slide-in-from-right duration-200">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-[#D8CAAD]">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#C58B3C]">
                    Identity Dossier
                  </span>
                  <h2 className="font-cormorant text-2xl font-bold text-[#34150F]">
                    {selectedUser.fullName}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="p-2 rounded-full hover:bg-[#E5D7C5] text-[#5C4535]"
                >
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Status & ID info */}
              <div className="p-4 rounded-2xl bg-[#F5EDE2] border border-[#D8CAAD] space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[#7D6855]">Account Identifier</span>
                  <span className="font-mono font-bold text-[#34150F]">{selectedUser.id}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#7D6855]">Email Address</span>
                  <span className="font-semibold text-[#34150F]">{selectedUser.email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#7D6855]">Phone</span>
                  <span className="text-[#34150F]">{selectedUser.phone || 'Not recorded'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#7D6855]">Registered Location</span>
                  <span className="text-[#34150F]">{selectedUser.location}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#7D6855]">2-Factor Security</span>
                  <span className={selectedUser.mfaEnabled ? 'text-emerald-700 font-bold' : 'text-[#A69584]'}>
                    {selectedUser.mfaEnabled ? 'Enforced (TOTP)' : 'Disabled'}
                  </span>
                </div>
              </div>

              {/* Role Management */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#34150F] uppercase tracking-wider block">
                  Assign Platform Role
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['client', 'lawyer', 'admin'] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => handleRoleChange(selectedUser.id, r)}
                      className={`p-3 rounded-xl text-xs font-semibold capitalize border transition ${
                        selectedUser.role === r
                          ? 'bg-[#23150F] text-[#C58B3C] border-[#3E271D] shadow-inner'
                          : 'bg-[#F5EDE2] text-[#5C4535] border-[#D8CAAD] hover:bg-[#E5D7C5]'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Security Actions */}
              <div className="space-y-3 pt-4 border-t border-[#D8CAAD]">
                <h3 className="text-xs font-bold text-[#34150F] uppercase tracking-wider">
                  Security Actions
                </h3>
                <div className="space-y-2">
                  <button
                    onClick={() => showToast(`Password reset link dispatched to ${selectedUser.email}`)}
                    className="w-full text-left p-3 rounded-xl bg-[#F5EDE2] border border-[#D8CAAD] text-xs font-semibold text-[#34150F] hover:bg-[#E8DCCB] transition flex items-center justify-between"
                  >
                    <span>Send Password Reset Email</span>
                    <span>→</span>
                  </button>
                  <button
                    onClick={() => handleToggleStatus(selectedUser.id)}
                    className={`w-full text-left p-3 rounded-xl border text-xs font-semibold transition flex items-center justify-between ${
                      selectedUser.status === 'suspended'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                        : 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                    }`}
                  >
                    <span>{selectedUser.status === 'suspended' ? 'Reinstate Account Access' : 'Suspend Account Immediately'}</span>
                    <span>{selectedUser.status === 'suspended' ? '✓' : '⚠'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom close */}
            <div className="pt-6 border-t border-[#D8CAAD]">
              <button
                onClick={() => setSelectedUser(null)}
                className="w-full py-3 rounded-xl bg-[#23150F] text-[#ded7cb] text-xs font-semibold hover:bg-[#C58B3C] hover:text-[#23150F] transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
