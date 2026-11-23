'use client';

import React, { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { AnimatePresence, MotionConfig, motion, type Variants } from 'motion/react';
import { EASE_OUT } from '@/components/shared/neu/motion';
import {
  ChevronRightIcon,
  FolderIcon,
  FolderOpenIcon,
  PencilIcon,
  TrashIcon,
} from '@/components/shared/neu/NeuIcons';
import {
  createDocumentFolderAction,
  uploadDocumentFileAction,
  deleteDocumentFileAction,
  deleteDocumentFolderAction,
  renameDocumentFolderAction,
  getDocumentAccessUrlAction,
} from '@/app/actions/consultationActions';
import { fetchLive } from '@/lib/live/fetchLive';
import { useLiveRefresh } from '@/components/live/LiveProvider';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface DocumentItem {
  id: string;
  name: string;
  size: string;
  type: 'pdf' | 'doc' | 'excel' | 'csv' | 'jpg' | 'png' | 'txt' | 'mp4';
  updatedAt: string;
}

export interface FolderItem {
  id: string;
  name: string;
  kind?: 'shared' | 'owned';
  isRecentlyCreated?: boolean;
  files: DocumentItem[];
}

interface DocumentsViewProps {
  role?: 'client' | 'lawyer';
}

type NavDirection = 'forward' | 'back' | 'fade';

// ─── Default Case Folders (Matching User Design Reference Exactly) ───────────

const DEFAULT_CASE_FOLDERS: FolderItem[] = [
  {
    id: 'divorce-case',
    name: 'Divorce Case',
    kind: 'owned',
    files: [
      { id: 'div-1', name: 'Petition for Nullity of Marriage.pdf', size: '1.8 MB', type: 'pdf', updatedAt: '2 days ago' },
      { id: 'div-2', name: 'PSA Certified Marriage Certificate.pdf', size: '820 KB', type: 'pdf', updatedAt: '3 days ago' },
      { id: 'div-3', name: 'Judicial Affidavit of Petitioner.docx', size: '450 KB', type: 'doc', updatedAt: '1 week ago' },
      { id: 'div-4', name: 'Inventory of Conjugal Properties.xlsx', size: '320 KB', type: 'excel', updatedAt: '2 weeks ago' },
      { id: 'div-5', name: 'Child Custody and Support Agreement.pdf', size: '640 KB', type: 'pdf', updatedAt: '2 weeks ago' },
    ],
  },
  {
    id: 'land-ownership-case',
    name: 'Land Ownership Case',
    kind: 'owned',
    files: [
      { id: 'land-1', name: 'Transfer Certificate of Title (TCT).pdf', size: '2.4 MB', type: 'pdf', updatedAt: '4 days ago' },
      { id: 'land-2', name: 'Deed of Absolute Sale Notarized.pdf', size: '1.1 MB', type: 'pdf', updatedAt: '1 week ago' },
      { id: 'land-3', name: 'DENR Cadastral Survey Plan.pdf', size: '3.8 MB', type: 'pdf', updatedAt: '2 weeks ago' },
      { id: 'land-4', name: 'Real Property Tax Declaration.pdf', size: '750 KB', type: 'pdf', updatedAt: '3 weeks ago' },
    ],
  },
  {
    id: 'criminal-case',
    name: 'Criminal Case',
    kind: 'owned',
    files: [
      { id: 'crim-1', name: 'Resolution of City Prosecutor.pdf', size: '980 KB', type: 'pdf', updatedAt: '5 days ago' },
      { id: 'crim-2', name: 'Criminal Information Sheet (RTC).pdf', size: '620 KB', type: 'pdf', updatedAt: '1 week ago' },
      { id: 'crim-3', name: 'Official Bail Bond Receipt.pdf', size: '410 KB', type: 'pdf', updatedAt: '2 weeks ago' },
    ],
  },
  {
    id: 'business-legal-owners',
    name: 'Business Legal Owners',
    kind: 'owned',
    files: [
      { id: 'biz-1', name: 'SEC Articles of Incorporation.pdf', size: '1.4 MB', type: 'pdf', updatedAt: '1 week ago' },
      { id: 'biz-2', name: 'General Information Sheet (GIS).pdf', size: '850 KB', type: 'pdf', updatedAt: '2 weeks ago' },
      { id: 'biz-3', name: 'Shareholders Agreement Final.docx', size: '560 KB', type: 'doc', updatedAt: '3 weeks ago' },
      { id: 'biz-4', name: 'BIR Certificate of Registration.pdf', size: '490 KB', type: 'pdf', updatedAt: '1 month ago' },
    ],
  },
  {
    id: 'defamation-case',
    name: 'Defamation Case',
    kind: 'owned',
    files: [
      { id: 'def-1', name: 'Complaint Affidavit Cyber Libel.pdf', size: '1.3 MB', type: 'pdf', updatedAt: '3 days ago' },
      { id: 'def-2', name: 'Annex A Social Media Screenshots.png', size: '2.2 MB', type: 'png', updatedAt: '4 days ago' },
      { id: 'def-3', name: 'Cease and Desist Demand Letter.docx', size: '540 KB', type: 'doc', updatedAt: '1 week ago' },
    ],
  },
  {
    id: 'school-shooting-case',
    name: 'School Shooting Case',
    kind: 'owned',
    files: [
      { id: 'sch-1', name: 'PNP Initial Investigation Report.pdf', size: '3.1 MB', type: 'pdf', updatedAt: '1 week ago' },
      { id: 'sch-2', name: 'Ballistics and Forensic Evidence.pdf', size: '4.2 MB', type: 'pdf', updatedAt: '2 weeks ago' },
      { id: 'sch-3', name: 'Medical and Hospital Records.pdf', size: '1.9 MB', type: 'pdf', updatedAt: '3 weeks ago' },
    ],
  },
  {
    id: 'bullying-case',
    name: 'Bullying Case',
    kind: 'owned',
    files: [
      { id: 'bul-1', name: 'DepEd Child Protection Incident Report.pdf', size: '720 KB', type: 'pdf', updatedAt: '4 days ago' },
      { id: 'bul-2', name: 'Guidance Counselor Formal Summary.docx', size: '390 KB', type: 'doc', updatedAt: '1 week ago' },
      { id: 'bul-3', name: 'Witness Statements Compilation.pdf', size: '880 KB', type: 'pdf', updatedAt: '2 weeks ago' },
    ],
  },
  {
    id: 'fraud-case',
    name: 'Fraud Case',
    kind: 'owned',
    files: [
      { id: 'frd-1', name: 'Sworn Affidavit of Complaint for Estafa.pdf', size: '1.6 MB', type: 'pdf', updatedAt: '6 days ago' },
      { id: 'frd-2', name: 'Bank Statement and Transfer Slips.pdf', size: '2.1 MB', type: 'pdf', updatedAt: '1 week ago' },
      { id: 'frd-3', name: 'Certified Public Accountant Audit.xlsx', size: '640 KB', type: 'excel', updatedAt: '3 weeks ago' },
    ],
  },
  {
    id: 'juvenile-employment-case',
    name: 'Juvenile Employment Case',
    kind: 'owned',
    files: [
      { id: 'juv-1', name: 'DOLE Special Work Permit Application.pdf', size: '810 KB', type: 'pdf', updatedAt: '1 week ago' },
      { id: 'juv-2', name: 'Parental Sworn Affidavit of Consent.pdf', size: '490 KB', type: 'pdf', updatedAt: '2 weeks ago' },
      { id: 'juv-3', name: 'Youth Apprenticeship Agreement.docx', size: '380 KB', type: 'doc', updatedAt: '3 weeks ago' },
    ],
  },
];

// Helper: map document extensions to icon paths
function getDocIconPath(type: DocumentItem['type']) {
  switch (type) {
    case 'pdf':
      return '/document_icons/pdf_icon.svg';
    case 'doc':
      return '/document_icons/doc_icon.svg';
    case 'excel':
      return '/document_icons/excel_icon.svg';
    case 'csv':
      return '/document_icons/csv_icon.svg';
    case 'jpg':
      return '/document_icons/jpg_icon.svg';
    case 'png':
      return '/document_icons/png_icon.svg';
    case 'txt':
      return '/document_icons/txt_icon.svg';
    case 'mp4':
      return '/document_icons/mp4_icon.svg';
    default:
      return '/document_icons/doc_icon.svg';
  }
}

// Helper: staggered entrance delay (capped so long lists never feel slow).
// Also exposes the index as --i so nested parts (folder flap, papers) can time
// their own entrance relative to the card.
const stagger = (index: number, step = 50, max = 12): React.CSSProperties =>
  ({
    '--i': Math.min(index, max),
    animationDelay: `${Math.min(index, max) * step}ms`,
  }) as React.CSSProperties;

// Helper: navigation depth, used to pick the slide direction
const depthOf = (section: 'shared' | 'owned' | null, folderId: string | null) =>
  (section ? 1 : 0) + (folderId ? 1 : 0);

// Pointer tilt: writes --tx / --ty on the hovered card so its artwork leans toward
// the cursor. Mouse only; touch and pen keep the plain hover state.
const onTiltMove = (e: React.PointerEvent<HTMLElement>) => {
  if (e.pointerType !== 'mouse') return;
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - 0.5;
  const y = (e.clientY - r.top) / r.height - 0.5;
  el.style.setProperty('--tx', `${(-x * 18).toFixed(2)}deg`);
  el.style.setProperty('--ty', `${(y * 14).toFixed(2)}deg`);
};
const onTiltLeave = (e: React.PointerEvent<HTMLElement>) => {
  e.currentTarget.style.setProperty('--tx', '0deg');
  e.currentTarget.style.setProperty('--ty', '0deg');
};

// ─── Animation System ─────────────────────────────────────────────────────────
// Screen-level motion is CSS on purpose: ClientShell keeps this tab mounted and
// toggles it with `hidden`, and CSS keyframes replay every time the tab is shown
// again. Entrance animations use `backwards` fill so they never override hover
// transforms once they finish. Modals use motion/react (see ViewportModal).

const DOCS_MOTION_CSS = `
.docs-root, .docs-modal-layer {
  --docs-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --docs-ease-soft: cubic-bezier(0.4, 0, 0.2, 1);
  --docs-spring: cubic-bezier(0.34, 1.45, 0.64, 1);
}

/* ── Keyframes ─────────────────────────────────────────────────────────── */
@keyframes docs-rise {
  0%   { opacity: 0; transform: perspective(900px) translateY(30px) rotateX(24deg) scale(0.94); filter: blur(5px); }
  60%  { opacity: 1; filter: blur(0); }
  100% { opacity: 1; transform: perspective(900px) translateY(0) rotateX(0) scale(1); filter: blur(0); }
}
@keyframes docs-deal {
  0%   { opacity: 0; transform: translateY(-26px) scale(0.72) rotate(var(--deal-r, -7deg)); filter: blur(4px); }
  65%  { opacity: 1; transform: translateY(4px) scale(1.02) rotate(0deg); filter: blur(0); }
  100% { opacity: 1; transform: translateY(0) scale(1) rotate(0deg); }
}
@keyframes docs-fade-up {
  from { opacity: 0; transform: translateY(12px); filter: blur(4px); }
  to   { opacity: 1; transform: translateY(0); filter: blur(0); }
}
@keyframes docs-tool-pop {
  0%   { opacity: 0; transform: scale(0.6) rotate(-6deg); }
  60%  { opacity: 1; transform: scale(1.05) rotate(1deg); }
  100% { opacity: 1; transform: scale(1) rotate(0); }
}
@keyframes docs-crumb-reveal {
  from { opacity: 0; clip-path: inset(0 100% 0 0 round 13px); }
  to   { opacity: 1; clip-path: inset(0 0 0 0 round 13px); }
}
@keyframes docs-tool-slide {
  from { opacity: 0; transform: translateX(26px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes docs-view-forward {
  from { opacity: 0; transform: translateX(28px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes docs-view-back {
  from { opacity: 0; transform: translateX(-28px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes docs-view-fade {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes docs-crumb-in {
  from { opacity: 0; transform: translateX(-8px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes docs-wiggle {
  0%, 100% { rotate: 0deg; }
  25% { rotate: -12deg; }
  50% { rotate: 9deg; }
  75% { rotate: -4deg; }
}
@keyframes docs-pop {
  0%   { opacity: 0; transform: scale(0.6) rotate(-8deg); }
  60%  { opacity: 1; transform: scale(1.06) rotate(2deg); }
  100% { opacity: 1; transform: scale(1) rotate(0); }
}
/* Folder entrance: papers drop in, then the flap swings shut with a small bounce */
@keyframes docs-paper-file {
  from { opacity: 0; transform: translateY(-70%); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes docs-flap-shut {
  0%   { transform: perspective(var(--fp)) rotateX(-58deg); }
  65%  { transform: perspective(var(--fp)) rotateX(7deg); }
  85%  { transform: perspective(var(--fp)) rotateX(-2deg); }
  100% { transform: perspective(var(--fp)) rotateX(0deg); }
}

/* ── Screen entrance ───────────────────────────────────────────────────── */
.docs-toolbar > * { animation: docs-tool-slide 0.6s var(--docs-ease) backwards; }
.docs-toolbar > *:nth-child(1) { animation: docs-tool-pop 0.6s var(--docs-ease) 0.04s backwards; }
.docs-toolbar > *:nth-child(2) { animation: docs-crumb-reveal 0.75s var(--docs-ease) 0.12s backwards; }
.docs-toolbar > *:nth-child(3) { animation-delay: 0.2s; }

.docs-view--forward { animation: docs-view-forward 0.5s var(--docs-ease) backwards; }
.docs-view--back    { animation: docs-view-back 0.5s var(--docs-ease) backwards; }
.docs-view--fade    { animation: docs-view-fade 0.4s var(--docs-ease) backwards; }
.docs-rise          { transform-origin: 50% 100%; animation: docs-rise 0.7s var(--docs-ease) backwards; }
.docs-deal          { transform-origin: 50% 0%; animation: docs-deal 0.65s var(--docs-ease) backwards; }
.docs-deal:nth-child(even) { --deal-r: 7deg; }
.docs-crumb-in      { animation: docs-crumb-in 0.4s var(--docs-ease) backwards; }
.docs-pop           { animation: docs-pop 0.6s var(--docs-ease) 0.15s backwards; }

/* ── Folder (layered so each part can move on its own) ─────────────────── */
.docs-folder {
  --fp: 420px;       /* flap perspective */
  --persp: 700px;    /* whole-folder tilt perspective */
  --lift: 0px;
  --sc: 1;
  --flap: 0deg;
  position: relative;
}
.docs-folder--sm { --fp: 110px; --persp: 160px; }

.docs-folder-shadow {
  position: absolute; left: 12%; right: 12%; bottom: -5%; height: 12%;
  border-radius: 50%;
  background: radial-gradient(ellipse at center, rgba(52, 21, 18, 0.32) 0%, rgba(52, 21, 18, 0) 70%);
  transition: transform 0.6s var(--docs-ease), opacity 0.6s var(--docs-ease);
}
.docs-folder-body {
  position: absolute; inset: 0;
  transform: perspective(var(--persp)) translateY(var(--lift)) rotateX(var(--ty, 0deg)) rotateY(var(--tx, 0deg)) scale(var(--sc));
  transition: transform 0.6s var(--docs-ease);
  will-change: transform;
}
.docs-folder-back { position: absolute; inset: 0; width: 100%; height: 100%; }

.docs-paper {
  position: absolute; left: 10%; right: 10%; top: 25%; bottom: 14%;
  border-radius: 4% / 3%;
  background:
    repeating-linear-gradient(to bottom, rgba(105, 80, 74, 0.22) 0 2.5%, transparent 2.5% 11%) 50% 22% / 68% 60% no-repeat,
    var(--paper, #F5EDE3);
  box-shadow: 0 -1px 0 rgba(255, 255, 255, 0.6) inset, 0 2px 6px rgba(52, 21, 18, 0.18);
  transform-origin: 50% 100%;
  transition: transform 0.32s var(--docs-ease-soft);
}
.docs-paper--a { --paper: #E9DCCB; }
.docs-paper--b { --paper: #EFE4D6; }
.docs-paper--c { --paper: #F7F0E7; }
/* Paperclip on the front sheet */
.docs-paper--c::before {
  content: ''; position: absolute; top: -6%; left: 16%; width: 7%; height: 24%;
  border: 1.5px solid #C58B3C; border-radius: 999px;
}
.docs-folder--sm .docs-paper--c::before { border-width: 1px; }

.docs-folder-front {
  position: absolute; left: 2.5%; right: 2.9%; top: 19.6%; bottom: 10.7%;
  border-radius: 4.8% / 8%;
  background: #69504A;
  transform-origin: 50% 100%;
  transform: perspective(var(--fp)) rotateX(var(--flap));
  transition: transform 0.45s var(--docs-ease-soft);
}
/* Hover / focus (and while its options menu is open): lift, flap opens, papers fan out */
.docs-card:hover .docs-folder,
.docs-card:focus-visible .docs-folder,
.docs-card--active .docs-folder { --lift: -7px; --sc: 1.04; --flap: -40deg; }
.docs-card:hover .docs-folder--sm,
.docs-card:focus-visible .docs-folder--sm { --lift: -2px; --sc: 1.06; }
.docs-card:hover .docs-folder-front,
.docs-card:focus-visible .docs-folder-front,
.docs-card--active .docs-folder-front {
  transition: transform 0.7s var(--docs-spring);
}
.docs-card:hover .docs-folder-shadow,
.docs-card:focus-visible .docs-folder-shadow,
.docs-card--active .docs-folder-shadow { transform: scale(0.84); opacity: 0.6; }

.docs-card:hover .docs-paper,
.docs-card:focus-visible .docs-paper,
.docs-card--active .docs-paper { transition: transform 0.6s var(--docs-spring); }
.docs-card:hover .docs-paper--a,
.docs-card:focus-visible .docs-paper--a,
.docs-card--active .docs-paper--a { transform: translate(-8%, -36%) rotate(-9deg); transition-delay: 0.06s; }
.docs-card:hover .docs-paper--b,
.docs-card:focus-visible .docs-paper--b,
.docs-card--active .docs-paper--b { transform: translate(8%, -42%) rotate(7deg); transition-delay: 0.12s; }
.docs-card:hover .docs-paper--c,
.docs-card:focus-visible .docs-paper--c,
.docs-card--active .docs-paper--c { transform: translate(0, -30%) rotate(-2deg); transition-delay: 0.18s; }

/* Press: the flap snaps half shut and the folder settles (not when pressing the menu) */
.docs-card:active:not(:has(.docs-menu-btn:active)) .docs-folder { --lift: -2px; --sc: 0.98; --flap: -16deg; }
.docs-card:active:not(:has(.docs-menu-btn:active)) .docs-folder-body,
.docs-card:active:not(:has(.docs-menu-btn:active)) .docs-folder-front { transition-duration: 0.15s; }

/* Grid entrance: papers file in, flap closes on them as the card lands */
.docs-folder--enter .docs-paper {
  animation: docs-paper-file 0.5s var(--docs-ease) backwards;
  animation-delay: calc(var(--i, 0) * 50ms + 200ms);
}
.docs-folder--enter .docs-folder-front {
  animation: docs-flap-shut 0.8s var(--docs-ease) backwards;
  animation-delay: calc(var(--i, 0) * 50ms + 300ms);
}

/* ── Document icons: lean toward the cursor like the folders ───────────── */
.docs-doc-art {
  transform-origin: 50% 100%;
  transform: perspective(600px) translateY(0) rotateX(0deg) rotateY(0deg) scale(1);
  transition: transform 0.55s var(--docs-ease);
  will-change: transform;
}
.docs-card:hover .docs-doc-art,
.docs-card:focus-visible .docs-doc-art {
  transform: perspective(600px) translateY(-6px) rotateX(var(--ty, 0deg)) rotateY(var(--tx, 0deg)) scale(1.06);
}
.docs-card:active .docs-doc-art { transform: perspective(600px) translateY(-2px) scale(0.98); transition-duration: 0.15s; }

/* Labels drift up slightly with their icon */
.docs-label { transition: color 0.3s var(--docs-ease-soft), transform 0.5s var(--docs-ease); }
.docs-card:hover .docs-label,
.docs-card:focus-visible .docs-label { transform: translateY(-2px); }

/* List rows */
.docs-row-body  { transition: transform 0.4s var(--docs-ease); }
.docs-row-arrow { opacity: 0; transform: translateX(-6px); transition: opacity 0.3s ease, transform 0.4s var(--docs-ease); }
.docs-card:hover .docs-row-body  { transform: translateX(4px); }
.docs-card:hover .docs-row-arrow { opacity: 1; transform: translateX(0); }
.docs-row-icon  { transition: transform 0.45s var(--docs-ease); }
.docs-card:hover .docs-row-icon { transform: scale(1.1) rotate(-2deg); }

/* ── Folder options menu ───────────────────────────────────────────────── */
.docs-menu {
  background: #ECE2D7;
  box-shadow:
    0 22px 44px -16px rgba(52, 21, 18, 0.38),
    0 6px 14px -6px rgba(52, 21, 18, 0.2),
    -4px -4px 12px rgba(252, 238, 223, 0.7),
    inset 0 1px 0 rgba(255, 255, 255, 0.55),
    inset 0 0 0 1px rgba(211, 192, 170, 0.55);
}
/* Little pointer aimed at the trigger */
.docs-menu::before {
  content: ''; position: absolute; top: -6px; right: 9px; width: 11px; height: 11px;
  background: #ECE2D7; rotate: 45deg; border-radius: 2px 0 0 0;
  box-shadow: inset 1px 1px 0 rgba(211, 192, 170, 0.55);
}
.docs-mi-glyph { transition: transform 0.45s var(--docs-spring); }
.docs-menu-item:hover .docs-mi-glyph--open,
.docs-menu-item:focus-visible .docs-mi-glyph--open { transform: translate(1px, -1px) scale(1.1); }
.docs-menu-item:hover .docs-mi-glyph--rename,
.docs-menu-item:focus-visible .docs-mi-glyph--rename { transform: rotate(-16deg) translate(-1px, -1px); }
.docs-menu-item:hover .docs-mi-glyph--delete,
.docs-menu-item:focus-visible .docs-mi-glyph--delete { animation: docs-wiggle 0.5s ease-in-out; }
.docs-mi-arrow { opacity: 0; transform: translateX(-5px); transition: opacity 0.25s ease, transform 0.4s var(--docs-ease); }
.docs-menu-item:hover .docs-mi-arrow,
.docs-menu-item:focus-visible .docs-mi-arrow { opacity: 1; transform: translateX(0); }
.docs-menu-dots { transition: transform 0.5s var(--docs-spring); }
.docs-menu-trigger[aria-expanded='true'] .docs-menu-dots { transform: rotate(90deg); }

/* Folder kebab menu: stays visible on touch devices where hover is unavailable */
@media (hover: none) {
  .docs-menu-btn { opacity: 1 !important; transform: none !important; }
}

/* Back link nudge */
.docs-back-arrow { display: inline-block; transition: transform 0.35s var(--docs-ease); }
.docs-back:hover .docs-back-arrow { transform: translateX(-4px); }

/* ── Modal content cascade (panel motion lives in ViewportModal) ───────── */
.docs-modal-card > *,
.docs-modal-card form > * { animation: docs-fade-up 0.5s var(--docs-ease) backwards; animation-delay: 0.1s; }
.docs-modal-card > form { animation: none; }
.docs-modal-card > *:nth-child(2), .docs-modal-card form > *:nth-child(1) { animation-delay: 0.15s; }
.docs-modal-card > *:nth-child(3), .docs-modal-card form > *:nth-child(2) { animation-delay: 0.2s; }
.docs-modal-card > *:nth-child(4), .docs-modal-card form > *:nth-child(3) { animation-delay: 0.25s; }
.docs-modal-card > *:nth-child(5), .docs-modal-card form > *:nth-child(4) { animation-delay: 0.3s; }
.docs-modal-card > *:nth-child(n+6), .docs-modal-card form > *:nth-child(n+5) { animation-delay: 0.35s; }

/* Reduced motion: keep every state change, remove the movement */
@media (prefers-reduced-motion: reduce) {
  .docs-root, .docs-root *, .docs-root *::before, .docs-root *::after,
  .docs-modal-layer, .docs-modal-layer *, .docs-modal-layer *::before, .docs-modal-layer *::after {
    animation-duration: 0.001ms !important;
    animation-delay: 0ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    transition-delay: 0ms !important;
  }
  .docs-folder-body,
  .docs-card:hover .docs-doc-art,
  .docs-card:focus-visible .docs-doc-art,
  .docs-card:hover .docs-label,
  .docs-card:hover .docs-row-body,
  .docs-card:hover .docs-row-icon { transform: none !important; }
}
`;

// ─── Folder Art ───────────────────────────────────────────────────────────────
// Built from layers instead of two stacked images so each part can move on its
// own: back panel + tab (SVG), one paper per document (max 3), and the front
// flap that swings toward the viewer on hover. The trigger is the nearest
// `.docs-card`. Geometry matches /assets/folder_icon.svg (160 x 130).

const FOLDER_BACK_PATH =
  'M11.2083 11H58.0625L72.4792 25.5H148.167C150.078 25.5 151.912 26.2638 153.264 27.6235C154.616 28.9831 155.375 30.8272 155.375 32.75V112.5C155.375 114.423 154.616 116.267 153.264 117.627C151.912 118.986 150.078 119.75 148.167 119.75H11.2083C9.29656 119.75 7.4631 118.986 6.11127 117.627C4.75945 116.267 4 114.423 4 112.5V18.25C4 16.3272 4.75945 14.4831 6.11127 13.1235C7.4631 11.7638 9.29656 11 11.2083 11Z';

function FolderArt({
  count,
  size = 'lg',
  enter = false,
  className = '',
}: {
  count: number;
  size?: 'lg' | 'sm';
  /** Play the "papers file in, flap shuts" entrance (grid view). */
  enter?: boolean;
  className?: string;
}) {
  const sheets = count >= 3 ? ['a', 'b', 'c'] : count === 2 ? ['a', 'c'] : count === 1 ? ['c'] : [];

  return (
    <div
      aria-hidden="true"
      className={`docs-folder aspect-[16/13] ${size === 'sm' ? 'docs-folder--sm' : ''} ${enter ? 'docs-folder--enter' : ''} ${className}`}
    >
      {size === 'lg' && <div className="docs-folder-shadow" />}
      <div className="docs-folder-body">
        <svg className="docs-folder-back" viewBox="0 0 160 130" fill="none">
          <path d={FOLDER_BACK_PATH} fill="#341512" />
        </svg>
        {sheets.map((s) => (
          <div key={s} className={`docs-paper docs-paper--${s}`} />
        ))}
        <div className="docs-folder-front" />
      </div>
    </div>
  );
}

// ─── Folder Options Menu ──────────────────────────────────────────────────────
// Kebab trigger + popover. Springs out of the trigger, sharpens from a blur and
// cascades its items in; keyboard: ArrowUp/Down, Home/End, Esc (returns focus).

const folderMenuVariants: Variants = {
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
      staggerChildren: 0.035,
      delayChildren: 0.05,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.94,
    y: -6,
    filter: 'blur(4px)',
    transition: { duration: 0.15, ease: [0.4, 0, 1, 1] },
  },
};

