'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion, type Variants } from 'motion/react';
import { JusticiaLogo } from '@/components/brand/JusticiaLogo';
import { signOutAction } from '@/app/actions/auth';
import type { LiveResources } from '@/lib/live/fetchLive';
import {
  BellIcon,
  CalendarBookingIcon,
  ChevronRightIcon,
  ClockIcon,
  DocumentTextIcon,
  GearIcon,
  HomeIcon,
  LogoutIcon,
  MessagesIcon,
  ShieldCheckIcon,
  UserCircleIcon,
} from './ClientIcons';

/**
 * Client portal top bar: #341512 with heavier #E5D8CB icons.
 *
 * Each icon has its own hover gesture (home lifts, bell rings, gear turns, avatar swells)
 * over a soft halo.
 *
 * The popovers are parchment neumorphic panels (same #E5D8CB surface as the page they drop
 * onto), outlined by a subtle border instead of a drop shadow. Entrance: the panel unfolds
 * down from a hinge at the top bar (rotateX) and its contents rise in one by one.
 * Exit: it folds back up. Click outside or Esc closes.
 */

type Notification = LiveResources['notifications'][number];
type MenuKey = 'notifications' | 'user' | null;

interface ClientTopbarProps {
  user: { fullName: string; email?: string };
  homeActive: boolean;
  settingsActive: boolean;
  notifications: Notification[];
  onHome: () => void;
  onSettings: () => void;
  onProfile: () => void;
  onNotificationClick: (n: Notification) => void;
  mobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
}

const SEEN_KEY = 'justicia:client:notifications-seen-at';
const ICON = 'h-6 w-6 [stroke-width:2.25]';

// ─── Motion presets ───────────────────────────────────────────────────────────
const HALO: Variants = {
  rest: { opacity: 0, scale: 0.55 },
  active: { opacity: 1, scale: 1 },
  hover: { opacity: 1, scale: 1 },
  tap: { opacity: 1, scale: 0.88 },
};

const spring = { type: 'spring', stiffness: 420, damping: 18 } as const;

const ICON_MOTION: Record<'home' | 'bell' | 'gear' | 'user', Variants> = {
  home: {
    rest: { y: 0, scale: 1, transition: spring },
    active: { y: 0, scale: 1, transition: spring },
    hover: { y: -2, scale: 1.04, transition: spring },
    tap: { y: 0, scale: 0.86 },
  },
  bell: {
    rest: { rotate: 0, scale: 1 },
    active: { rotate: 0, scale: 1 },
    hover: { rotate: [0, 16, -13, 9, -5, 0], scale: 1.04, transition: { duration: 0.65, ease: 'easeInOut' } },
    tap: { rotate: 0, scale: 0.86 },
  },
  gear: {
    rest: { rotate: 0, scale: 1, transition: { type: 'spring', stiffness: 160, damping: 16 } },
    active: { rotate: 0, scale: 1 },
    hover: { rotate: 90, scale: 1.04, transition: { type: 'spring', stiffness: 160, damping: 14 } },
    tap: { rotate: 120, scale: 0.86 },
  },
  user: {
    rest: { scale: 1, transition: spring },
    active: { scale: 1, transition: spring },
    hover: { scale: 1.08, transition: spring },
    tap: { scale: 0.88 },
  },
};

const POPOVER: Variants = {
  hidden: { opacity: 0, rotateX: -24, y: -12, scale: 0.94 },
  show: {
    opacity: 1,
    rotateX: 0,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24,
      mass: 0.9,
      opacity: { duration: 0.18 },
      staggerChildren: 0.05,
      delayChildren: 0.12,
    },
  },
  exit: {
    opacity: 0,
    rotateX: -18,
    y: -8,
    scale: 0.96,
    transition: { duration: 0.2, ease: [0.4, 0, 1, 1], staggerChildren: 0.02, staggerDirection: -1 },
  },
};

const ITEM: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 380, damping: 28 } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.1 } },
};

