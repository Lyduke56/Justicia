'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
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

// Helper: staggered entrance delay (capped so long lists never feel slow)
const stagger = (index: number, step = 55, max = 12): React.CSSProperties => ({
  animationDelay: `${Math.min(index, max) * step}ms`,
});

// Helper: navigation depth, used to pick the slide direction
const depthOf = (section: 'shared' | 'owned' | null, folderId: string | null) =>
  (section ? 1 : 0) + (folderId ? 1 : 0);

// ─── Animation System ─────────────────────────────────────────────────────────
// Motion only: transforms, opacity and transitions. No box-shadow, background or
// surface values are touched, so every .neu-* class keeps its existing look.
// Entrance animations use `backwards` fill so they never override hover transforms.

const DOCS_MOTION_CSS = `
.docs-root, .docs-modal-layer {
  --docs-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --docs-ease-soft: cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes docs-rise {
  from { opacity: 0; transform: translateY(18px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes docs-fade-up {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes docs-slide-down {
  from { opacity: 0; transform: translateY(-10px); }
  to   { opacity: 1; transform: translateY(0); }
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
@keyframes docs-menu-in {
  from { opacity: 0; transform: translateY(-4px) scale(0.95); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes docs-pop {
  0%   { opacity: 0; transform: scale(0.6) rotate(-8deg); }
  60%  { opacity: 1; transform: scale(1.06) rotate(2deg); }
  100% { opacity: 1; transform: scale(1) rotate(0); }
}
@keyframes docs-backdrop-in  { from { opacity: 0; } to { opacity: 1; } }
@keyframes docs-backdrop-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes docs-modal-in {
  from { opacity: 0; transform: translateY(18px) scale(0.95); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes docs-modal-out {
  from { opacity: 1; transform: translateY(0) scale(1); }
  to   { opacity: 0; transform: translateY(10px) scale(0.97); }
}

/* Screen-level entrances */
.docs-toolbar      { animation: docs-slide-down 0.55s var(--docs-ease) backwards; }
.docs-view--forward { animation: docs-view-forward 0.5s var(--docs-ease) backwards; }
.docs-view--back    { animation: docs-view-back 0.5s var(--docs-ease) backwards; }
.docs-view--fade    { animation: docs-view-fade 0.4s var(--docs-ease) backwards; }
.docs-rise          { animation: docs-rise 0.6s var(--docs-ease) backwards; }
.docs-crumb-in      { animation: docs-crumb-in 0.4s var(--docs-ease) backwards; }
.docs-menu-in       { transform-origin: top right; animation: docs-menu-in 0.2s var(--docs-ease) backwards; }
.docs-pop           { animation: docs-pop 0.6s var(--docs-ease) 0.1s backwards; }

/* Folder: closed -> open is a layered cross-fade with a gentle lift */
.docs-folder-art {
  transform-origin: 50% 85%;
  transition: transform 0.55s var(--docs-ease);
  will-change: transform;
}
.docs-folder-closed {
  opacity: 1;
  transition: opacity 0.4s var(--docs-ease-soft);
}
.docs-folder-open {
  opacity: 0;
  transform: translateY(3px) scale(0.985);
  transition: opacity 0.4s var(--docs-ease-soft) 0.08s, transform 0.55s var(--docs-ease) 0.08s;
}
.docs-card:hover .docs-folder-art,
.docs-card:focus-visible .docs-folder-art {
  transform: translateY(-6px) scale(1.05);
}
.docs-card:hover .docs-folder-closed,
.docs-card:focus-visible .docs-folder-closed {
  opacity: 0;
  transition: opacity 0.4s var(--docs-ease-soft) 0.14s;
}
.docs-card:hover .docs-folder-open,
.docs-card:focus-visible .docs-folder-open {
  opacity: 1;
  transform: translateY(0) scale(1);
  transition: opacity 0.35s var(--docs-ease-soft), transform 0.55s var(--docs-ease);
}
.docs-card:active .docs-folder-art { transform: translateY(-2px) scale(0.99); transition-duration: 0.15s; }

/* Document icons: same easing family as folders */
.docs-doc-art {
  transform-origin: 50% 100%;
  transition: transform 0.5s var(--docs-ease);
  will-change: transform;
}
.docs-card:hover .docs-doc-art,
.docs-card:focus-visible .docs-doc-art {
  transform: translateY(-6px) scale(1.06) rotate(-1.5deg);
}
.docs-card:active .docs-doc-art { transform: translateY(-2px) scale(0.98); transition-duration: 0.15s; }

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

/* Folder kebab menu: stays visible on touch devices where hover is unavailable */
@media (hover: none) {
  .docs-menu-btn { opacity: 1 !important; transform: none !important; }
}

/* Back link nudge */
.docs-back-arrow { display: inline-block; transition: transform 0.35s var(--docs-ease); }
.docs-back:hover .docs-back-arrow { transform: translateX(-4px); }

/* Modals */
.docs-backdrop--in  { animation: docs-backdrop-in 0.25s ease backwards; }
.docs-backdrop--out { animation: docs-backdrop-out 0.2s ease forwards; }
.docs-modal-card--in  { animation: docs-modal-in 0.34s var(--docs-ease) backwards; }
.docs-modal-card--out { animation: docs-modal-out 0.2s var(--docs-ease-soft) forwards; }

.docs-modal-card--in > *,
.docs-modal-card--in form > * { animation: docs-fade-up 0.45s var(--docs-ease) backwards; }
.docs-modal-card--in > form { animation: none; }
.docs-modal-card--in > *:nth-child(2), .docs-modal-card--in form > *:nth-child(1) { animation-delay: 0.08s; }
.docs-modal-card--in > *:nth-child(3), .docs-modal-card--in form > *:nth-child(2) { animation-delay: 0.12s; }
.docs-modal-card--in > *:nth-child(4), .docs-modal-card--in form > *:nth-child(3) { animation-delay: 0.16s; }
.docs-modal-card--in > *:nth-child(5), .docs-modal-card--in form > *:nth-child(4) { animation-delay: 0.20s; }
.docs-modal-card--in > *:nth-child(n+6), .docs-modal-card--in form > *:nth-child(n+5) { animation-delay: 0.24s; }

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
  .docs-card:hover .docs-folder-art,
  .docs-card:focus-visible .docs-folder-art,
  .docs-card:hover .docs-doc-art,
  .docs-card:focus-visible .docs-doc-art,
  .docs-card:hover .docs-label,
  .docs-card:hover .docs-row-body,
  .docs-card:hover .docs-row-icon { transform: none !important; }
}
`;

