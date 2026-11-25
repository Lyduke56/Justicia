'use client';

/**
 * Shared modal frame for the consultation booking flow. Every dialog gets the same overlay,
 * inset parchment panel with the caramel rim (.neu-modal), header (raised icon tile, Lora title,
 * Inter subtitle, raised close button), scrolling body and footer, so spacing stays consistent.
 *
 * Motion: the overlay fades and blurs in, the panel springs up, the icon tile pops, and body
 * sections cascade in. Exit animations play when the caller renders the modal inside
 * <AnimatePresence> (e.g. `<AnimatePresence>{open && <NeuModal …/>}</AnimatePresence>`).
 * Honours the OS "reduce motion" setting.
 */
import React, { Children, useEffect, useId, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { motion, MotionConfig, type Variants } from 'motion/react';
import { CloseIcon } from './NeuIcons';

export type NeuModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export type NeuTone = 'caramel' | 'danger' | 'success' | 'neutral';

export const NEU_MODAL_SIZES: Record<NeuModalSize, string> = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-2xl lg:max-w-3xl',
  '2xl': 'sm:max-w-2xl lg:max-w-4xl',
};

const ICON_TONES: Record<NeuTone, string> = {
  caramel: 'text-[#C58B3C]',
  danger: 'text-[#B42318]',
  success: 'text-[#1F7A3A]',
  neutral: 'text-[#5C4535]',
};

const noopSubscribe = () => () => {};

/** Children as a flat list, unwrapping fragments (`<>…</>`) so each item can animate on its own. */
function flatten(node: React.ReactNode): React.ReactNode[] {
  return Children.toArray(node).flatMap((child) =>
    React.isValidElement<{ children?: React.ReactNode }>(child) && child.type === React.Fragment
      ? flatten(child.props.children)
      : [child]
  );
}

const EASE_OUT = [0.2, 0.8, 0.2, 1] as const;

/** Backdrop: a warm vignette that fades and blurs the page behind. */
export const overlayVariants: Variants = {
  hidden: { opacity: 0, backdropFilter: 'blur(0px)' },
  show: { opacity: 1, backdropFilter: 'blur(7px)', transition: { duration: 0.28, ease: 'easeOut' } },
  exit: { opacity: 0, backdropFilter: 'blur(0px)', transition: { duration: 0.22, ease: 'easeIn', delay: 0.08 } },
};

/**
 * Panel: tips up from below like a card being lifted toward you (3D tilt on the X axis),
 * coming into focus out of a soft blur; on exit it tips away and blurs out.
 */
export const panelVariants: Variants = {
  hidden: { opacity: 0, y: 56, scale: 0.9, rotateX: 16, filter: 'blur(8px)' },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    rotateX: 0,
    filter: 'blur(0px)',
    transition: {
      type: 'spring',
      stiffness: 240,
      damping: 24,
      mass: 0.9,
      opacity: { duration: 0.25 },
      filter: { duration: 0.35, ease: 'easeOut' },
      when: 'beforeChildren',
      staggerChildren: 0.06,
    },
  },
  exit: {
    opacity: 0,
    y: 36,
    scale: 0.94,
    rotateX: -10,
    filter: 'blur(6px)',
    transition: { duration: 0.24, ease: [0.4, 0, 1, 1] },
  },
};

/** Sections sharpen into place one after another. */
export const sectionVariants: Variants = {
  hidden: { opacity: 0, y: 14, filter: 'blur(4px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.38, ease: EASE_OUT } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

const bodyVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.065, delayChildren: 0.05 } },
  exit: {},
};

/** Footer buttons slide in from the right, primary last. */
const footerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};
const footerItemVariants: Variants = {
  hidden: { opacity: 0, x: 18 },
  show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 420, damping: 26 } },
};

export interface NeuModalProps {
  onClose: () => void;
  /** false blocks Esc, backdrop clicks and the close button (e.g. while submitting). */
  dismissible?: boolean;
  size?: NeuModalSize;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  iconTone?: NeuTone;
  /** Hide the header close button (the footer already has a way out). */
  hideClose?: boolean;
  /** aria-labelledby target when there is no title (content renders its own heading). */
  labelledBy?: string;
  /** Footer buttons, right-aligned; stacked full-width on phones. */
  footer?: React.ReactNode;
  /** Optional footer text on the left (e.g. "2 files selected"). */
  footerStart?: React.ReactNode;
  /** Classes for the body wrapper; defaults to vertical rhythm of 1.5rem. */
  bodyClassName?: string;
  children: React.ReactNode;
}