const LIST: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.04 } },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function readSeenAt(): number {
  try {
    return Number(window.localStorage.getItem(SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const sameDay = new Date().toDateString() === d.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

function notificationIcon(type?: string | null): React.FC<{ className?: string }> {
  const t = type ?? '';
  if (t === 'new_message') return MessagesIcon;
  if (t === 'meeting_starting') return ClockIcon;
  if (t.startsWith('payment')) return DocumentTextIcon;
  if (t.startsWith('consultation') || t.includes('reschedule')) return CalendarBookingIcon;
  if (/report|security|moderation|ban|suspend/.test(t)) return ShieldCheckIcon;
  return BellIcon;
}

// ─── Icon button ──────────────────────────────────────────────────────────────
function NavIconButton({
  id,
  label,
  active,
  motionKey,
  onClick,
  expanded,
  children,
  badge,
}: {
  id: string;
  label: string;
  active: boolean;
  motionKey: keyof typeof ICON_MOTION;
  onClick: () => void;
  expanded?: boolean;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      id={id}
      title={label}
      aria-label={label}
      aria-haspopup={expanded === undefined ? undefined : 'true'}
      aria-expanded={expanded}
      onClick={onClick}
      initial={false}
      animate={active ? 'active' : 'rest'}
      whileHover="hover"
      whileTap="tap"
      data-active={active || undefined}
      className="client-topbar-icon relative grid h-11 w-11 place-items-center rounded-full"
    >
      <motion.span variants={HALO} className="client-topbar-halo absolute inset-0 rounded-full" aria-hidden />
      <motion.span
        variants={ICON_MOTION[motionKey]}
        className="relative grid place-items-center"
        style={motionKey === 'bell' ? { transformOrigin: '50% 8%' } : undefined}
      >
        {children}
      </motion.span>
      {badge}
    </motion.button>
  );
}

// ─── Popover shell ────────────────────────────────────────────────────────────
function Popover({
  label,
  role,
  className = '',
  children,
}: {
  label: string;
  role: 'dialog' | 'menu';
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      role={role}
      aria-label={label}
      variants={POPOVER}
      initial="hidden"
      animate="show"
      exit="exit"
      style={{ transformOrigin: 'calc(100% - var(--caret, 16px) - 6px) 0px', transformPerspective: 900 }}
      className={`client-popover absolute right-0 top-full z-50 mt-3 ${className}`}
    >
      <span className="client-popover-caret" aria-hidden />
      {children}
    </motion.div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export function ClientTopbar({
  user,
  homeActive,
  settingsActive,
  notifications,
  onHome,
  onSettings,
  onProfile,
  onNotificationClick,
  mobileMenuOpen,
  onToggleMobileMenu,
}: ClientTopbarProps) {
  const [openMenu, setOpenMenu] = useState<MenuKey>(null);
  // Notifications load client-side after mount, so reading storage here can't cause a hydration mismatch.
  const [seenAt, setSeenAt] = useState(() => (typeof window === 'undefined' ? 0 : readSeenAt()));
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const clusterRef = useRef<HTMLDivElement>(null);

  const isUnread = useCallback(
    (n: Notification) => !n.is_read && new Date(n.created_at).getTime() > seenAt,
    [seenAt]
  );
  const unreadList = useMemo(() => notifications.filter(isUnread), [notifications, isUnread]);
  const unreadCount = unreadList.length;
  const visible = filter === 'unread' ? unreadList : notifications;

  const markAllRead = () => {
    const now = Date.now();
    setSeenAt(now);
    try {
      window.localStorage.setItem(SEEN_KEY, String(now));
    } catch {
      /* storage unavailable: still cleared for this session */
    }
  };

  const toggle = (key: Exclude<MenuKey, null>) => setOpenMenu((cur) => (cur === key ? null : key));
  const close = useCallback(() => setOpenMenu(null), []);

  // Click outside / Esc closes any open popover.
  useEffect(() => {
    if (!openMenu) return;
    const onPointer = (e: PointerEvent) => {
      if (!clusterRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [openMenu, close]);

  return (
    <MotionConfig reducedMotion="user">
      <header className="client-topbar relative z-40 flex h-16 w-full shrink-0 items-center justify-between px-4 sm:px-8">
        {/* Left: menu + logo */}
        <div className="flex items-center gap-2 sm:gap-3">
          <motion.button
            type="button"
            id="mobile-menu-toggle"
            onClick={onToggleMobileMenu}
            whileTap={{ scale: 0.88 }}
            className="grid h-10 w-10 place-items-center rounded-full text-[#E5D8CB] transition-colors hover:bg-[#E5D8CB]/10 md:hidden"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round">
              <motion.path animate={{ d: mobileMenuOpen ? 'M6 6L18 18' : 'M4 7L20 7' }} />
              <motion.path animate={{ opacity: mobileMenuOpen ? 0 : 1 }} d="M4 12L20 12" />
              <motion.path animate={{ d: mobileMenuOpen ? 'M6 18L18 6' : 'M4 17L20 17' }} />
            </svg>
          </motion.button>

          <motion.button
            type="button"
            id="nav-logo"
            onClick={onHome}
            whileHover={{ opacity: 0.85 }}
            whileTap={{ scale: 0.97 }}
            className="rounded-md text-[#E5D8CB] transition-colors hover:text-[#C58B3C]"
            aria-label="Go to dashboard"
          >
            <JusticiaLogo />
          </motion.button>
        </div>

        {/* Right: icon cluster */}
        <div ref={clusterRef} className="flex items-center gap-0.5 sm:gap-1.5">
          <NavIconButton id="nav-home" label="Dashboard Home" motionKey="home" active={homeActive} onClick={() => { close(); onHome(); }}>
            <HomeIcon className={ICON} />
          </NavIconButton>

          {/* Notifications */}
          <div className="relative">
            <NavIconButton
              id="nav-notifications"
              label={unreadCount ? `Notifications (${unreadCount} unread)` : 'Notifications'}
              motionKey="bell"
              active={openMenu === 'notifications'}
              expanded={openMenu === 'notifications'}
              onClick={() => toggle('notifications')}
              badge={
                <AnimatePresence>
                  {unreadCount > 0 && (
                    <motion.span
                      key="dot"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ type: 'spring', stiffness: 600, damping: 20 }}
                      className="absolute right-[9px] top-[9px] grid h-2.5 w-2.5 place-items-center"
                      aria-hidden
                    >
                      <span className="absolute inset-0 animate-ping rounded-full bg-[#E0A458] opacity-60" />
                      <span className="relative h-2.5 w-2.5 rounded-full bg-[#E0A458] ring-2 ring-[#341512]" />
                    </motion.span>
                  )}
                </AnimatePresence>
              }
            >
              <BellIcon className={ICON} />
            </NavIconButton>

            <AnimatePresence>
              {openMenu === 'notifications' && (
                <Popover label="Notifications" role="dialog" className="w-[min(400px,calc(100vw-2rem))] -mr-[92px] [--caret:108px] sm:mr-0 sm:[--caret:16px]">
                  <motion.div variants={ITEM} className="flex items-center justify-between gap-3 px-7 pb-4 pt-6">
                    <div>
                      <h2 className="font-lora text-[17px] font-semibold leading-tight text-[#341512]">Notifications</h2>
                      <p className="mt-0.5 text-[11.5px] text-[#341512]/55">
                        {unreadCount > 0 ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}` : 'You’re all caught up'}
                      </p>
                    </div>
                    <motion.button
                      type="button"
                      onClick={markAllRead}
                      disabled={unreadCount === 0}
                      whileTap={unreadCount ? { scale: 0.95 } : undefined}
                      className="client-neu-btn shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-semibold"
                    >
                      Mark all read
                    </motion.button>
                  </motion.div>

                  {/* All / Unread: recessed track with a raised thumb that slides */}
                  <motion.div variants={ITEM} className="px-7 pb-3">
                    <div className="client-neu-well flex rounded-full p-1" role="tablist" aria-label="Filter notifications">
                      {(['all', 'unread'] as const).map((key) => (
                        <button
                          key={key}
                          type="button"
                          role="tab"
                          aria-selected={filter === key}
                          onClick={() => setFilter(key)}
                          className={`relative isolate flex-1 rounded-full py-1.5 text-[11.5px] font-semibold transition-colors ${
                            filter === key ? 'text-[#341512]' : 'text-[#341512]/50 hover:text-[#341512]/80'
                          }`}
                        >
                          {filter === key && (
                            <motion.span
                              layoutId="client-notif-filter"
                              transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                              className="client-neu-thumb absolute inset-0 -z-10 rounded-full"
                            />
                          )}
                          {key === 'all' ? 'All' : `Unread${unreadCount ? ` (${unreadCount})` : ''}`}
                        </button>
                      ))}
                    </div>
                  </motion.div>

                  <div className="client-popover-scroll max-h-[min(300px,45vh)] overflow-y-auto px-6 pb-6 pt-3">
                    <motion.div key={filter} variants={LIST} initial="hidden" animate="show" className="flex flex-col gap-4 p-1">
                      {visible.length > 0 ? (
                        visible.map((n) => {
                          const unread = isUnread(n);
                          const Icon = notificationIcon(n.type);
                          return (
                            <motion.button
                              key={n.id}
                              type="button"
                              variants={ITEM}
                              onClick={() => { close(); onNotificationClick(n); }}
                              data-unread={unread || undefined}
                              className="client-notif-card relative flex w-full gap-3.5 rounded-2xl p-4 text-left"
                            >
                              <span className="client-neu-well grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#8C5A1E]">
                                <Icon className="h-[18px] w-[18px] [stroke-width:2.1]" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-start justify-between gap-2">
                                  <span className="font-lora text-[13.5px] font-semibold leading-snug text-[#341512]">{n.title}</span>
                                  <span className="shrink-0 pt-0.5 text-[10.5px] font-medium text-[#341512]/45">{formatWhen(n.created_at)}</span>
                                </span>
                                <span className="mt-1 line-clamp-2 block text-[12px] leading-relaxed text-[#341512]/70">{n.body}</span>
                              </span>
                              {unread && (
                                <span className="client-unread-dot absolute bottom-3.5 right-3.5 h-2 w-2 rounded-full">
                                  <span className="sr-only">Unread</span>
                                </span>
                              )}
                            </motion.button>
                          );
                        })
                      ) : (
                        <motion.div variants={ITEM} className="flex flex-col items-center gap-3 px-6 py-9 text-center">
                          <span className="client-neu-well grid h-16 w-16 place-items-center rounded-full text-[#341512]/45">
                            <span className="client-neu-raised-sm grid h-10 w-10 place-items-center rounded-full bg-[#E5D8CB]">
                              <BellIcon className="h-5 w-5 [stroke-width:2.1]" />
                            </span>
                          </span>
                          <p className="font-lora text-[15px] text-[#341512]">
                            {filter === 'unread' ? 'No unread notifications' : 'Nothing here yet'}
                          </p>
                          <p className="max-w-[240px] text-[11.5px] leading-relaxed text-[#341512]/55">
                            Updates about your consultations, payments and messages will appear here.
                          </p>
                        </motion.div>
                      )}
                    </motion.div>
                  </div>
                </Popover>
              )}
            </AnimatePresence>
          </div>

          <NavIconButton id="nav-settings-header" label="Settings" motionKey="gear" active={settingsActive} onClick={() => { close(); onSettings(); }}>
            <GearIcon className={ICON} />
          </NavIconButton>

          {/* Profile */}
          <div className="relative">
            <NavIconButton
              id="nav-user-menu"
              label="Account menu"
              motionKey="user"
              active={openMenu === 'user'}
              expanded={openMenu === 'user'}
              onClick={() => toggle('user')}
            >
              <UserCircleIcon className="h-[30px] w-[30px] [stroke-width:2]" />
            </NavIconButton>

            <AnimatePresence>
              {openMenu === 'user' && (
                <Popover label="Account" role="menu" className="w-72 p-4">
                  {/* Identity card: recessed well with a gold monogram in an even ring */}
                  <motion.div variants={ITEM} className="client-neu-well flex items-center gap-3 rounded-[18px] p-3">
                    <span className="client-avatar-ring flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
                      <span className="client-avatar flex h-9 w-9 items-center justify-center rounded-full font-lora text-[13px] font-semibold leading-none">
                        {initials(user.fullName)}
                      </span>
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-lora text-[15px] font-semibold leading-tight text-[#341512]">{user.fullName}</p>
                      {user.email && <p className="mt-0.5 truncate text-[11.5px] text-[#341512]/55">{user.email}</p>}
                    </div>
                  </motion.div>

                  <div className="flex flex-col gap-1 pb-2 pt-3">
                    <motion.button variants={ITEM} type="button" role="menuitem" id="dropdown-my-profile" onClick={() => { close(); onProfile(); }} className="client-neu-item">
                      <span className="client-neu-chip"><UserCircleIcon className="h-[17px] w-[17px] [stroke-width:2.1]" /></span>
                      <span className="flex-1">My Profile</span>
                      <ChevronRightIcon className="client-neu-item-chevron h-4 w-4 [stroke-width:2.2]" />
                    </motion.button>
                    <motion.button variants={ITEM} type="button" role="menuitem" id="dropdown-settings" onClick={() => { close(); onSettings(); }} className="client-neu-item">
                      <span className="client-neu-chip"><GearIcon className="h-[17px] w-[17px] [stroke-width:2.1]" /></span>
                      <span className="flex-1">Account Settings</span>
                      <ChevronRightIcon className="client-neu-item-chevron h-4 w-4 [stroke-width:2.2]" />
                    </motion.button>
                  </div>

                  <motion.div variants={ITEM} className="client-neu-groove mx-2" aria-hidden />

                  <motion.form variants={ITEM} action={signOutAction} className="pt-2">
                    <button type="submit" role="menuitem" className="client-neu-item" data-tone="danger">
                      <span className="client-neu-chip"><LogoutIcon className="h-[17px] w-[17px] [stroke-width:2.1]" /></span>
                      <span className="flex-1">Sign Out</span>
                    </button>
                  </motion.form>
                </Popover>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>
    </MotionConfig>
  );
}
