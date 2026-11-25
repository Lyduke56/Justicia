'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react';
import { refreshAdminTabs } from '@/lib/live/adminRefresh';
import { getAdminUsersData } from '@/app/actions/adminData';
import type { AdminUserAccount } from '@/types/admin';
import { ChevronRightIcon, NeuButton } from '@/components/shared/neu';
import { DRAW, EMBOSS, PAGE } from '@/components/lawyer/motion';
import { stamp } from '@/components/admin/overview/activity';
import { QueueToolbar } from '@/components/admin/verification/QueueToolbar';
import { PAGE_FRAME, ROW_HEIGHT, TableBand, TableEmpty, TablePager, TableRows, pageOf, rowClass, useEntrance } from '@/components/admin/table/kit';
import { ROLE_META, USER_SORTS, USER_TABS, shortId, visibleUsers, type UserSort, type UserTab } from '@/components/admin/users/model';
import { UserAccountModal } from '@/components/admin/users/UserAccountModal';

/**
 * User Accounts, in the same design as the Lawyer Directory: the Consultations-style toolbar
 * (role tabs, search, sort), a carved divider, then a structured table of accounts. A row opens
 * the account in the shared modal (role, password reset, lawyer dossier).
 */

/*
 * Columns, shared by the header band and the rows:
 *   narrow:  Account · Role
 *   40rem:   + Joined
 *   56rem:   + Account ID
 */
const COLS = [
  'grid-cols-[minmax(0,1fr)_auto_14px]',
  '@[40rem]:grid-cols-[minmax(0,1fr)_120px_150px_14px]',
  '@[56rem]:grid-cols-[minmax(0,1fr)_120px_150px_110px_14px]',
].join(' ');
const JOINED = 'hidden @[40rem]:block';
const ACCOUNT_ID = 'hidden @[56rem]:block';

type RoleFilter = UserTab;