export function NeuModal({
  onClose,
  dismissible = true,
  size = 'md',
  title,
  subtitle,
  icon,
  iconTone = 'caramel',
  hideClose = false,
  labelledBy,
  footer,
  footerStart,
  bodyClassName = 'space-y-6',
  children,
}: NeuModalProps) {
  const titleId = useId();
  // true on the client, false during SSR, so the portal only renders in the browser.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  useEffect(() => {
    if (!dismissible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dismissible, onClose]);

  if (!mounted) return null;

  return createPortal(
    <MotionConfig reducedMotion="user">
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4 sm:p-6 bg-[radial-gradient(ellipse_at_center,rgba(26,15,10,0.5)_0%,rgba(26,15,10,0.78)_100%)]"
        style={{ perspective: 1400 }}
        variants={overlayVariants}
        initial="hidden"
        animate="show"
        exit="exit"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && dismissible) onClose();
        }}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : labelledBy}
          variants={panelVariants}
          // .neu-modal sets its own 20px radius; the inline radius wins over it.
          style={{ borderRadius: 30, transformOrigin: '50% 100%' }}
          className={`neu-modal relative my-auto flex w-full max-h-[90vh] flex-col overflow-hidden ${NEU_MODAL_SIZES[size]}`}
        >
          {title && (
            <NeuModalHeader
              titleId={titleId}
              title={title}
              subtitle={subtitle}
              icon={icon}
              iconTone={iconTone}
              hideClose={hideClose}
              closeDisabled={!dismissible}
              onClose={onClose}
            />
          )}
          <NeuModalBody hasHeader={!!title} className={bodyClassName}>
            {children}
          </NeuModalBody>
          {footer && <NeuModalFooter footer={footer} footerStart={footerStart} />}
        </motion.div>
      </motion.div>
    </MotionConfig>,
    document.body
  );
}

// ─── Sheet pieces ────────────────────────────────────────────────────────────
// Header, body and footer of every Neu dialog. They animate through the variants of the panel
// they sit in ("hidden" to "show"), so NeuModal and NeuModalSheet share one layout and motion.

export interface NeuModalHeaderProps {
  titleId: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  iconTone?: NeuTone;
  hideClose?: boolean;
  closeDisabled?: boolean;
  onClose: () => void;
}

export function NeuModalHeader({
  titleId,
  title,
  subtitle,
  icon,
  iconTone = 'caramel',
  hideClose = false,
  closeDisabled = false,
  onClose,
}: NeuModalHeaderProps) {
  return (
    <motion.header variants={sectionVariants} className="shrink-0 flex items-start gap-4 px-7 sm:px-9 pt-7 sm:pt-8 pb-1">
      {icon && (
        <motion.div
          initial={{ scale: 0.3, rotate: -20, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 460, damping: 15, delay: 0.12 }}
          className={`relative neu-raised-sm size-11 sm:size-12 shrink-0 rounded-2xl flex items-center justify-center ${ICON_TONES[iconTone]}`}
        >
          {/* One soft ring ripples out from the tile as the dialog lands. */}
          <motion.span
            aria-hidden="true"
            initial={{ scale: 1, opacity: 0.55 }}
            animate={{ scale: 1.9, opacity: 0 }}
            transition={{ duration: 1.1, delay: 0.35, ease: 'easeOut' }}
            className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-current"
          />
          <motion.span
            className="flex"
            animate={iconTone === 'danger' ? { rotate: [0, -14, 12, -8, 6, 0] } : undefined}
            transition={{ duration: 0.6, delay: 0.45, ease: 'easeInOut' }}
          >
            {icon}
          </motion.span>
        </motion.div>
      )}
      <div className="min-w-0 flex-1 pt-0.5">
        <h2 id={titleId} className="font-lora text-lg sm:text-xl font-bold text-[#341512] leading-tight">
          {title}
        </h2>
        {subtitle && <p className="mt-1.5 font-inter text-xs sm:text-[13px] text-[#5C4535] leading-relaxed">{subtitle}</p>}
      </div>
      {!hideClose && (
        <motion.button
          type="button"
          aria-label="Close"
          onClick={onClose}
          disabled={closeDisabled}
          whileHover={{ rotate: 90 }}
          whileTap={{ scale: 0.88 }}
          transition={{ type: 'spring', stiffness: 420, damping: 18 }}
          className="neu-raised-sm size-9 shrink-0 rounded-full flex items-center justify-center text-[#5C4535] hover:text-[#A8742E] transition-colors disabled:opacity-40 cursor-pointer"
        >
          <CloseIcon className="w-3.5 h-3.5" />
        </motion.button>
      )}
    </motion.header>
  );
}

