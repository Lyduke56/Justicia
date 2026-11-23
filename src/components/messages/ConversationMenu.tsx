'use client';

import React, { useEffect, useRef } from 'react';
import { AnimatePresence, MotionConfig, motion, type Variants } from 'motion/react';
import { ChevronRightIcon } from '@/components/shared/neu';
import { PinIcon } from './MessageIcons';

/** Same feel as the My Documents folder menu: springs out of the trigger, sharpens from a blur, items cascade. */
const MENU: Variants = {
  hidden: { opacity: 0, scale: 0.88, y: -10, filter: 'blur(6px)' },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      type: 'spring',
      stiffness: 480,
      damping: 32,
      mass: 0.7,
      opacity: { duration: 0.18 },
      filter: { duration: 0.22 },
      staggerChildren: 0.04,
      delayChildren: 0.05,
    },
  },
  exit: { opacity: 0, scale: 0.94, y: -6, filter: 'blur(4px)', transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } },
};
/**
 * The header inherits the menu's cascade. The options use whileHover="hover" (so their glyphs
 * react), which stops them inheriting, so each runs its own entrance with a delay by position.
 */
const ITEM: Variants = {
  hidden: { opacity: 0, x: 10 },
  show: (delay?: number) => ({
    opacity: 1,
    x: 0,
    transition:
      delay === undefined
        ? { type: 'spring', stiffness: 520, damping: 34 }
        : { type: 'spring', stiffness: 520, damping: 34, delay },
  }),
};
const GLYPH_NUDGE: Variants = { hover: { x: 1, y: -1, scale: 1.12, transition: { type: 'spring', stiffness: 500, damping: 14 } } };
const GLYPH_TILT: Variants = { hover: { rotate: -18, transition: { type: 'spring', stiffness: 420, damping: 12 } } };
const GLYPH_WAVE: Variants = { hover: { rotate: [0, -14, 10, -5, 0], transition: { duration: 0.5 } } };

const MENU_SHADOW =
  '0 22px 44px -16px rgba(52,21,18,0.38), 0 6px 14px -6px rgba(52,21,18,0.2), -4px -4px 12px rgba(252,238,223,0.7), inset 0 1px 0 rgba(255,255,255,0.55), inset 0 0 0 1px rgba(211,192,170,0.55)';

const UserIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="8" r="3.75" />
    <path d="M4.5 20a7.5 7.5 0 0115 0" />
  </svg>
);
const FlagIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 21V4.5m0 0h11.5l-2 4.25 2 4.25H5" />
  </svg>
);

interface ConversationMenuProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  name: string;
  roleLabel: string;
  avatar: React.ReactNode;
  isLawyer: boolean;
  pinnedCount: number;
  onViewProfile?: () => void;
  onShowPins: () => void;
  onReport: () => void;
}