const folderMenuItemVariants: Variants = {
  hidden: { opacity: 0, x: 10 },
  show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 520, damping: 34 } },
};

interface FolderMenuProps {
  open: boolean;
  folderName: string;
  count: number;
  onToggle: () => void;
  onClose: () => void;
  onOpenFolder: () => void;
  onRename: () => void;
  onDelete: () => void;
}

function FolderMenu({ open, folderName, count, onToggle, onClose, onOpenFolder, onRename, onDelete }: FolderMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Move focus into the menu when it opens (no visible ring after a mouse click).
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() =>
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true })
    );
    return () => cancelAnimationFrame(id);
  }, [open]);

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    if (!items.length) return;
    const i = items.indexOf(document.activeElement as HTMLElement);
    const focusAt = (n: number) => items[(n + items.length) % items.length]?.focus();
    if (e.key === 'ArrowDown') { e.preventDefault(); focusAt(i + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusAt(i - 1); }
    else if (e.key === 'Home') { e.preventDefault(); focusAt(0); }
    else if (e.key === 'End') { e.preventDefault(); focusAt(items.length - 1); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); triggerRef.current?.focus(); }
    else if (e.key === 'Tab') onClose();
  };

  const select = (action: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
    action();
  };

  const itemBase =
    'docs-menu-item group/mi w-full flex items-center gap-3 px-2 py-1.5 rounded-xl font-inter text-[13px] font-medium text-left transition-colors duration-200 focus:outline-none cursor-pointer';
  const tileBase = 'size-7 shrink-0 rounded-lg flex items-center justify-center transition-colors duration-200';

  return (
    <div
      className={`docs-menu-btn absolute top-2 right-2 z-20 transition-[opacity,scale] duration-200 ${open
          ? 'opacity-100 scale-100'
          : 'opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 group-focus-within:opacity-100 group-focus-within:scale-100'
        }`}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            onToggle();
          }
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Options for ${folderName}`}
        title="Folder options"
        className={`docs-menu-trigger size-7 rounded-full bg-[#E5D8CB] flex items-center justify-center cursor-pointer transition-[color,box-shadow] duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B9833C]/50 ${open ? 'neu-recessed text-[#C58B3C]' : 'neu-raised-sm text-[#5A4537] hover:text-[#34150F]'
          }`}
      >
        <svg className="docs-menu-dots w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </button>

      <MotionConfig reducedMotion="user">
        <AnimatePresence>
          {open && (
            <motion.div
              ref={menuRef}
              role="menu"
              aria-label={`${folderName} options`}
              variants={folderMenuVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              style={{ transformOrigin: 'calc(100% - 14px) -6px' }}
              onKeyDown={onMenuKeyDown}
              className="docs-menu absolute right-0 top-full mt-3 w-56 rounded-2xl p-1.5 cursor-default"
            >
              {/* Header: which folder this acts on */}
              <motion.div variants={folderMenuItemVariants} className="flex items-center gap-2.5 px-2.5 pt-2 pb-2.5">
                <FolderIcon className="w-4 h-4 shrink-0 text-[#C58B3C]" />
                <div className="min-w-0">
                  <p className="font-lora text-[13px] font-semibold text-[#34150F] leading-tight truncate" title={folderName}>
                    {folderName}
                  </p>
                  <p className="font-inter text-[11px] text-[#8C7A6A] mt-0.5">
                    {count} {count === 1 ? 'document' : 'documents'}
                  </p>
                </div>
              </motion.div>
              <div className="mx-2 mb-1 h-px bg-[#D6C3AD]/70" />

              <motion.button
                type="button"
                role="menuitem"
                tabIndex={-1}
                variants={folderMenuItemVariants}
                onClick={select(onOpenFolder)}
                className={`${itemBase} text-[#34150F] hover:bg-[#DCCBB7]/60 focus-visible:bg-[#DCCBB7]/60`}
              >
                <span className={`${tileBase} bg-[#DCCBB7]/55 text-[#7A604D] group-hover/mi:bg-[#C58B3C]/15 group-hover/mi:text-[#A8742E] group-focus-visible/mi:bg-[#C58B3C]/15 group-focus-visible/mi:text-[#A8742E]`}>
                  <FolderOpenIcon className="docs-mi-glyph docs-mi-glyph--open w-4 h-4" />
                </span>
                <span className="flex-1">Open folder</span>
                <ChevronRightIcon className="docs-mi-arrow w-3.5 h-3.5 text-[#C58B3C]" />
              </motion.button>

              <motion.button
                type="button"
                role="menuitem"
                tabIndex={-1}
                variants={folderMenuItemVariants}
                onClick={select(onRename)}
                className={`${itemBase} text-[#34150F] hover:bg-[#DCCBB7]/60 focus-visible:bg-[#DCCBB7]/60`}
              >
                <span className={`${tileBase} bg-[#DCCBB7]/55 text-[#7A604D] group-hover/mi:bg-[#C58B3C]/15 group-hover/mi:text-[#A8742E] group-focus-visible/mi:bg-[#C58B3C]/15 group-focus-visible/mi:text-[#A8742E]`}>
                  <PencilIcon className="docs-mi-glyph docs-mi-glyph--rename w-4 h-4" />
                </span>
                <span className="flex-1">Rename</span>
              </motion.button>

              <div className="mx-2 my-1 h-px bg-[#D6C3AD]/70" />

              <motion.button
                type="button"
                role="menuitem"
                tabIndex={-1}
                variants={folderMenuItemVariants}
                onClick={select(onDelete)}
                className={`${itemBase} text-[#B42318] hover:bg-[#B42318]/[0.08] focus-visible:bg-[#B42318]/[0.08]`}
              >
                <span className={`${tileBase} bg-[#B42318]/10 text-[#B42318] group-hover/mi:bg-[#B42318]/15 group-focus-visible/mi:bg-[#B42318]/15`}>
                  <TrashIcon className="docs-mi-glyph docs-mi-glyph--delete w-4 h-4" />
                </span>
                <span className="flex-1">Delete folder</span>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </MotionConfig>
    </div>
  );
}

