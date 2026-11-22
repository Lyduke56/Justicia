'use client';

import React from 'react';
import { motion } from 'motion/react';
import { AlertIcon, CheckCircleIcon, CloseIcon, InfoIcon } from './NeuIcons';

export type NeuAlertTone = 'error' | 'warning' | 'success' | 'info';

const TONES: Record<NeuAlertTone, { icon: React.ReactNode; iconColor: string; titleColor: string }> = {
  error: { icon: <AlertIcon className="w-4 h-4" />, iconColor: 'text-[#B42318]', titleColor: 'text-[#7A1A12]' },
  warning: { icon: <AlertIcon className="w-4 h-4" />, iconColor: 'text-[#B7791F]', titleColor: 'text-[#6B4513]' },
  success: { icon: <CheckCircleIcon className="w-4 h-4" />, iconColor: 'text-[#1F7A3A]', titleColor: 'text-[#174D2A]' },
  info: { icon: <InfoIcon className="w-4 h-4" />, iconColor: 'text-[#C58B3C]', titleColor: 'text-[#341512]' },
};

export interface NeuAlertProps {
  tone?: NeuAlertTone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  /** A small inline action (e.g. "Review Request"), shown on the right. */
  action?: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}

/**
 * Pressed-in notice used for errors, warnings and confirmations across the booking flow:
 * a recessed parchment well with a raised tone-coloured icon, instead of flat coloured boxes.
 * It settles in with a small spring, errors give a short shake, and the icon pops; wrap it in
 * <AnimatePresence> at the call site to also animate it out.
 */
export function NeuAlert({ tone = 'info', title, children, action, onDismiss, className = '' }: NeuAlertProps) {
  const t = TONES[tone];
  return (
    <motion.div
      role={tone === 'error' ? 'alert' : 'status'}
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={tone === 'error' ? { opacity: 1, y: 0, scale: 1, x: [0, -5, 5, -3, 3, 0] } : { opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 30, x: { duration: 0.4, delay: 0.1 } }}
      className={`neu-recessed rounded-2xl px-4 py-3.5 sm:px-5 flex items-start gap-3 ${className}`}
    >
      <motion.span
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 18, delay: 0.06 }}
        className={`neu-raised-sm size-8 shrink-0 rounded-full flex items-center justify-center ${t.iconColor}`}
      >
        {t.icon}
      </motion.span>
      <div className="min-w-0 flex-1 pt-[5px] font-inter text-xs sm:text-[13px] leading-relaxed text-[#3E2A1E]">
        {title && <p className={`font-semibold ${t.titleColor}`}>{title}</p>}
        {children && <div className={`whitespace-pre-line ${title ? 'mt-0.5' : ''}`}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
      {onDismiss && (
        <motion.button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          whileHover={{ rotate: 90 }}
          whileTap={{ scale: 0.85 }}
          className="shrink-0 self-center size-7 rounded-full flex items-center justify-center text-[#7D6855] hover:text-[#341512] transition-colors cursor-pointer"
        >
          <CloseIcon className="w-3 h-3" />
        </motion.button>
      )}
    </motion.div>
  );
}

export default NeuAlert;