export function ConversationMenu({
  open,
  setOpen,
  name,
  roleLabel,
  avatar,
  isLawyer,
  pinnedCount,
  onViewProfile,
  onShowPins,
  onReport,
}: ConversationMenuProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Outside click closes; focus moves into the menu when it opens.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    const id = requestAnimationFrame(() =>
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus({ preventScroll: true })
    );
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      cancelAnimationFrame(id);
    };
  }, [open, setOpen]);

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []);
    if (!items.length) return;
    const i = items.indexOf(document.activeElement as HTMLElement);
    const focusAt = (n: number) => items[(n + items.length) % items.length]?.focus();
    if (e.key === 'ArrowDown') { e.preventDefault(); focusAt(i + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusAt(i - 1); }
    else if (e.key === 'Home') { e.preventDefault(); focusAt(0); }
    else if (e.key === 'End') { e.preventDefault(); focusAt(items.length - 1); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); triggerRef.current?.focus(); }
    else if (e.key === 'Tab') setOpen(false);
  };

  const choose = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  const itemBase =
    'group/mi w-full flex items-center gap-3 px-2 py-2 rounded-[14px] text-left transition-colors duration-200 focus:outline-none cursor-pointer';
  const tile = 'size-8 shrink-0 rounded-[10px] flex items-center justify-center transition-colors duration-200';

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        aria-label="Conversation options"
        aria-haspopup="menu"
        aria-expanded={open}
        className={`size-8 rounded-full flex items-center justify-center text-[#341512] cursor-pointer transition-[box-shadow,transform] duration-200 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B9833C]/50 ${
          open ? 'neu-inset-banner' : 'neu-btn-banner'
        }`}
      >
        <svg
          className={`w-4 h-4 transition-transform duration-500 ease-[cubic-bezier(0.34,1.45,0.64,1)] ${open ? 'rotate-90' : ''}`}
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>

      <MotionConfig reducedMotion="user">
        <AnimatePresence>
          {open && (
            <motion.div
              ref={menuRef}
              role="menu"
              aria-label={`Options for your conversation with ${name}`}
              variants={MENU}
              initial="hidden"
              animate="show"
              exit="exit"
              onKeyDown={onMenuKeyDown}
              style={{ transformOrigin: 'calc(100% - 16px) -6px', boxShadow: MENU_SHADOW }}
              className="absolute right-0 top-full mt-3.5 z-40 w-[272px] rounded-[20px] bg-[#ECE2D7] p-1.5"
            >
              {/* Pointer aimed at the trigger */}
              <span
                aria-hidden="true"
                className="absolute -top-[6px] right-[11px] size-[11px] rotate-45 rounded-tl-[2px] bg-[#ECE2D7] shadow-[inset_1px_1px_0_rgba(211,192,170,0.55)]"
              />

              {/* Who this is about */}
              <motion.div variants={ITEM} className="flex items-center gap-3 px-2.5 pt-2.5 pb-3">
                {avatar}
                <div className="min-w-0">
                  <p className="font-lora text-sm font-bold text-[#34150F] leading-tight truncate">{name}</p>
                  <p className="font-lora font-bold text-[9.5px] text-[#A8742E] uppercase tracking-[0.14em] mt-1">{roleLabel}</p>
                </div>
              </motion.div>
              <div className="mx-2.5 mb-1.5 h-px bg-[#D6C3AD]/70" />

              {onViewProfile && (
                <motion.button
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  variants={ITEM}
                  custom={0.1}
                  initial="hidden"
                  animate="show"
                  whileHover="hover"
                  onClick={choose(onViewProfile)}
                  className={`${itemBase} hover:bg-[#DCCBB7]/60 focus-visible:bg-[#DCCBB7]/60`}
                >
                  <span className={`${tile} bg-[#DCCBB7]/55 text-[#7A604D] group-hover/mi:bg-[#C58B3C]/15 group-hover/mi:text-[#A8742E]`}>
                    <motion.span variants={GLYPH_NUDGE} className="flex">
                      <UserIcon />
                    </motion.span>
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-inter text-[13px] font-semibold text-[#34150F]">View profile</span>
                    <span className="block font-inter text-[11px] text-[#8C7A6A] mt-0.5">Credentials, practice areas, reviews</span>
                  </span>
                  <ChevronRightIcon className="w-3.5 h-3.5 text-[#C58B3C] opacity-0 -translate-x-1 transition-[opacity,translate] duration-300 group-hover/mi:opacity-100 group-hover/mi:translate-x-0" />
                </motion.button>
              )}

              <motion.button
                type="button"
                role="menuitem"
                tabIndex={-1}
                variants={ITEM}
                custom={onViewProfile ? 0.14 : 0.1}
                initial="hidden"
                animate="show"
                whileHover="hover"
                disabled={pinnedCount === 0}
                onClick={choose(onShowPins)}
                className={`${itemBase} hover:bg-[#DCCBB7]/60 focus-visible:bg-[#DCCBB7]/60 disabled:opacity-55 disabled:cursor-default disabled:hover:bg-transparent`}
              >
                <span className={`${tile} bg-[#DCCBB7]/55 text-[#7A604D] group-hover/mi:bg-[#C58B3C]/15 group-hover/mi:text-[#A8742E]`}>
                  <motion.span variants={GLYPH_TILT} className="flex">
                    <PinIcon className="w-4 h-4" />
                  </motion.span>
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-inter text-[13px] font-semibold text-[#34150F]">Pinned messages</span>
                  <span className="block font-inter text-[11px] text-[#8C7A6A] mt-0.5">
                    {pinnedCount === 0 ? 'Nothing pinned yet' : `${pinnedCount} pinned in this conversation`}
                  </span>
                </span>
                {pinnedCount > 0 && (
                  <span className="neu-recessed min-w-6 h-6 px-2 rounded-full flex items-center justify-center font-inter text-[10.5px] font-bold text-[#5C4535]">
                    {pinnedCount}
                  </span>
                )}
              </motion.button>

              <div className="mx-2.5 my-1.5 h-px bg-[#D6C3AD]/70" />

              <motion.button
                type="button"
                role="menuitem"
                tabIndex={-1}
                variants={ITEM}
                custom={onViewProfile ? 0.18 : 0.14}
                initial="hidden"
                animate="show"
                whileHover="hover"
                onClick={choose(onReport)}
                className={`${itemBase} hover:bg-[#B42318]/[0.08] focus-visible:bg-[#B42318]/[0.08]`}
              >
                <span className={`${tile} bg-[#B42318]/10 text-[#B42318] group-hover/mi:bg-[#B42318]/15`}>
                  <motion.span variants={GLYPH_WAVE} className="flex origin-bottom-left">
                    <FlagIcon />
                  </motion.span>
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-inter text-[13px] font-semibold text-[#B42318]">
                    Report {isLawyer ? 'client' : 'attorney'}
                  </span>
                  <span className="block font-inter text-[11px] text-[#8C7A6A] mt-0.5">Confidential · reviewed by Justicia</span>
                </span>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </MotionConfig>
    </div>
  );
}