export function AdminUsersView({
  initialUsers = [],
  initialRole = 'all',
  initialSelectedId = null,
}: {
  initialUsers?: AdminUserAccount[];
  initialRole?: RoleFilter;
  initialSelectedId?: string | null;
}) {
  const reduceMotion = useReducedMotion();
  const { entranceKey, rowsAt } = useEntrance();

  const [users, setUsers] = useState(initialUsers);
  const [previousData, setPreviousData] = useState(initialUsers);
  if (previousData !== initialUsers) {
    setPreviousData(initialUsers);
    setUsers(initialUsers);
  }

  const [tab, setTab] = useState<UserTab>(initialRole);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<UserSort>('newest');
  const [pageStart, setPageStart] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [now] = useState(() => Date.now());
  const selected = users.find((u) => u.id === selectedId) ?? null;

  const counts = useMemo(
    () => Object.fromEntries(USER_TABS.map((t) => [t.key, t.key === 'all' ? users.length : users.filter((u) => u.role === t.key).length])) as Record<UserTab, number>,
    [users]
  );
  const items = useMemo(() => visibleUsers(users, tab, query, sort), [users, tab, query, sort]);
  const { start, shown } = pageOf(items, pageStart);
  const tabMeta = USER_TABS.find((t) => t.key === tab)!;
  const emptyTitle = query.trim() ? `No accounts match “${query.trim()}”` : tabMeta.empty;
  const changeTab = (next: UserTab) => {
    setTab(next);
    setPageStart(0);
  };

  const refresh = async () => {
    setUsers(await getAdminUsersData());
    refreshAdminTabs();
  };

  return (
    <MotionConfig reducedMotion="user">
      <motion.div key={entranceKey} variants={PAGE} initial={reduceMotion ? false : 'hidden'} animate="show" className={`${PAGE_FRAME} admin-users`}>
        <h1 className="sr-only">User accounts</h1>

        <motion.section variants={EMBOSS} aria-label="Filter accounts" className="rounded-[24px] bg-[#E5D8CB] p-4 sm:p-5">
          <QueueToolbar
            tabs={USER_TABS}
            tab={tab}
            counts={counts}
            onTab={changeTab}
            query={query}
            onQuery={(q) => {
              setQuery(q);
              setPageStart(0);
            }}
            searchLabel="Search name, email or account ID"
            sorts={USER_SORTS}
            sort={sort}
            onSort={(next) => {
              setSort(next);
              setPageStart(0);
            }}
            sortLabel="Sort accounts"
            tabsLabel="Account role"
            idPrefix="users"
          />
        </motion.section>

        <motion.div variants={DRAW} className="lawyer-dash-groove mx-auto my-3 w-[78%] shrink-0" aria-hidden />

        <motion.section variants={EMBOSS} aria-label={tabMeta.heading} className="@container rounded-[24px] bg-[#E5D8CB] p-3 sm:p-4">
          {items.length ? (
            <>
              <TableBand cols={COLS}>
                <span>Account</span>
                <span>Role</span>
                <span className={JOINED}>Joined</span>
                <span className={ACCOUNT_ID}>Account ID</span>
                <span />
              </TableBand>
              <div className="mt-1.5">
                <TableRows
                  key={`${tab}|${sort}|${start}|${entranceKey}`}
                  label="Accounts"
                  items={shown}
                  itemKey={(u) => u.id}
                  rowsAt={rowsAt}
                  render={(user) => {
                    const role = ROLE_META[user.role];
                    const joined = stamp(user.createdAt, now);
                    return (
                      <button
                        type="button"
                        onClick={() => setSelectedId(user.id)}
                        aria-label={`${user.fullName || 'Unnamed account'}, ${role.label}. Manage account`}
                        className={rowClass(COLS)}
                        style={{ height: ROW_HEIGHT }}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-lora text-[14px] font-semibold text-[#341512]">{user.fullName || 'Unnamed account'}</span>
                          <span className="block truncate font-inter text-[11px] text-[#7D6855]">{user.email}</span>
                        </span>
                        <span>
                          <span className={`admin-pill ${role.pill}`}>{role.label}</span>
                        </span>
                        <span className={`${JOINED} font-inter text-[12px] tabular-nums text-[#3E2A1E]`}>{joined.date}</span>
                        <span className={`${ACCOUNT_ID} truncate font-inter text-[11.5px] tabular-nums tracking-[0.04em] text-[#7D6855]`} title={user.id}>
                          #{shortId(user.id)}
                        </span>
                        <ChevronRightIcon className="admin-overview-go h-3.5 w-3.5 text-[#B07A34]" />
                      </button>
                    );
                  }}
                />
              </div>
              <TablePager start={start} shownCount={shown.length} total={items.length} noun="accounts" onPage={setPageStart} />
            </>
          ) : (
            <TableEmpty
              emptyKey={`empty-${tab}-${query}`}
              icon={
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="9" cy="8" r="3.5" />
                  <path d="M3 20a6 6 0 0 1 12 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6 6 0 0 1 3 5.5" />
                </svg>
              }
              title={emptyTitle}
              hint={query.trim() ? 'Check the spelling, or search in All Accounts.' : tabMeta.hint}
              actions={
                <>
                  {query.trim() && (
                    <NeuButton size="sm" onClick={() => setQuery('')}>
                      Clear search
                    </NeuButton>
                  )}
                  {tab !== 'all' && (
                    <NeuButton size="sm" variant="primary" onClick={() => changeTab('all')}>
                      Show all accounts
                    </NeuButton>
                  )}
                </>
              }
            />
          )}
          <p className="sr-only" aria-live="polite">
            {items.length ? `${tabMeta.heading}: ${items.length} accounts, showing ${start + 1} to ${start + shown.length}` : emptyTitle}
          </p>
        </motion.section>
      </motion.div>

      <AnimatePresence>
        {selected && <UserAccountModal key={selected.id} user={selected} onClose={() => setSelectedId(null)} onRoleChanged={refresh} />}
      </AnimatePresence>
    </MotionConfig>
  );
}