// ─── Viewport Portal Modal Component ──────────────────────────────────────────
// Rendered into document.body so it is never clipped by scroll containers or
// transforms. AnimatePresence keeps the last content on screen while the exit
// plays, so callers can clear their state (e.g. previewDocument) right away.
//
// Motion: the backdrop warms and blurs in; the sheet tips up from below and
// comes into focus while the caramel rim closes in around it; sections cascade
// in (CSS, .docs-modal-card). On close the sheet tips back, the rim lets go
// and everything blurs out.

interface ViewportModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
  ariaLabel?: string;
}

// Shared scroll-lock counter so closing one stacked modal never unlocks the page
// while another is still open.
let openModalCount = 0;

const noopSubscribe = () => () => {};

const RIM = 'rgba(211, 151, 88, 1)';
const RIM_CLEAR = 'rgba(211, 151, 88, 0)';

const modalBackdropVariants: Variants = {
  hidden: { opacity: 0, backdropFilter: 'blur(0px)' },
  show: { opacity: 1, backdropFilter: 'blur(7px)', transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { opacity: 0, backdropFilter: 'blur(0px)', transition: { duration: 0.24, ease: 'easeIn', delay: 0.06 } },
};

const modalPanelVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 64,
    scale: 0.9,
    rotateX: 18,
    filter: 'blur(10px)',
    outlineOffset: '16px',
    outlineColor: RIM_CLEAR,
  },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    rotateX: 0,
    filter: 'blur(0px)',
    outlineOffset: '0px',
    outlineColor: RIM,
    transition: {
      type: 'spring',
      stiffness: 230,
      damping: 23,
      mass: 0.9,
      opacity: { duration: 0.25 },
      filter: { duration: 0.4, ease: 'easeOut' },
      outlineOffset: { duration: 0.55, ease: EASE_OUT, delay: 0.12 },
      outlineColor: { duration: 0.4, ease: 'easeOut', delay: 0.12 },
    },
  },
  exit: {
    opacity: 0,
    y: 40,
    scale: 0.94,
    rotateX: -12,
    filter: 'blur(8px)',
    outlineOffset: '12px',
    outlineColor: RIM_CLEAR,
    transition: { duration: 0.26, ease: [0.4, 0, 1, 1] },
  },
};

