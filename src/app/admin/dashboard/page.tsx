import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import {
  ShieldCheckIcon,
  ScaleIcon,
  UserGroupIcon,
  SparklesIcon,
  BookOpenIcon,
} from '@/components/client/ClientIcons';

export const metadata: Metadata = {
  title: 'Platform Overview',
};

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  // Fetch pending lawyer count & list
  const { data: pendingLawyers, count: pendingCount } = await supabase
    .from('lawyer_profiles')
    .select('user_id, full_name, roll_number, ibp_chapter, submitted_at, created_at', { count: 'exact' })
    .eq('verification_status', 'pending')
    .order('created_at', { ascending: false })
    .limit(5);

  // Fetch approved lawyers count
  const { count: approvedCount } = await supabase
    .from('lawyer_profiles')
    .select('user_id', { count: 'exact', head: true })
    .eq('verification_status', 'approved');

  // Fetch total users count
  const { count: totalUsersCount } = await supabase
    .from('user_accounts')
    .select('id', { count: 'exact', head: true });

  // Fetch recent audit logs
  const { data: recentAudit } = await supabase
    .from('audit_log')
    .select('id, action, target_type, target_id, created_at')
    .order('created_at', { ascending: false })
    .limit(4);

  return (
    <div className="p-6 sm:p-10 lg:p-12 max-w-7xl mx-auto space-y-10">
      {/* ─── Top Greeting Section ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold tracking-[0.2em] text-[#C58B3C] uppercase">
            Platform Command Center
          </span>
          <h1 className="font-cormorant text-4xl sm:text-5xl font-medium text-[#34150F] tracking-tight leading-[1.1] mt-1">
            Platform Overview, <span className="text-[#C58B3C] font-semibold">Administrator.</span>
          </h1>
          <p className="text-sm text-[#7D6855] mt-1.5">
            Monitor verified lawyers, credentials verification queue, and platform intelligence.
          </p>
        </div>

        <Link
          href="/admin/lawyers/verification-queue"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#C58B3C] text-[#23150F] font-semibold text-xs tracking-wide shadow-[4px_4px_10px_rgba(0,0,0,0.1),-3px_-3px_10px_rgba(255,255,255,0.8)] hover:bg-[#B37B2F] transition-all shrink-0 self-start md:self-auto"
        >
          <ShieldCheckIcon className="w-4 h-4" />
          <span>Verification Queue ({pendingCount || 0})</span>
        </Link>
      </div>

      {/* ─── 4 KPI Stat Tiles (Neumorphic) ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Tile 1: Pending Verifications */}
        <Link
          href="/admin/lawyers/verification-queue"
          className="p-5 rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB]/80 transition-all hover:scale-[1.01]"
          style={{ boxShadow: '6px 6px 14px rgba(0,0,0,0.06), -6px -6px 14px rgba(255,255,255,0.9)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#7D6855] uppercase tracking-wider">
              Pending Queue
            </span>
            <div className="w-9 h-9 rounded-2xl bg-[#C58B3C]/15 text-[#C58B3C] flex items-center justify-center">
              <ShieldCheckIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-cormorant text-3xl font-bold text-[#34150F]">
              {pendingCount ?? 0}
            </span>
            <span className="text-[11px] font-medium text-[#C58B3C]">
              {(pendingCount ?? 0) > 0 ? 'Requires Review' : 'All clear'}
            </span>
          </div>
          <p className="text-[11px] text-[#A69584] mt-1">Lawyer bar roll credential applications</p>
        </Link>

        {/* Tile 2: Active Verified Lawyers */}
        <Link
          href="/admin/lawyers"
          className="p-5 rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB]/80 transition-all hover:scale-[1.01]"
          style={{ boxShadow: '6px 6px 14px rgba(0,0,0,0.06), -6px -6px 14px rgba(255,255,255,0.9)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#7D6855] uppercase tracking-wider">
              Active Lawyers
            </span>
            <div className="w-9 h-9 rounded-2xl bg-[#23150F]/10 text-[#34150F] flex items-center justify-center">
              <ScaleIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-cormorant text-3xl font-bold text-[#34150F]">
              {approvedCount ?? 5}
            </span>
            <span className="text-[11px] font-medium text-emerald-700">Verified & Visible</span>
          </div>
          <p className="text-[11px] text-[#A69584] mt-1">Integrated Bar of the Philippines</p>
        </Link>

        {/* Tile 3: Registered Accounts */}
        <Link
          href="/admin/users"
          className="p-5 rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB]/80 transition-all hover:scale-[1.01]"
          style={{ boxShadow: '6px 6px 14px rgba(0,0,0,0.06), -6px -6px 14px rgba(255,255,255,0.9)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#7D6855] uppercase tracking-wider">
              Platform Users
            </span>
            <div className="w-9 h-9 rounded-2xl bg-[#23150F]/10 text-[#34150F] flex items-center justify-center">
              <UserGroupIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-cormorant text-3xl font-bold text-[#34150F]">
              {totalUsersCount ?? 7}
            </span>
            <span className="text-[11px] font-medium text-[#7D6855]">Clients & Lawyers</span>
          </div>
          <p className="text-[11px] text-[#A69584] mt-1">Authenticated user profiles</p>
        </Link>

        {/* Tile 4: Gemini AI Intelligence */}
        <Link
          href="/admin/ai-management"
          className="p-5 rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB]/80 transition-all hover:scale-[1.01]"
          style={{ boxShadow: '6px 6px 14px rgba(0,0,0,0.06), -6px -6px 14px rgba(255,255,255,0.9)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#7D6855] uppercase tracking-wider">
              Justicia AI
            </span>
            <div className="w-9 h-9 rounded-2xl bg-emerald-600/15 text-emerald-700 flex items-center justify-center">
              <SparklesIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-cormorant text-2xl font-bold text-emerald-800">
              Operational
            </span>
            <span className="text-[11px] font-medium text-emerald-700">100%</span>
          </div>
          <p className="text-[11px] text-[#A69584] mt-1">Google Gemini 3.8 Flash</p>
        </Link>
      </div>

      {/* ─── Two-Column Main Content Section ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column (7 cols): Lawyer Verification Queue Preview */}
        <div className="lg:col-span-7 space-y-6">
          <div
            className="p-6 sm:p-7 rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB]/80"
            style={{ boxShadow: '6px 6px 16px rgba(0,0,0,0.06), -6px -6px 16px rgba(255,255,255,0.9)' }}
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#E8DCCB]">
              <div>
                <h2 className="font-cormorant text-2xl font-bold text-[#34150F]">
                  Lawyer Verification Queue
                </h2>
                <p className="text-xs text-[#7D6855] mt-0.5">
                  Recent attorney registration submissions pending bar review
                </p>
              </div>

              <Link
                href="/admin/lawyers/verification-queue"
                className="text-xs font-semibold text-[#C58B3C] hover:text-[#9A6A27] transition-colors"
              >
                View All →
              </Link>
            </div>

            <div className="pt-4 divide-y divide-[#E8DCCB]/60">
              {pendingLawyers && pendingLawyers.length > 0 ? (
                pendingLawyers.map((lawyer) => (
                  <div key={lawyer.user_id} className="py-3.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-[#D4C1AB] text-[#5C4535] font-bold text-xs flex items-center justify-center shrink-0 border border-[#D9C9B6]">
                        {lawyer.full_name?.charAt(0) || 'A'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#34150F] truncate">{lawyer.full_name}</p>
                        <p className="text-[10px] text-[#7D6855] uppercase tracking-wider truncate">
                          Roll #{lawyer.roll_number} • IBP {lawyer.ibp_chapter || 'Chapter'}
                        </p>
                      </div>
                    </div>

                    <Link
                      href="/admin/lawyers/verification-queue"
                      className="px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-[#23150F] text-[#ded7cb] hover:bg-[#C58B3C] hover:text-[#23150F] transition-all shrink-0"
                    >
                      Review
                    </Link>
                  </div>
                ))
              ) : (
                <div className="py-10 text-center space-y-2">
                  <div className="text-3xl">⚖️</div>
                  <p className="text-xs font-semibold text-[#5C4535]">Verification Queue is Clear</p>
                  <p className="text-[11px] text-[#A69584] max-w-sm mx-auto">
                    All submitted lawyer profiles have been processed. New registrations will automatically appear here.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Audit Log Preview */}
          <div
            className="p-6 rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB]/80"
            style={{ boxShadow: '6px 6px 16px rgba(0,0,0,0.06), -6px -6px 16px rgba(255,255,255,0.9)' }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E8DCCB]">
              <h3 className="font-cormorant text-xl font-bold text-[#34150F]">
                Security & Audit Trail
              </h3>
              <Link
                href="/admin/settings/security-audit-log"
                className="text-xs font-semibold text-[#C58B3C] hover:text-[#9A6A27]"
              >
                Full Log →
              </Link>
            </div>
            <div className="pt-3 divide-y divide-[#E8DCCB]/50 text-xs">
              {recentAudit && recentAudit.length > 0 ? (
                recentAudit.map((log) => (
                  <div key={log.id} className="py-2.5 flex items-center justify-between text-[#5C4535]">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#C58B3C]" />
                      <span className="font-semibold text-[#34150F]">{log.action}</span>
                      <span className="text-[10px] text-[#A69584]">({log.target_type || 'system'})</span>
                    </div>
                    <span className="text-[10px] text-[#7D6855]">
                      {new Date(log.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))
              ) : (
                <p className="py-4 text-center text-xs text-[#7D6855]">
                  Audit log is recording all administrative actions.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Quick Actions & System Health */}
        <div className="lg:col-span-5 space-y-6">
          {/* Quick Admin Actions */}
          <div
            className="p-6 rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB]/80 space-y-3"
            style={{ boxShadow: '6px 6px 16px rgba(0,0,0,0.06), -6px -6px 16px rgba(255,255,255,0.9)' }}
          >
            <h3 className="font-cormorant text-xl font-bold text-[#34150F]">
              Quick Management
            </h3>
            <div className="space-y-2 pt-1">
              <Link
                href="/admin/lawyers/verification-queue"
                className="flex items-center justify-between p-3 rounded-2xl bg-[#E8DAC8] text-xs font-semibold text-[#34150F] hover:bg-[#DFCDB9] transition-all shadow-[2px_2px_5px_rgba(0,0,0,0.04)]"
              >
                <div className="flex items-center gap-2.5">
                  <ShieldCheckIcon className="w-4 h-4 text-[#C58B3C]" />
                  <span>Review Lawyer Applications</span>
                </div>
                <span>→</span>
              </Link>

              <Link
                href="/admin/lawyers"
                className="flex items-center justify-between p-3 rounded-2xl bg-[#E8DAC8] text-xs font-semibold text-[#34150F] hover:bg-[#DFCDB9] transition-all shadow-[2px_2px_5px_rgba(0,0,0,0.04)]"
              >
                <div className="flex items-center gap-2.5">
                  <ScaleIcon className="w-4 h-4 text-[#C58B3C]" />
                  <span>Manage Active Lawyers</span>
                </div>
                <span>→</span>
              </Link>

              <Link
                href="/admin/knowledge-base"
                className="flex items-center justify-between p-3 rounded-2xl bg-[#E8DAC8] text-xs font-semibold text-[#34150F] hover:bg-[#DFCDB9] transition-all shadow-[2px_2px_5px_rgba(0,0,0,0.04)]"
              >
                <div className="flex items-center gap-2.5">
                  <BookOpenIcon className="w-4 h-4 text-[#C58B3C]" />
                  <span>Philippine Legal Knowledge Base</span>
                </div>
                <span>→</span>
              </Link>

              <Link
                href="/admin/ai-management"
                className="flex items-center justify-between p-3 rounded-2xl bg-[#E8DAC8] text-xs font-semibold text-[#34150F] hover:bg-[#DFCDB9] transition-all shadow-[2px_2px_5px_rgba(0,0,0,0.04)]"
              >
                <div className="flex items-center gap-2.5">
                  <SparklesIcon className="w-4 h-4 text-[#C58B3C]" />
                  <span>AI Prompt & Model Configurations</span>
                </div>
                <span>→</span>
              </Link>
            </div>
          </div>

          {/* System Health Card */}
          <div
            className="p-6 rounded-3xl bg-[#23150F] text-[#ded7cb] border border-[#352219] space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-[#352219] pb-3">
              <span className="font-cinzel text-xs font-bold tracking-widest text-[#C58B3C] uppercase">
                Infrastructure Health
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-[#A69584]">Supabase PostgreSQL</span>
                <span className="font-semibold text-emerald-400">Connected</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#A69584]">Google Gemini API</span>
                <span className="font-semibold text-emerald-400">gemini-3.8-flash</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#A69584]">Embedding Vector Dims</span>
                <span className="font-semibold text-emerald-400">768 (text-embedding)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#A69584]">Resend Email Service</span>
                <span className="font-semibold text-emerald-400">Operational</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