/** Scrolling body; each top-level child animates in turn (fragments are unwrapped). */
export function NeuModalBody({
  hasHeader = true,
  className = 'space-y-6',
  children,
}: {
  hasHeader?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  // Falsy children are dropped by toArray.
  const sections = flatten(children);
  return (
    <motion.div
      variants={bodyVariants}
      className={`min-h-0 flex-1 overflow-y-auto neu-scrollbar-discrete px-7 sm:px-9 ${hasHeader ? 'pt-6 pb-8' : 'py-8 sm:py-9'} ${className}`}
    >
      {sections.map((child, i) => (
        <motion.div key={(React.isValidElement(child) && child.key) || i} variants={sectionVariants}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

/** Footer buttons, right-aligned; stacked full-width on phones (primary on top). */
export function NeuModalFooter({ footer, footerStart }: { footer: React.ReactNode; footerStart?: React.ReactNode }) {
  return (
    <motion.footer
      variants={sectionVariants}
      className="shrink-0 flex flex-col-reverse sm:flex-row sm:items-center gap-3 px-7 sm:px-9 py-5 sm:py-6 border-t border-[#CDBCA8]/60"
    >
      {footerStart && <div className="sm:mr-auto font-inter text-xs text-[#5C4535] text-center sm:text-left">{footerStart}</div>}
      <motion.div
        variants={footerVariants}
        className="flex flex-col-reverse sm:flex-row gap-3 sm:ml-auto [&>*]:w-full sm:[&>*]:w-auto [&>*>button]:w-full sm:[&>*>button]:w-auto"
      >
        {flatten(footer).map((btn, i) => (
          <motion.div key={(React.isValidElement(btn) && btn.key) || i} variants={footerItemVariants}>
            {btn}
          </motion.div>
        ))}
      </motion.div>
    </motion.footer>
  );
}

const sheetVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

export interface NeuModalSheetProps extends Omit<NeuModalProps, 'size' | 'dismissible' | 'labelledBy'> {
  /** id for the title, so the surrounding dialog can point aria-labelledby at it. */
  titleId: string;
  /** Disables the close button (e.g. while submitting). */
  closeDisabled?: boolean;
}

/**
 * The inside of a NeuModal (header, body, footer) as a standalone block that plays its own
 * entrance. Used by dialogs that swap their content in place, such as SubmissionModal.
 */
export function NeuModalSheet({
  titleId,
  title,
  subtitle,
  icon,
  iconTone,
  hideClose,
  closeDisabled,
  onClose,
  footer,
  footerStart,
  bodyClassName = 'space-y-6',
  children,
}: NeuModalSheetProps) {
  return (
    <motion.div className="flex min-h-0 flex-1 flex-col" variants={sheetVariants} initial="hidden" animate="show">
      {title && (
        <NeuModalHeader
          titleId={titleId}
          title={title}
          subtitle={subtitle}
          icon={icon}
          iconTone={iconTone}
          hideClose={hideClose}
          closeDisabled={closeDisabled}
          onClose={onClose}
        />
      )}
      <NeuModalBody hasHeader={!!title} className={bodyClassName}>
        {children}
      </NeuModalBody>
      {footer && <NeuModalFooter footer={footer} footerStart={footerStart} />}
    </motion.div>
  );
}

export default NeuModal;