// ─── Folder Art (closed by default, opens only on hover/focus) ───────────────
// Both illustrations are stacked and cross-faded by CSS, so the open/close
// transition is gradual in both directions. The trigger is the nearest `.docs-card`.

function FolderArt({
  name,
  className = '',
  priority = false,
}: {
  name: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div className={`docs-folder-art relative ${className}`}>
      <Image
        src="/assets/folder_icon.svg"
        alt={name}
        width={150}
        height={120}
        priority={priority}
        className="docs-folder-closed absolute inset-0 w-full h-full object-contain drop-shadow-sm"
      />
      <Image
        src="/assets/folder_hover.svg"
        alt=""
        aria-hidden="true"
        width={150}
        height={120}
        priority={priority}
        className="docs-folder-open absolute inset-0 w-full h-full object-contain drop-shadow-sm"
      />
    </div>
  );
}

// ─── Viewport Portal Modal Component ──────────────────────────────────────────
// Ensures the modal is rendered into document.body at the root of the viewport,
// completely unconstrained by parent scroll boundaries or CSS transforms.
// Stays mounted briefly after closing so the exit animation can play.

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

function ViewportModal({
  isOpen,
  onClose,
  children,
  maxWidth = 'max-w-[480px] sm:max-w-[520px]',
  ariaLabel = 'Modal dialog',
}: ViewportModalProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  // Keep the last open content so it stays on screen while the exit animation runs
  const lastChildrenRef = useRef<React.ReactNode>(children);
  if (isOpen) lastChildrenRef.current = children;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Keep mounted for the length of the exit animation
  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      return;
    }
    const t = setTimeout(() => setVisible(false), 220);
    return () => clearTimeout(t);
  }, [isOpen]);

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

  if (!mounted || (!isOpen && !visible)) return null;

  const closing = !isOpen;

  return createPortal(
    <div
      className="docs-modal-layer fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      {/* Full Viewport Backdrop matching SignInModal */}
      <div
        className={`fixed inset-0 bg-black/75 backdrop-blur-sm ${closing ? 'docs-backdrop--out' : 'docs-backdrop--in'
          }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container: exact .neu-modal outline-[#D39758] from Sign In Modal */}
      <div
        className={`neu-modal outline-[#D39758] relative w-full ${maxWidth} px-7 sm:px-11 pt-10 pb-9 sm:pt-11 sm:pb-10 z-10 max-h-[92vh] overflow-y-auto ${closing ? 'docs-modal-card--out pointer-events-none' : 'docs-modal-card--in'
          }`}
        onClick={(e) => e.stopPropagation()}
      >
        {isOpen ? children : lastChildrenRef.current}
      </div>
    </div>,
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
    'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-8 sm:gap-x-8 sm:gap-y-10 items-start pt-2';
  const addButtonClasses =
    'group neu-raised-sm size-24 sm:size-28 rounded-full bg-[#E5D8CB] flex items-center justify-center text-[#9A8270] hover:text-[#34150F] transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer focus:outline-none select-none';

  // ─── Render View ─────────────────────────────────────────────────────────────

  return (
    <div className="docs-root px-5 sm:px-10 lg:px-14 xl:px-20 py-6 sm:py-10 max-w-[1300px] mx-auto bg-[#E5D8CB] min-h-[calc(100vh-4rem)] space-y-8 sm:space-y-10 select-none">
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
          className="group neu-raised-sm shrink-0 h-12 px-7 rounded-[14px] bg-[#E5D8CB] text-[#34150F] font-lora font-semibold text-sm flex items-center gap-2.5 select-none cursor-pointer transition-all duration-300 hover:text-[#C58B3C] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus:outline-none"
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
          className="neu-recessed bg-[#E5D8CB] h-12 px-6 rounded-[14px] flex items-center gap-3 font-inter font-normal text-sm flex-1 min-w-[200px] max-w-xl overflow-hidden transition-all"
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
          <div className="neu-recessed bg-[#E5D8CB] h-12 px-1.5 rounded-[14px] flex items-center gap-1.5 shrink-0">
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
          <div className="neu-recessed bg-[#E5D8CB] h-12 px-4.5 rounded-[14px] flex-1 lg:flex-none lg:w-72 flex items-center relative transition-all focus-within:ring-2 focus-within:ring-[#B9833C]/40">
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
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="docs-rise flex flex-col items-center justify-center p-3 sm:p-4 space-y-3"
              style={stagger(i, 60, 8)}
            >
              <div
                className="w-full max-w-[14rem] aspect-[5/4] rounded-2xl neu-skeleton"
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
                        className="docs-rise relative hover:z-10 focus-within:z-10"
                        style={{ ...stagger(index), zIndex: menuOpen ? 30 : undefined }}
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label={`Open ${folder.name}`}
                          onClick={() => handleEnterFolder(folder)}
                          onKeyDown={onActivateKey(() => handleEnterFolder(folder))}
                          className={`docs-card group relative flex flex-col items-center justify-start cursor-pointer p-3 sm:p-4 rounded-3xl hover:bg-[#DECEB8]/30 transition-colors duration-300 select-none ${cardFocus}`}
                        >
                          {/* 3-Dots Context Menu Button */}
                          <div
                            className={`docs-menu-btn absolute top-2 right-3 z-20 transition-all duration-200 ${menuOpen
                                ? 'opacity-100 scale-100'
                                : 'opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 group-focus-within:opacity-100 group-focus-within:scale-100'
                              }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuFolderId(menuOpen ? null : folder.id);
                            }}
                          >
                            <button
                              type="button"
                              className="neu-raised-sm size-7 rounded-full bg-[#E5D8CB] flex items-center justify-center text-[#5A4537] hover:text-[#34150F] text-xs transition-colors duration-200"
                              title="Folder options"
                              aria-label={`Options for ${folder.name}`}
                            >
                              •••
                            </button>

                            {/* Dropdown Menu */}
                            {menuOpen && (
                              <div className="docs-menu-in neu-raised-sm absolute right-0 mt-1.5 w-48 rounded-xl bg-[#E5D8CB] border border-[#D8C6B0]/60 p-1.5 z-30 text-[13px] font-inter space-y-0.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEnterFolder(folder);
                                    setActiveMenuFolderId(null);
                                  }}
                                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#D4C1AB]/60 text-[#34150F] font-medium transition-colors duration-200"
                                >
                                  📂 Open Folder
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setModalError(null);
                                    setRenameFolderName(folder.name);
                                    setShowRenameFolderModal(folder);
                                    setActiveMenuFolderId(null);
                                  }}
                                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#D4C1AB]/60 text-[#34150F] font-medium transition-colors duration-200"
                                >
                                  ✏️ Rename Folder
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteTarget({ type: 'folder', id: folder.id, name: folder.name });
                                    setActiveMenuFolderId(null);
                                  }}
                                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-red-100 text-red-700 font-medium transition-colors duration-200"
                                >
                                  🗑️ Delete Folder
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Larger folder artwork: closed by default, opens gradually on hover */}
                          <FolderArt
                            name={folder.name}
                            priority
                            className="w-full max-w-[14rem] aspect-[5/4]"
                          />

                          {/* Folder name + document count */}
                          <span className="docs-label font-lora text-[15px] sm:text-base text-[#34150F] text-center mt-3 font-medium leading-snug max-w-[200px] group-hover:text-[#C58B3C]">
                            {folder.name}
                          </span>
                          <span className="font-inter text-xs text-[#7D6855] mt-1">
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
                    className="docs-rise flex flex-col items-center justify-start p-3 sm:p-4 pt-8 sm:pt-10"
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
                    <span className="font-lora text-[15px] sm:text-base text-[#9A8270] text-center mt-3 font-medium">
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
                          <FolderArt name={folder.name} className="w-11 h-9 shrink-0" />
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
                    <div key={file.id} className="docs-rise relative" style={stagger(index)}>
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label={`View details for ${file.name}`}
                        onClick={() => setPreviewDocument(file)}
                        onKeyDown={onActivateKey(() => setPreviewDocument(file))}
                        className={`docs-card group flex flex-col items-center justify-start cursor-pointer p-3 sm:p-4 rounded-3xl hover:bg-[#DECEB8]/30 transition-colors duration-300 select-none ${cardFocus}`}
                      >
                        {/* Document Type Icon Graphic */}
                        <div className="docs-doc-art relative w-full max-w-[9.5rem] sm:max-w-[10.5rem] aspect-[6/7]">
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
                          className="docs-label font-lora text-sm text-[#34150F] text-center mt-3 font-medium leading-snug max-w-[180px] line-clamp-2 break-words group-hover:text-[#C58B3C]"
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
                    className="docs-rise flex flex-col items-center justify-start p-3 sm:p-4 pt-8 sm:pt-10"
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
                    <span className="font-lora text-[15px] sm:text-base text-[#9A8270] text-center mt-3 font-medium">
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
          className="absolute top-5 right-5 w-9 h-9 rounded-full flex items-center justify-center text-[#5A4537] hover:text-[#34150F] hover:bg-[#D4C1AB]/40 transition-colors duration-200 focus:outline-none cursor-pointer"
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
          className="absolute top-5 right-5 w-9 h-9 rounded-full flex items-center justify-center text-[#5A4537] hover:text-[#34150F] hover:bg-[#D4C1AB]/40 transition-colors duration-200 focus:outline-none cursor-pointer"
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
              className="absolute top-5 right-5 w-9 h-9 rounded-full flex items-center justify-center text-[#5A4537] hover:text-[#34150F] hover:bg-[#D4C1AB]/40 transition-colors duration-200 focus:outline-none cursor-pointer"
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
          className="absolute top-5 right-5 w-9 h-9 rounded-full flex items-center justify-center text-[#5A4537] hover:text-[#34150F] hover:bg-[#D4C1AB]/40 transition-colors duration-200 focus:outline-none cursor-pointer"
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