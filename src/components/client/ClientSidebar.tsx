'use client';

import React, { useEffect } from 'react';
import { AnimatePresence, MotionConfig, motion, type Variants } from 'motion/react';
import { JusticiaLogo } from '@/components/brand/JusticiaLogo';
import { signOutAction } from '@/app/actions/auth';
import { GearIcon, LogoutIcon } from './ClientIcons';

/**
 * Client portal sidebar (desktop column + mobile drawer).
 *
 * Surface #DBC9BA, ink #341512 @ 80%, Lora. The active tab sits on a raised parchment
 * "pill" that glides between rows (shared layoutId); hover fades in a soft tint and nudges
 * the icon; the newly selected icon gives a small spring "pop".
 */

export interface SidebarItem {
  key: string;
  name: string;
  icon: React.FC<{ className?: string }>;
}

interface ClientSidebarProps {
  items: SidebarItem[];
  activeKey: string | null;
  settingsActive: boolean;
  onSelect: (key: string) => void;
  onSettings: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const PILL_SPRING = { type: 'spring', stiffness: 430, damping: 36, mass: 0.85 } as const;

const LIST: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.05 } },
};

const ROW_IN: Variants = {
  hidden: { opacity: 0, x: -14 },
  show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 380, damping: 30 } },
};

// ─── Row ──────────────────────────────────────────────────────────────────────
function SidebarRow({
  id,
  icon: Icon,
  label,
  active = false,
  onClick,
  pillId,
  tone = 'default',
  type = 'button',
}: {
  id?: string;
  icon: React.FC<{ className?: string }>;
  label: string;
  active?: boolean;
  onClick?: () => void;
  pillId: string;
  tone?: 'default' | 'danger';
  type?: 'button' | 'submit';
}) {
  return (
    <motion.button
      variants={ROW_IN}
      type={type}
      id={id}
      onClick={onClick}
      whileTap={{ scale: 0.975 }}
      aria-current={active ? 'page' : undefined}
      data-active={active || undefined}
      data-tone={tone}
      className="client-side-row group relative flex w-full items-center gap-4 rounded-[14px] px-4 py-3 text-left text-[15px] leading-none"
    >
      {active && (
        <motion.span
          layoutId={pillId}
          transition={PILL_SPRING}
          className="client-side-pill absolute inset-0 rounded-[14px]"
          aria-hidden
        />
      )}
      <span className="client-side-hover absolute inset-0 rounded-[14px]" aria-hidden />

      <motion.span
        className="relative z-10 grid place-items-center"
        animate={active ? { scale: [1, 1.2, 1], rotate: [0, -8, 0] } : { scale: 1, rotate: 0 }}
        transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <span className="client-side-icon grid place-items-center">
          <Icon className="h-[22px] w-[22px]" />
        </span>
      </motion.span>
      <span className="client-side-label relative z-10">{label}</span>
    </motion.button>
  );
}

// ─── Shared body (nav + footer) ───────────────────────────────────────────────
function SidebarBody({
  items,
  activeKey,
  settingsActive,
  onSelect,
  onSettings,
  pillId,
}: Omit<ClientSidebarProps, 'mobileOpen' | 'onCloseMobile'> & { pillId: string }) {
  return (
    <>
      <motion.nav
        variants={LIST}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-2"
        aria-label="Main navigation"
      >
        {items.map((item) => (
          <SidebarRow
            key={item.key}
            id={`sidebar-nav-${item.key}`}
            icon={item.icon}
            label={item.name}
            active={activeKey === item.key}
            onClick={() => onSelect(item.key)}
            pillId={pillId}
          />
        ))}
      </motion.nav>

      <motion.div variants={LIST} initial="hidden" animate="show" className="flex flex-col gap-1.5 pt-8">
        <motion.div
          variants={{ hidden: { scaleX: 0, opacity: 0 }, show: { scaleX: 1, opacity: 1, transition: { duration: 0.5, ease: [0.2, 0.8, 0.2, 1] } } }}
          className="mx-auto mb-5 h-px w-[60%] bg-[#BAAB9E]"
          aria-hidden
        />
        <SidebarRow
          id="sidebar-settings"
          icon={GearIcon}
          label="Settings"
          active={settingsActive}
          onClick={onSettings}
          pillId={pillId}
        />
        <form action={signOutAction}>
          <SidebarRow icon={LogoutIcon} label="Logout" type="submit" tone="danger" pillId={pillId} />
        </form>
      </motion.div>
    </>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export function ClientSidebar(props: ClientSidebarProps) {
  const { mobileOpen, onCloseMobile, onSelect, onSettings, ...rest } = props;

  // Esc closes the mobile drawer.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseMobile();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen, onCloseMobile]);

  return (
    <MotionConfig reducedMotion="user">
      {/* ── Desktop column ── */}
      <aside
        className="client-sidebar hidden w-64 shrink-0 flex-col justify-between overflow-y-auto border-r border-[#341512]/10 px-4 pb-8 pt-10 md:flex"
        aria-label="Client portal navigation"
      >
        <SidebarBody {...rest} onSelect={onSelect} onSettings={onSettings} pillId="client-side-pill" />
      </aside>

      {/* ── Mobile drawer ── */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <motion.div
              className="absolute inset-0 bg-[#1A0907]/55 backdrop-blur-[3px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              onClick={onCloseMobile}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              className="client-sidebar relative z-10 flex h-full w-72 max-w-[82vw] flex-col shadow-[12px_0_40px_-12px_rgba(26,9,7,0.5)]"
              initial={{ x: '-100%' }}
              animate={{ x: 0, transition: { type: 'spring', stiffness: 380, damping: 38 } }}
              exit={{ x: '-100%', transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
            >
              <div className="flex h-16 shrink-0 items-center justify-between bg-[#341512] px-5">
                <JusticiaLogo className="h-8 w-auto text-[#E5D8CB]" />
                <motion.button
                  type="button"
                  onClick={onCloseMobile}
                  whileHover={{ rotate: 90 }}
                  whileTap={{ scale: 0.85 }}
                  className="grid h-9 w-9 place-items-center rounded-full text-[#E5D8CB] hover:bg-[#E5D8CB]/10"
                  aria-label="Close navigation menu"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </motion.button>
              </div>
              <div className="flex flex-1 flex-col justify-between overflow-y-auto px-4 pb-8 pt-8">
                <SidebarBody
                  {...rest}
                  pillId="client-side-pill-mobile"
                  onSelect={(key) => { onSelect(key); onCloseMobile(); }}
                  onSettings={() => { onSettings(); onCloseMobile(); }}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