function ViewportModal({
  isOpen,
  onClose,
  children,
  maxWidth = 'max-w-[480px] sm:max-w-[520px]',
  ariaLabel = 'Modal dialog',
}: ViewportModalProps) {
  // true on the client, false during SSR, so the portal only renders in the browser.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  // Lock body scroll while any modal is active
  useEffect(() => {
    if (!isOpen) return;
    openModalCount += 1;
    document.body.style.overflow = 'hidden';
    return () => {
      openModalCount = Math.max(0, openModalCount - 1);
      if (openModalCount === 0) document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!mounted) return null;

  return createPortal(
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="docs-modal"
            className="docs-modal-layer fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6"
            style={{ perspective: 1400 }}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            {/* Warm vignette backdrop */}
            <motion.div
              variants={modalBackdropVariants}
              className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,rgba(26,15,10,0.55)_0%,rgba(26,15,10,0.82)_100%)]"
              onClick={onClose}
              aria-hidden="true"
            />

            {/* Sheet: .neu-modal with the caramel rim (rim colour/offset animated inline) */}
            <motion.div
              variants={modalPanelVariants}
              style={{ transformOrigin: '50% 100%' }}
              className={`docs-modal-card neu-modal relative w-full ${maxWidth} px-7 sm:px-10 pt-9 pb-8 sm:pt-10 sm:pb-9 z-10 max-h-[92vh] overflow-y-auto`}
              onClick={(e) => e.stopPropagation()}
            >
              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>,
    document.body
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DocumentsView({ role = 'client' }: DocumentsViewProps) {
  const [folders, setFolders] = useState<FolderItem[]>(DEFAULT_CASE_FOLDERS);
  const [loadingDocs, setLoadingDocs] = useState<boolean>(true);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [currentSection, setCurrentSection] = useState<'shared' | 'owned' | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [hoveredSection, setHoveredSection] = useState<'shared' | 'owned' | null>(null);
  const [navDirection, setNavDirection] = useState<NavDirection>('fade');
  const [activeMenuFolderId, setActiveMenuFolderId] = useState<string | null>(null);

  // Modals state
  const [showNewFolderModal, setShowNewFolderModal] = useState<boolean>(false);
  const [showUploadFileModal, setShowUploadFileModal] = useState<boolean>(false);
  const [showRenameFolderModal, setShowRenameFolderModal] = useState<FolderItem | null>(null);
  const [previewDocument, setPreviewDocument] = useState<DocumentItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'file' | 'folder'; id: string; name: string } | null>(null);

  // Form states
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [folderCategory, setFolderCategory] = useState<string>('Family Law');
  const [newFileName, setNewFileName] = useState<string>('');
  const [newFileType, setNewFileType] = useState<DocumentItem['type']>('pdf');
  const [renameFolderName, setRenameFolderName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedFileRef = useRef<File | null>(null);

  // Close 3-dots folder dropdown menu on outside click
  useEffect(() => {
    const handleOutsideClick = () => setActiveMenuFolderId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Load real folders from Supabase documents table. The first load shows the
  // skeleton; live refreshes (shared files, uploads elsewhere) update silently.
  const docsLoadedRef = useRef(false);
  const loadDocuments = React.useCallback(() => {
    if (!docsLoadedRef.current) setLoadingDocs(true);
    return fetchLive('documents', { role })
      .then((dbFolders) => {
        if (Array.isArray(dbFolders) && dbFolders.length > 0) {
          // Merge user custom/consultation folders with fallback cases, avoiding duplicate names
          const existingNames = new Set(dbFolders.map((f) => f.name.toLowerCase().trim()));
          const unrepresentedDefaults = DEFAULT_CASE_FOLDERS.filter(
            (def) => !existingNames.has(def.name.toLowerCase().trim())
          );
          setFolders([...dbFolders, ...unrepresentedDefaults]);
        } else {
          setFolders(DEFAULT_CASE_FOLDERS);
        }
      })
      .catch((err) => {
        console.error('Failed to load documents:', err);
        // Only fall back to defaults when nothing has loaded yet.
        if (!docsLoadedRef.current) setFolders(DEFAULT_CASE_FOLDERS);
      })
      .finally(() => {
        docsLoadedRef.current = true;
        setLoadingDocs(false);
      });
  }, [role]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  useLiveRefresh(['documents'], loadDocuments, { fallbackMs: 60000 });

  // Active folder object
  const currentFolder = folders.find((f) => f.id === currentFolderId) || null;

  // Folder click handler: navigate into folder to see files
  const handleEnterFolder = (folder: FolderItem) => {
    setNavDirection('forward');
    setCurrentFolderId(folder.id);
  };

  const handleBackToRoot = () => {
    if (!currentFolderId && !currentSection) return;
    setNavDirection('back');
    setCurrentFolderId(null);
    if (!currentFolderId) setCurrentSection(null);
  };

  const navigateLawyerDocuments = (section: 'shared' | 'owned' | null, folderId: string | null = null) => {
    const next = depthOf(section, folderId);
    const current = depthOf(currentSection, currentFolderId);
    setNavDirection(next > current ? 'forward' : next < current ? 'back' : 'fade');
    setCurrentSection(section);
    setCurrentFolderId(folderId);
  };

  // Filtered folder and file lists based on search
  const filteredFolders = folders.filter((f) => {
    if (role === 'lawyer' && currentSection && (f.kind ?? 'shared') !== currentSection) {
      return false;
    }
    return f.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
  });

  const filteredFiles = currentFolder
    ? currentFolder.files.filter((file) =>
      file.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
    )
    : [];

  // Remounts the content region whenever the screen or view mode changes,
  // which replays the entrance + stagger animations. Search typing does not remount.
  const viewKey = `${role}|${currentSection ?? ''}|${currentFolderId ?? 'root'}|${viewMode}`;

  // Keyboard activation for card-like div buttons
  const onActivateKey = (action: () => void) => (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  };

  // ─── Server Action Handlers ──────────────────────────────────────────────────

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFolderName.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    setModalError(null);

    try {
      const res = await createDocumentFolderAction(trimmed);
      if (!('folder' in res) || !res.folder) {
        setModalError(('error' in res && res.error) || 'Failed to create case folder.');
        return;
      }

      const created: FolderItem = res.folder;
      setFolders((prev) => [created, ...prev]);
      setNewFolderName('');
      setShowNewFolderModal(false);
    } catch (err: any) {
      setModalError(err?.message || 'Failed to create case folder.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLocalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    selectedFileRef.current = file;
    setNewFileName(file.name);

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') setNewFileType('pdf');
    else if (ext === 'doc' || ext === 'docx') setNewFileType('doc');
    else if (ext === 'xls' || ext === 'xlsx') setNewFileType('excel');
    else if (ext === 'csv') setNewFileType('csv');
    else if (ext === 'png') setNewFileType('png');
    else if (ext === 'jpg' || ext === 'jpeg') setNewFileType('jpg');
    else if (ext === 'txt') setNewFileType('txt');
    else if (ext === 'mp4') setNewFileType('mp4');
  };

  const handleUploadFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim() || isSubmitting) return;

    const file = selectedFileRef.current;
    if (!file) {
      setModalError('Please choose a file from your device to upload.');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    const currentFolderItem = folders.find((f) => f.id === currentFolderId);
    const targetFolderId =
      currentFolderItem && currentFolderItem.kind === 'owned' && currentFolderItem.id !== 'uploaded-records'
        ? currentFolderItem.id
        : null;

    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('displayName', newFileName.trim());
      if (targetFolderId) fd.append('folderId', targetFolderId);

      const res = await uploadDocumentFileAction(fd);
      if (!('file' in res) || !res.file) {
        setModalError(('error' in res && res.error) || 'Failed to upload document.');
        return;
      }
      const newFile: DocumentItem = res.file;

      setFolders((prev) => {
        const destId = targetFolderId ?? (currentFolderId || 'uploaded-records');
        return prev.map((f) => (f.id === destId ? { ...f, files: [newFile, ...f.files] } : f));
      });

      selectedFileRef.current = null;
      setNewFileName('');
      setShowUploadFileModal(false);
    } catch (err: any) {
      setModalError(err?.message || 'Failed to upload document.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRenameFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showRenameFolderModal || !renameFolderName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setModalError(null);

    try {
      const res = await renameDocumentFolderAction(showRenameFolderModal.id, renameFolderName.trim());
      if ('error' in res && res.error) {
        setModalError(res.error);
        return;
      }

      setFolders((prev) =>
        prev.map((f) => (f.id === showRenameFolderModal.id ? { ...f, name: renameFolderName.trim() } : f))
      );
      setShowRenameFolderModal(null);
      setRenameFolderName('');
    } catch (err: any) {
      setModalError(err?.message || 'Failed to rename folder.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (deleteTarget.type === 'file') {
        await deleteDocumentFileAction(deleteTarget.id);
        setFolders((prev) =>
          prev.map((f) => ({
            ...f,
            files: f.files.filter((file) => file.id !== deleteTarget.id),
          }))
        );
        if (previewDocument?.id === deleteTarget.id) {
          setPreviewDocument(null);
        }
      } else {
        await deleteDocumentFolderAction(deleteTarget.id);
        setFolders((prev) => prev.filter((f) => f.id !== deleteTarget.id));
        if (currentFolderId === deleteTarget.id) {
          setNavDirection('back');
          setCurrentFolderId(null);
        }
      }
      setDeleteTarget(null);
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadFile = async (doc: DocumentItem) => {
    try {
      const res = await getDocumentAccessUrlAction(doc.id);
      if ('url' in res && res.url) {
        window.open(res.url, '_blank');
      } else {
        // Fallback simulation for client demonstration
        const mockBlob = new Blob([`Justicia Verified Legal Record: ${doc.name}\nSize: ${doc.size}\nProtected under Rule 130`], {
          type: 'text/plain',
        });
        const url = URL.createObjectURL(mockBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch {
      alert(`Downloading ${doc.name}...`);
    }
  };

  // Shared class strings
  const cardFocus =
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B9833C]/40';
  const gridClasses =
    'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-4 sm:gap-x-6 sm:gap-y-5 items-start';
  const addButtonClasses =
    'group neu-raised-sm size-20 sm:size-[5.5rem] rounded-full bg-[#E5D8CB] flex items-center justify-center text-[#9A8270] hover:text-[#34150F] transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer focus:outline-none select-none';

  // ─── Render View ─────────────────────────────────────────────────────────────

  return (
    <div className="docs-root px-5 sm:px-8 lg:px-10 xl:px-14 py-5 sm:py-7 max-w-[1440px] mx-auto bg-[#E5D8CB] min-h-[calc(100vh-4rem)] space-y-6 sm:space-y-7 select-none">
      <style>{DOCS_MOTION_CSS}</style>

      {/* ─── Top Toolbar (Reusing Design System Classes .neu-raised-sm & .neu-recessed) ── */}
      <div className="docs-toolbar flex flex-wrap items-center gap-3 sm:gap-4">
        {/* Left: + New Button (Neumorphic Raised Button) */}
        <button
          type="button"
          onClick={() => {
            setModalError(null);
            if (currentFolder) {
              selectedFileRef.current = null;
              setNewFileName('');
              setShowUploadFileModal(true);
            } else {
              setNewFolderName('');
              setShowNewFolderModal(true);
            }
          }}
          className="group neu-raised-sm shrink-0 h-11 px-6 rounded-[13px] bg-[#E5D8CB] text-[#34150F] font-lora font-semibold text-sm flex items-center gap-2.5 select-none cursor-pointer transition-all duration-300 hover:text-[#C58B3C] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus:outline-none"
          title={currentFolder ? 'Upload new document' : 'Create new case folder'}
        >
          <span className="text-xl font-normal leading-none -mt-0.5 transition-transform duration-500 group-hover:rotate-90">
            +
          </span>
          <span>New</span>
        </button>

        {/* Navigator / Breadcrumb (Neumorphic Recessed Container) — Inter, Regular 400 */}
        <nav
          aria-label="Breadcrumb"
          className="neu-recessed bg-[#E5D8CB] h-11 px-5 rounded-[13px] flex items-center gap-3 font-inter font-normal text-sm flex-1 min-w-[200px] max-w-xl overflow-hidden transition-all"
        >
          <button
            type="button"
            onClick={role === 'lawyer' ? () => navigateLawyerDocuments(null) : handleBackToRoot}
            className={`font-inter font-normal shrink-0 transition-colors duration-300 cursor-pointer ${currentFolder ? 'text-[#5C4535] hover:text-[#34150F]' : 'text-[#34150F]'
              }`}
          >
            {role === 'lawyer' ? 'Client Documents' : 'My Documents'}
          </button>

          {role === 'lawyer' && currentSection && (
            <>
              <span className="docs-crumb-in text-[#8C6020] select-none">›</span>
              <button
                type="button"
                onClick={() => navigateLawyerDocuments(currentSection)}
                className="docs-crumb-in font-inter font-normal shrink-0 text-[#34150F] hover:text-[#C58B3C] transition-colors duration-300 cursor-pointer"
              >
                {currentSection === 'shared' ? 'Shared With You' : 'Your Documents'}
              </button>
            </>
          )}

          {/* Active Folder Segment (Caramel Gold text matching image) */}
          {currentFolder && (
            <>
              <span className="docs-crumb-in text-[#8C6020] select-none">›</span>
              <span
                className="docs-crumb-in font-inter font-normal truncate text-[#C58B3C]"
                title={currentFolder.name}
              >
                {currentFolder.name}
              </span>
            </>
          )}
        </nav>

        {/* Right Section: View Switcher & Search Bar */}
        <div className="flex items-center gap-3 sm:gap-4 w-full lg:w-auto lg:ml-auto">
          {/* View Mode Switcher (.neu-recessed container with .neu-raised-sm active toggle) */}
          <div className="neu-recessed bg-[#E5D8CB] h-11 px-1.5 rounded-[13px] flex items-center gap-1.5 shrink-0">
            {/* List View Icon */}
            <button
              type="button"
              onClick={() => {
                setNavDirection('fade');
                setViewMode('list');
              }}
              className={`p-2.5 rounded-[10px] transition-all duration-300 cursor-pointer ${viewMode === 'list'
                  ? 'neu-raised-sm bg-[#E5D8CB] text-[#34150F]'
                  : 'text-[#8C7A6A] hover:text-[#34150F]'
                }`}
              title="List view"
              aria-label="List view"
              aria-pressed={viewMode === 'list'}
            >
              <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <line x1="8" y1="6" x2="21" y2="6" strokeLinecap="round" />
                <line x1="8" y1="12" x2="21" y2="12" strokeLinecap="round" />
                <line x1="8" y1="18" x2="21" y2="18" strokeLinecap="round" />
                <circle cx="4" cy="6" r="1.5" fill="currentColor" />
                <circle cx="4" cy="12" r="1.5" fill="currentColor" />
                <circle cx="4" cy="18" r="1.5" fill="currentColor" />
              </svg>
            </button>

            {/* Grid View Icon */}
            <button
              type="button"
              onClick={() => {
                setNavDirection('fade');
                setViewMode('grid');
              }}
              className={`p-2.5 rounded-[10px] transition-all duration-300 cursor-pointer ${viewMode === 'grid'
                  ? 'neu-raised-sm bg-[#E5D8CB] text-[#34150F]'
                  : 'text-[#8C7A6A] hover:text-[#34150F]'
                }`}
              title="Grid view"
              aria-label="Grid view"
              aria-pressed={viewMode === 'grid'}
            >
              <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect width="6.5" height="15" x="4" y="4.5" rx="1.5" />
                <rect width="6.5" height="15" x="13.5" y="4.5" rx="1.5" />
              </svg>
            </button>
          </div>

          {/* Search Input (.neu-recessed container matching DashboardSearchInput) */}
          <div className="neu-recessed bg-[#E5D8CB] h-11 px-4.5 rounded-[13px] flex-1 lg:flex-none lg:w-64 flex items-center relative transition-all focus-within:ring-2 focus-within:ring-[#B9833C]/40">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search"
              className="w-full bg-transparent font-lora text-sm text-[#34150F] placeholder-[#9A8270]/70 focus:outline-none pr-7 font-normal"
            />
            <svg
              className="w-[18px] h-[18px] text-[#5C4535] absolute right-4 shrink-0 select-none pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>

      {/* ─── Initial load skeleton, then directional content transitions ─── */}
      {loadingDocs && !currentFolder ? (
        <div className={gridClasses} aria-busy="true">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="docs-rise flex flex-col items-center justify-center p-3 space-y-3"
              style={stagger(i, 60, 10)}
            >
              <div
                className="w-full max-w-[8.5rem] sm:max-w-[9.5rem] aspect-[16/13] rounded-2xl neu-skeleton"
                style={{
                  boxShadow: '4px 4px 10px rgba(182, 155, 130, 0.25), -4px -4px 10px #FFFFFF',
                }}
              />
              <div className="h-3.5 w-28 rounded neu-skeleton-text" />
            </div>
          ))}
        </div>
      ) : (
        <div key={viewKey} className={`docs-view--${navDirection}`}>
          {/* ─── SCENARIO A: Root Folder Grid View (All Closed by Default) ────────── */}
          {!currentFolder && (
            <div className="space-y-6">
              {viewMode === 'grid' ? (
                <div className={gridClasses}>
                  {filteredFolders.map((folder, index) => {
                    const menuOpen = activeMenuFolderId === folder.id;
                    const count = folder.files.length;

                    return (
                      <div
                        key={folder.id}
                        className="docs-rise relative hover:z-10 focus-within:z-10 has-[.docs-menu]:z-30"
                        style={stagger(index)}
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label={`Open ${folder.name}`}
                          onClick={() => handleEnterFolder(folder)}
                          onKeyDown={onActivateKey(() => handleEnterFolder(folder))}
                          onPointerMove={onTiltMove}
                          onPointerLeave={onTiltLeave}
                          className={`docs-card group relative flex flex-col items-center justify-start cursor-pointer px-3 pt-4 pb-3 rounded-3xl hover:bg-[#DECEB8]/30 transition-colors duration-300 select-none ${menuOpen ? 'docs-card--active bg-[#DECEB8]/30' : ''} ${cardFocus}`}
                        >
                          {/* Folder options (kebab trigger + popover menu) */}
                          <FolderMenu
                            open={menuOpen}
                            folderName={folder.name}
                            count={count}
                            onToggle={() => setActiveMenuFolderId(menuOpen ? null : folder.id)}
                            onClose={() => setActiveMenuFolderId(null)}
                            onOpenFolder={() => handleEnterFolder(folder)}
                            onRename={() => {
                              setModalError(null);
                              setRenameFolderName(folder.name);
                              setShowRenameFolderModal(folder);
                            }}
                            onDelete={() => setDeleteTarget({ type: 'folder', id: folder.id, name: folder.name })}
                          />

                          {/* Layered folder: flap swings open and papers fan out on hover */}
                          <FolderArt
                            count={count}
                            enter
                            className="w-full max-w-[8.5rem] sm:max-w-[9.5rem]"
                          />

                          {/* Folder name + document count */}
                          <span className="docs-label font-lora text-sm sm:text-[15px] text-[#34150F] text-center mt-3 font-medium leading-snug max-w-[190px] line-clamp-2 group-hover:text-[#C58B3C]">
                            {folder.name}
                          </span>
                          <span className="font-inter text-[11px] sm:text-xs text-[#7D6855] mt-0.5">
                            {count} {count === 1 ? 'document' : 'documents'}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Empty state when search yields no matches */}
                  {filteredFolders.length === 0 && !loadingDocs && (
                    <div className="docs-rise col-span-full py-16 text-center space-y-2">
                      <Image src="/assets/folder_icon.svg" alt="" width={72} height={58} className="mx-auto opacity-60" />
                      <p className="font-lora text-base font-semibold text-[#34150F]">No case folders match your search</p>
                      <p className="font-inter text-xs text-[#7D6855]">
                        Try searching with different terms or click + to create a new folder.
                      </p>
                    </div>
                  )}

                  {/* Circular Neumorphic + Button (Uses Established .neu-raised-sm) */}
                  <div
                    className="docs-rise flex flex-col items-center justify-start px-3 pt-8 pb-3"
                    style={stagger(filteredFolders.length)}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setModalError(null);
                        setNewFolderName('');
                        setShowNewFolderModal(true);
                      }}
                      className={addButtonClasses}
                      title="Create new case folder"
                      aria-label="Create new case folder"
                    >
                      <span className="leading-none mb-1 text-5xl font-extralight select-none text-[#9A8270] transition-transform duration-500 ease-out group-hover:rotate-90 group-hover:text-[#34150F]">
                        +
                      </span>
                    </button>
                    <span className="font-lora text-sm sm:text-[15px] text-[#9A8270] text-center mt-3 font-medium">
                      New Folder
                    </span>
                  </div>
                </div>
              ) : (
                /* List View of Folders */
                <div className="neu-raised bg-[#E5D8CB] rounded-[22px] p-4 sm:p-6 space-y-2">
                  {filteredFolders.map((folder, index) => {
                    const count = folder.files.length;
                    return (
                      <div
                        key={folder.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleEnterFolder(folder)}
                        onKeyDown={onActivateKey(() => handleEnterFolder(folder))}
                        style={stagger(index, 40, 14)}
                        className={`docs-card docs-rise flex items-center justify-between p-4 rounded-xl hover:bg-[#DECEB8]/50 cursor-pointer transition-colors duration-300 ${cardFocus}`}
                      >
                        <div className="docs-row-body flex items-center gap-4">
                          <FolderArt count={count} size="sm" className="w-11 shrink-0" />
                          <span className="font-lora text-[15px] font-medium text-[#34150F]">
                            {folder.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-inter text-[#7D6855]">
                          <span>
                            {count} {count === 1 ? 'document' : 'documents'}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setModalError(null);
                              setRenameFolderName(folder.name);
                              setShowRenameFolderModal(folder);
                            }}
                            className="hover:text-[#34150F] p-1 font-medium transition-colors duration-200"
                          >
                            Rename
                          </button>
                          <span className="docs-row-arrow text-[#C58B3C] text-base leading-none" aria-hidden="true">
                            ›
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {filteredFolders.length === 0 && !loadingDocs && (
                    <p className="docs-rise py-10 text-center font-inter text-xs text-[#7D6855]">
                      No case folders match your search.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ─── SCENARIO B: Inside a Folder View ─────────────────────────────── */}
          {currentFolder && (
            <div className="space-y-6">
              {/* Back to Case Vault Banner */}
              <div className="docs-rise flex items-center justify-between pb-3 border-b border-[#D8C6B0]/60">
                <button
                  type="button"
                  onClick={handleBackToRoot}
                  className="docs-back flex items-center gap-2 font-inter text-sm font-medium text-[#5C4535] hover:text-[#34150F] transition-colors duration-300 cursor-pointer"
                >
                  <span className="docs-back-arrow">‹</span>
                  <span>Back to All Case Folders</span>
                </button>
                <div className="text-xs sm:text-[13px] font-inter text-[#7A604D]">
                  {filteredFiles.length} file{filteredFiles.length === 1 ? '' : 's'} in {currentFolder.name}
                </div>
              </div>

              {viewMode === 'grid' ? (
                <div className={gridClasses}>
                  {filteredFiles.map((file, index) => (
                    <div key={file.id} className="docs-deal relative" style={stagger(index, 60)}>
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label={`View details for ${file.name}`}
                        onClick={() => setPreviewDocument(file)}
                        onKeyDown={onActivateKey(() => setPreviewDocument(file))}
                        onPointerMove={onTiltMove}
                        onPointerLeave={onTiltLeave}
                        className={`docs-card group flex flex-col items-center justify-start cursor-pointer px-3 pt-4 pb-3 rounded-3xl hover:bg-[#DECEB8]/30 transition-colors duration-300 select-none ${cardFocus}`}
                      >
                        {/* Document Type Icon Graphic */}
                        <div className="docs-doc-art relative w-full max-w-[5.75rem] sm:max-w-[6.5rem] aspect-[10/13]">
                          <Image
                            src={getDocIconPath(file.type)}
                            alt={file.name}
                            width={120}
                            height={140}
                            className="w-full h-full object-contain drop-shadow-sm"
                            priority
                          />
                        </div>

                        {/* Document Filename */}
                        <span
                          title={file.name}
                          className="docs-label font-lora text-[13px] sm:text-sm text-[#34150F] text-center mt-3 font-medium leading-snug max-w-[180px] line-clamp-2 break-words group-hover:text-[#C58B3C]"
                        >
                          {file.name}
                        </span>
                        <span className="font-inter text-[11px] text-[#8C7A6A] mt-1">
                          {file.size}
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Empty state when folder has no files */}
                  {filteredFiles.length === 0 && (
                    <div className="docs-rise col-span-full sm:col-span-3 py-12 text-center space-y-2">
                      <p className="font-lora text-base font-semibold text-[#34150F]">No documents in this case folder yet</p>
                      <p className="font-inter text-xs text-[#7D6855] max-w-sm mx-auto">
                        Click the + button or &quot;+ New&quot; on the top left to upload legal affidavits, contracts, and filings.
                      </p>
                    </div>
                  )}

                  {/* Circular Neumorphic + Button to Upload Document */}
                  <div
                    className="docs-rise flex flex-col items-center justify-start px-3 pt-8 pb-3"
                    style={stagger(filteredFiles.length)}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setModalError(null);
                        selectedFileRef.current = null;
                        setNewFileName('');
                        setShowUploadFileModal(true);
                      }}
                      className={addButtonClasses}
                      title="Upload document"
                      aria-label="Upload document"
                    >
                      <span className="leading-none mb-1 text-5xl font-extralight select-none text-[#9A8270] transition-transform duration-500 ease-out group-hover:rotate-90 group-hover:text-[#34150F]">
                        +
                      </span>
                    </button>
                    <span className="font-lora text-sm sm:text-[15px] text-[#9A8270] text-center mt-3 font-medium">
                      Upload Document
                    </span>
                  </div>
                </div>
              ) : (
                /* List View of Documents */
                <div className="neu-raised bg-[#E5D8CB] rounded-[22px] p-4 sm:p-6 space-y-2">
                  {filteredFiles.map((file, index) => (
                    <div
                      key={file.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setPreviewDocument(file)}
                      onKeyDown={onActivateKey(() => setPreviewDocument(file))}
                      style={stagger(index, 40, 14)}
                      className={`docs-card docs-rise flex items-center justify-between gap-4 p-4 rounded-xl hover:bg-[#DECEB8]/50 cursor-pointer transition-colors duration-300 ${cardFocus}`}
                    >
                      <div className="docs-row-body flex items-center gap-4 min-w-0">
                        <Image
                          src={getDocIconPath(file.type)}
                          alt={file.name}
                          width={28}
                          height={32}
                          className="docs-row-icon object-contain shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-lora text-[15px] font-medium text-[#34150F] truncate">{file.name}</p>
                          <p className="font-inter text-xs text-[#8C7A6A] mt-0.5">{file.size} • {file.updatedAt}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadFile(file);
                          }}
                          className="font-inter text-xs text-[#C58B3C] hover:text-[#8C6020] hover:underline p-1 font-semibold transition-colors duration-200"
                        >
                          Download
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget({ type: 'file', id: file.id, name: file.name });
                          }}
                          className="font-inter text-xs text-red-600 hover:text-red-700 hover:underline p-1 transition-colors duration-200"
                        >
                          Delete
                        </button>
                        <span className="docs-row-arrow text-[#C58B3C] text-base leading-none" aria-hidden="true">
                          ›
                        </span>
                      </div>
                    </div>
                  ))}

                  {filteredFiles.length === 0 && (
                    <p className="docs-rise py-10 text-center font-inter text-xs text-[#7D6855]">
                      No documents to show in this case folder.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────
          VIEWPORT-LEVEL MODALS SECTION (Rendered via React Portal into document.body)
          - Docks to entire browser viewport: centered regardless of page scroll or transforms
          - Exact Sign In Modal implementation: .neu-modal + outline-[#D39758]
          - Reuses .neu-input and .neu-btn-create from existing design system
         ───────────────────────────────────────────────────────────────────────── */}

      {/* ─── MODAL 1: Create New Case Folder ─────────────────────────────────── */}
      <ViewportModal
        isOpen={showNewFolderModal}
        onClose={() => setShowNewFolderModal(false)}
        ariaLabel="Create Case Folder"
      >
        {/* Close button */}
        <button
          type="button"
          onClick={() => setShowNewFolderModal(false)}
          className="absolute top-5 right-5 w-9 h-9 rounded-full flex items-center justify-center text-[#5A4537] hover:text-[#34150F] hover:bg-[#D4C1AB]/40 hover:rotate-90 transition-[color,background-color,rotate] duration-300 focus:outline-none cursor-pointer"
          aria-label="Close dialog"
        >
          ✕
        </button>

        <div className="text-center mb-7">
          <Image
            src="/assets/folder_icon.svg"
            alt=""
            aria-hidden="true"
            width={150}
            height={120}
            className="docs-pop mx-auto w-16 h-auto mb-3 drop-shadow-sm"
          />
          <h2 className="font-lora text-2xl sm:text-3xl font-normal text-[#34150F] leading-none select-none">
            Create Case Folder
          </h2>
          <p className="font-inter text-xs text-[#7A604D] mt-2.5">
            Keep every filing and affidavit for a case in one place.
          </p>
        </div>

        {modalError && (
          <div className="mb-5 px-3.5 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-inter">
            {modalError}
          </div>
        )}

        <form onSubmit={handleCreateFolder} className="space-y-5">
          <div>
            <label className="block font-lora text-[13px] sm:text-sm font-medium text-[#5A4537] mb-2 pl-0.5 select-none">
              Folder Name:
            </label>
            <input
              type="text"
              required
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="e.g., Intellectual Property Dispute"
              className="neu-input font-lora w-full h-11 sm:h-12 rounded-[11px] px-4.5 text-sm text-[#34150F] placeholder-[#9A8270]/70 transition-all duration-200 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-lora text-[13px] sm:text-sm font-medium text-[#5A4537] mb-2 pl-0.5 select-none">
              Practice Area:
            </label>
            <select
              value={folderCategory}
              onChange={(e) => setFolderCategory(e.target.value)}
              className="neu-input font-lora w-full h-11 sm:h-12 rounded-[11px] px-4 text-sm text-[#34150F] focus:outline-none cursor-pointer"
            >
              <option value="Family Law">Family Law &amp; Divorce</option>
              <option value="Real Estate">Real Estate &amp; Land Ownership</option>
              <option value="Criminal Defense">Criminal Defense</option>
              <option value="Corporate Law">Corporate &amp; Business Legal</option>
              <option value="Civil Litigation">Civil Litigation &amp; Defamation</option>
              <option value="Labor & Employment">Labor &amp; Employment</option>
              <option value="Cyber & IP">Cyber Law &amp; Intellectual Property</option>
            </select>
          </div>

          {/* Submit Button (.neu-btn-create matching SignInForm) */}
          <div className="pt-3 flex flex-col items-center">
            <button
              type="submit"
              disabled={isSubmitting}
              className="neu-btn-create w-[240px] sm:w-[260px] text-xs sm:text-sm font-semibold tracking-[0.16em] uppercase py-3 sm:py-3.5 px-6 rounded-[14px] active:translate-y-0.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9833C]/60"
            >
              {isSubmitting ? 'CREATING...' : 'CREATE FOLDER'}
            </button>

            <button
              type="button"
              onClick={() => setShowNewFolderModal(false)}
              className="mt-4 text-xs font-inter text-[#7A604D] hover:text-[#99431E] hover:underline transition-colors duration-200 cursor-pointer select-none"
            >
              Cancel
            </button>
          </div>
        </form>
      </ViewportModal>

      {/* ─── MODAL 2: Upload Legal Document ──────────────────────────────────── */}
      <ViewportModal
        isOpen={showUploadFileModal}
        onClose={() => setShowUploadFileModal(false)}
        maxWidth="max-w-[500px] sm:max-w-[540px]"
        ariaLabel="Upload Document"
      >
        <button
          type="button"
          onClick={() => setShowUploadFileModal(false)}
          className="absolute top-5 right-5 w-9 h-9 rounded-full flex items-center justify-center text-[#5A4537] hover:text-[#34150F] hover:bg-[#D4C1AB]/40 hover:rotate-90 transition-[color,background-color,rotate] duration-300 focus:outline-none cursor-pointer"
          aria-label="Close dialog"
        >
          ✕
        </button>

        <div className="text-center mb-6">
          <h2 className="font-lora text-2xl sm:text-3xl font-normal text-[#34150F] leading-none select-none">
            Upload Document
          </h2>
          <p className="font-inter text-xs text-[#7A604D] mt-2.5">
            Destination: <span className="font-semibold text-[#34150F]">{currentFolder?.name || 'Vault Root'}</span>
          </p>
        </div>

        {modalError && (
          <div className="mb-5 px-3.5 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-inter">
            {modalError}
          </div>
        )}

        <form onSubmit={handleUploadFile} className="space-y-5">
          {/* Device File Picker with Neumorphic Inset Plate */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="group neu-input rounded-[14px] p-6 cursor-pointer text-center space-y-2.5 hover:brightness-98 transition-all duration-300"
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleLocalFileSelect}
            />
            <svg
              className="w-9 h-9 text-[#5C4535] mx-auto select-none transition-transform duration-500 group-hover:-translate-y-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
              />
            </svg>
            <p className="font-lora text-sm font-semibold text-[#34150F] break-words">
              {selectedFileRef.current
                ? `Selected: ${selectedFileRef.current.name}`
                : 'Click to select file from device'}
            </p>
            <p className="font-inter text-[11px] text-[#7D6855]">
              PDF, DOCX, XLSX, CSV, PNG, JPG, or Text (up to 8MB)
            </p>
          </div>

          <div>
            <label className="block font-lora text-[13px] sm:text-sm font-medium text-[#5A4537] mb-2 pl-0.5 select-none">
              Document Display Name:
            </label>
            <input
              type="text"
              required
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="e.g., Witness Statement"
              className="neu-input font-lora w-full h-11 sm:h-12 rounded-[11px] px-4.5 text-sm text-[#34150F] placeholder-[#9A8270]/70 transition-all duration-200 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-lora text-[13px] sm:text-sm font-medium text-[#5A4537] mb-2 pl-0.5 select-none">
              Document Classification:
            </label>
            <select
              value={newFileType}
              onChange={(e) => setNewFileType(e.target.value as DocumentItem['type'])}
              className="neu-input font-lora w-full h-11 sm:h-12 rounded-[11px] px-4 text-sm text-[#34150F] focus:outline-none cursor-pointer"
            >
              <option value="pdf">PDF Document (.pdf)</option>
              <option value="doc">Word Document (.docx)</option>
              <option value="excel">Excel Spreadsheet (.xlsx)</option>
              <option value="csv">CSV Data (.csv)</option>
              <option value="png">PNG Image (.png)</option>
              <option value="jpg">JPEG Image (.jpg)</option>
              <option value="txt">Text File (.txt)</option>
              <option value="mp4">Video/Audio File (.mp4)</option>
            </select>
          </div>

          {/* Submit Button */}
          <div className="pt-3 flex flex-col items-center">
            <button
              type="submit"
              disabled={isSubmitting}
              className="neu-btn-create w-[240px] sm:w-[260px] text-xs sm:text-sm font-semibold tracking-[0.16em] uppercase py-3 sm:py-3.5 px-6 rounded-[14px] active:translate-y-0.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9833C]/60"
            >
              {isSubmitting ? 'UPLOADING...' : 'UPLOAD FILE'}
            </button>

            <button
              type="button"
              onClick={() => setShowUploadFileModal(false)}
              className="mt-4 text-xs font-inter text-[#7A604D] hover:text-[#99431E] hover:underline transition-colors duration-200 cursor-pointer select-none"
            >
              Cancel
            </button>
          </div>
        </form>
      </ViewportModal>

      {/* ─── MODAL 3: Document Details / Preview Modal ───────────────────────── */}
      <ViewportModal
        isOpen={Boolean(previewDocument)}
        onClose={() => setPreviewDocument(null)}
        maxWidth="max-w-[520px] sm:max-w-[580px]"
        ariaLabel="Document Details"
      >
        {previewDocument && (
          <>
            <button
              type="button"
              onClick={() => setPreviewDocument(null)}
              className="absolute top-5 right-5 w-9 h-9 rounded-full flex items-center justify-center text-[#5A4537] hover:text-[#34150F] hover:bg-[#D4C1AB]/40 hover:rotate-90 transition-[color,background-color,rotate] duration-300 focus:outline-none cursor-pointer"
              aria-label="Close dialog"
            >
              ✕
            </button>

            <h2 className="font-lora text-2xl sm:text-3xl font-normal text-[#34150F] text-center leading-none mb-6 select-none">
              Document Details
            </h2>

            {/* Document Header Tile */}
            <div className="flex items-center gap-4 pb-5 border-b border-[#D8C6B0]/60">
              <Image
                src={getDocIconPath(previewDocument.type)}
                alt={previewDocument.name}
                width={48}
                height={56}
                className="docs-pop object-contain shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="font-lora text-base font-semibold text-[#34150F] truncate" title={previewDocument.name}>
                  {previewDocument.name}
                </p>
                <div className="flex items-center gap-2 mt-1.5 font-inter text-xs text-[#7A604D]">
                  <span className="bg-[#D4C1AB]/50 px-2.5 py-0.5 rounded-full">{previewDocument.size}</span>
                  <span>•</span>
                  <span>Updated {previewDocument.updatedAt}</span>
                </div>
              </div>
            </div>

            {/* Privileged Preview Viewer */}
            <div className="neu-input rounded-[14px] p-5 sm:p-6 my-6 space-y-3.5 bg-[#E5D8CB]">
              <div className="flex items-center justify-between gap-3">
                <span className="font-lora text-[13px] font-semibold text-[#34150F]">
                  Privileged Legal Document
                </span>
                <span className="font-inter text-[10px] text-[#C58B3C] font-semibold bg-[#C58B3C]/10 px-2.5 py-1 rounded-full whitespace-nowrap">
                  VERIFIED VAULT
                </span>
              </div>
              <div className="space-y-2.5 opacity-60">
                <div className="h-2.5 bg-[#C5B099] rounded w-5/6" />
                <div className="h-2.5 bg-[#C5B099] rounded w-full" />
                <div className="h-2.5 bg-[#C5B099] rounded w-3/4" />
              </div>
              <p className="font-inter text-[11px] text-[#7A604D] italic leading-snug pt-1">
                Confidential Attorney-Client Record • Protected under Rule 130 of the Revised Rules on Evidence.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col items-center space-y-4">
              <button
                type="button"
                onClick={() => handleDownloadFile(previewDocument)}
                className="neu-btn-create w-[240px] sm:w-[260px] text-xs sm:text-sm font-semibold tracking-[0.16em] uppercase py-3 sm:py-3.5 px-6 rounded-[14px] active:translate-y-0.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9833C]/60"
              >
                DOWNLOAD FILE
              </button>

              <div className="flex items-center gap-8">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteTarget({ type: 'file', id: previewDocument.id, name: previewDocument.name });
                  }}
                  className="text-xs font-inter text-red-600 hover:text-red-700 hover:underline transition-colors duration-200 cursor-pointer"
                >
                  Delete Document
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDocument(null)}
                  className="text-xs font-inter text-[#7A604D] hover:text-[#34150F] hover:underline transition-colors duration-200 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </>
        )}
      </ViewportModal>

      {/* ─── MODAL 4: Rename Folder Modal ───────────────────────────────────── */}
      <ViewportModal
        isOpen={Boolean(showRenameFolderModal)}
        onClose={() => setShowRenameFolderModal(null)}
        ariaLabel="Rename Folder"
      >
        <button
          type="button"
          onClick={() => setShowRenameFolderModal(null)}
          className="absolute top-5 right-5 w-9 h-9 rounded-full flex items-center justify-center text-[#5A4537] hover:text-[#34150F] hover:bg-[#D4C1AB]/40 hover:rotate-90 transition-[color,background-color,rotate] duration-300 focus:outline-none cursor-pointer"
          aria-label="Close dialog"
        >
          ✕
        </button>

        <div className="text-center mb-7">
          <Image
            src="/assets/folder_icon.svg"
            alt=""
            aria-hidden="true"
            width={150}
            height={120}
            className="docs-pop mx-auto w-16 h-auto mb-3 drop-shadow-sm"
          />
          <h2 className="font-lora text-2xl sm:text-3xl font-normal text-[#34150F] leading-none select-none">
            Rename Folder
          </h2>
        </div>

        {modalError && (
          <div className="mb-5 px-3.5 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-inter">
            {modalError}
          </div>
        )}

        <form onSubmit={handleRenameFolder} className="space-y-5">
          <div>
            <label className="block font-lora text-[13px] sm:text-sm font-medium text-[#5A4537] mb-2 pl-0.5 select-none">
              Folder Name:
            </label>
            <input
              type="text"
              required
              value={renameFolderName}
              onChange={(e) => setRenameFolderName(e.target.value)}
              className="neu-input font-lora w-full h-11 sm:h-12 rounded-[11px] px-4.5 text-sm text-[#34150F] focus:outline-none"
            />
          </div>

          <div className="pt-3 flex flex-col items-center">
            <button
              type="submit"
              disabled={isSubmitting}
              className="neu-btn-create w-[240px] sm:w-[260px] text-xs sm:text-sm font-semibold tracking-[0.16em] uppercase py-3 sm:py-3.5 px-6 rounded-[14px] active:translate-y-0.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9833C]/60"
            >
              {isSubmitting ? 'SAVING...' : 'SAVE CHANGES'}
            </button>

            <button
              type="button"
              onClick={() => setShowRenameFolderModal(null)}
              className="mt-4 text-xs font-inter text-[#7A604D] hover:text-[#99431E] hover:underline transition-colors duration-200 cursor-pointer select-none"
            >
              Cancel
            </button>
          </div>
        </form>
      </ViewportModal>

      {/* ─── MODAL 5: Delete Confirmation Modal ─────────────────────────────── */}
      <ViewportModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        maxWidth="max-w-[440px] sm:max-w-[460px]"
        ariaLabel="Confirm Deletion"
      >
        {deleteTarget && (
          <>
            <h2 className="font-lora text-2xl sm:text-3xl font-normal text-[#34150F] text-center leading-none mb-4 select-none">
              Confirm Deletion
            </h2>
            <p className="font-inter text-[13px] text-[#5A4537] text-center leading-relaxed mb-7 break-words">
              Are you sure you want to remove &quot;{deleteTarget.name}&quot;? This {deleteTarget.type} will be
              deleted from your case documents vault.
            </p>

            <div className="flex flex-col items-center space-y-4">
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isSubmitting}
                className="neu-btn-create !bg-[#601A10] hover:!bg-[#4A140C] w-[230px] text-xs sm:text-sm font-semibold tracking-[0.16em] uppercase py-3 sm:py-3.5 px-6 rounded-[14px] cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'DELETING...' : 'CONFIRM DELETE'}
              </button>

              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="text-xs font-inter text-[#7A604D] hover:text-[#34150F] hover:underline transition-colors duration-200 cursor-pointer select-none"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </ViewportModal>
    </div>
  );
}

export default DocumentsView;