'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

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
  isRecentlyCreated?: boolean;
  files: DocumentItem[];
}

interface DocumentsViewProps {
  role?: 'client' | 'lawyer';
}

const DEFAULT_FOLDERS: FolderItem[] = [
  {
    id: 'divorce-case',
    name: 'Divorce Case',
    isRecentlyCreated: false,
    files: [
      { id: 'f-1', name: 'Divorce Papers.pdf', size: '2.4 MB', type: 'pdf', updatedAt: 'Oct 14, 2026' },
      { id: 'f-2', name: 'Evidence.docx', size: '1.1 MB', type: 'doc', updatedAt: 'Oct 15, 2026' },
      { id: 'f-3', name: 'Legal Ownership.docx', size: '890 KB', type: 'doc', updatedAt: 'Oct 16, 2026' },
    ],
  },
  {
    id: 'land-ownership',
    name: 'Land Ownership Case',
    isRecentlyCreated: true, // Marked as recently created to demonstrate NEW badge
    files: [
      { id: 'f-4', name: 'Land Title Transfer.pdf', size: '3.8 MB', type: 'pdf', updatedAt: 'Oct 20, 2026' },
      { id: 'f-5', name: 'Survey Coordinates.xlsx', size: '512 KB', type: 'excel', updatedAt: 'Oct 21, 2026' },
    ],
  },
  {
    id: 'criminal-case',
    name: 'Criminal Case',
    isRecentlyCreated: false,
    files: [
      { id: 'f-6', name: 'Blotter Report.pdf', size: '1.7 MB', type: 'pdf', updatedAt: 'Sep 29, 2026' },
      { id: 'f-7', name: 'Incident Timeline.doc', size: '420 KB', type: 'doc', updatedAt: 'Oct 02, 2026' },
    ],
  },
  {
    id: 'business-legal',
    name: 'Business Legal Owners',
    isRecentlyCreated: false,
    files: [
      { id: 'f-8', name: 'SEC Articles of Incorporation.pdf', size: '4.2 MB', type: 'pdf', updatedAt: 'Sep 12, 2026' },
      { id: 'f-9', name: 'Shareholders Registry.csv', size: '150 KB', type: 'csv', updatedAt: 'Sep 15, 2026' },
      { id: 'f-10', name: 'Board Resolution 2026.pdf', size: '940 KB', type: 'pdf', updatedAt: 'Sep 18, 2026' },
    ],
  },
  {
    id: 'defamation-case',
    name: 'Defamation Case',
    isRecentlyCreated: false,
    files: [
      { id: 'f-11', name: 'Social Media Evidence.png', size: '3.1 MB', type: 'png', updatedAt: 'Oct 08, 2026' },
      { id: 'f-12', name: 'Cease and Desist Notice.pdf', size: '820 KB', type: 'pdf', updatedAt: 'Oct 10, 2026' },
    ],
  },
  {
    id: 'school-shooting',
    name: 'School Shooting Case',
    isRecentlyCreated: false,
    files: [
      { id: 'f-13', name: 'Witness Affidavit.pdf', size: '2.1 MB', type: 'pdf', updatedAt: 'Aug 24, 2026' },
    ],
  },
  {
    id: 'bullying-case',
    name: 'Bullying Case',
    isRecentlyCreated: false,
    files: [
      { id: 'f-14', name: 'Administrative Complaint.pdf', size: '1.3 MB', type: 'pdf', updatedAt: 'Sep 04, 2026' },
    ],
  },
  {
    id: 'fraud-case',
    name: 'Fraud Case',
    isRecentlyCreated: false,
    files: [
      { id: 'f-15', name: 'Bank Transaction Receipts.pdf', size: '5.6 MB', type: 'pdf', updatedAt: 'Oct 01, 2026' },
      { id: 'f-16', name: 'Audit Summary.xlsx', size: '940 KB', type: 'excel', updatedAt: 'Oct 03, 2026' },
    ],
  },
  {
    id: 'juvenile-employment',
    name: 'Juvenile Employment Case',
    isRecentlyCreated: true, // Marked as recently created to demonstrate NEW badge
    files: [
      { id: 'f-17', name: 'DOLE Special Permit.pdf', size: '890 KB', type: 'pdf', updatedAt: 'Oct 25, 2026' },
      { id: 'f-18', name: 'Apprenticeship Contract.docx', size: '750 KB', type: 'doc', updatedAt: 'Oct 26, 2026' },
    ],
  },
];

export function DocumentsView({ role = 'client' }: DocumentsViewProps) {
  const [folders, setFolders] = useState<FolderItem[]>(DEFAULT_FOLDERS);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [hoveredFolderId, setHoveredFolderId] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState<boolean>(false);

  // Independent interacted state per user role (client vs lawyer)
  const storageKey = `justicia_interacted_folders_${role}`;
  const [interactedFolderIds, setInteractedFolderIds] = useState<string[]>([]);

  // Modals
  const [showNewFolderModal, setShowNewFolderModal] = useState<boolean>(false);
  const [showUploadFileModal, setShowUploadFileModal] = useState<boolean>(false);
  const [previewDocument, setPreviewDocument] = useState<DocumentItem | null>(null);

  // Form inputs
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [newFileName, setNewFileName] = useState<string>('');
  const [newFileType, setNewFileType] = useState<DocumentItem['type']>('pdf');

  // Load interacted folder IDs from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setInteractedFolderIds(JSON.parse(stored));
      }
    } catch {
      // Ignore storage errors
    }
  }, [storageKey]);

  // Handle clicking on a folder:
  // 1. Shows sleek skeleton transition
  // 2. Marks it as interacted for this role (removes NEW badge permanently for this user)
  // 3. Opens the folder
  const handleFolderClick = (folder: FolderItem) => {
    setIsNavigating(true);
    if (!interactedFolderIds.includes(folder.id)) {
      const updated = [...interactedFolderIds, folder.id];
      setInteractedFolderIds(updated);
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {
        // Ignore storage errors
      }
    }
    setCurrentFolderId(folder.id);
    setTimeout(() => setIsNavigating(false), 240);
  };

  const handleBackToRoot = () => {
    if (!currentFolderId) return;
    setIsNavigating(true);
    setCurrentFolderId(null);
    setTimeout(() => setIsNavigating(false), 240);
  };

  const currentFolder = folders.find((f) => f.id === currentFolderId) || null;

  // Filtered lists
  const filteredFolders = folders.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFiles = currentFolder
    ? currentFolder.files.filter((file) =>
        file.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const newId = newFolderName.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
    const newFolder: FolderItem = {
      id: newId,
      name: newFolderName.trim(),
      isRecentlyCreated: true, // Marked recently created!
      files: [],
    };
    setFolders((prev) => [...prev, newFolder]);
    setNewFolderName('');
    setShowNewFolderModal(false);
  };

  const handleUploadFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim() || !currentFolderId) return;
    const extension = '.' + (newFileType === 'doc' ? 'docx' : newFileType);
    const fullName = newFileName.includes('.') ? newFileName : `${newFileName}${extension}`;
    const newFile: DocumentItem = {
      id: `file-${Date.now()}`,
      name: fullName,
      size: '1.4 MB',
      type: newFileType,
      updatedAt: 'Just now',
    };

    setFolders((prev) =>
      prev.map((f) => {
        if (f.id === currentFolderId) {
          return { ...f, files: [...f.files, newFile] };
        }
        return f;
      })
    );
    setNewFileName('');
    setShowUploadFileModal(false);
  };

  const getDocIconPath = (type: DocumentItem['type']) => {
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
  };

  return (
    <div className="max-w-[1300px] mx-auto px-4 sm:px-8 py-6 space-y-8">
      {/* ─── Top Toolbar (Exact Figma Design in Image 2 & 3) ────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left: + New Button */}
        <button
          type="button"
          onClick={() => {
            if (currentFolder) {
              setShowUploadFileModal(true);
            } else {
              setShowNewFolderModal(true);
            }
          }}
          className="px-6 py-2.5 rounded-2xl text-xs sm:text-sm font-bold text-[#23150F] flex items-center gap-2 transition-all hover:brightness-105 select-none"
          style={{
            backgroundColor: '#ECE1D2',
            boxShadow:
              '6px 6px 14px rgba(182, 155, 130, 0.4), -6px -6px 14px #FFFFFF, 2px 2px 4px rgba(182, 155, 130, 0.2)',
          }}
        >
          <span className="text-base leading-none font-normal">+</span>
          <span>New</span>
        </button>

        {/* Center: Breadcrumb Bar (Debossed Inset Pill) */}
        <div
          className="flex-1 max-w-md px-6 py-2.5 rounded-full flex items-center gap-2 text-xs sm:text-sm"
          style={{
            backgroundColor: '#E6D7C3',
            boxShadow:
              'inset 3px 3px 6px rgba(165, 140, 115, 0.5), inset -3px -3px 6px rgba(255, 255, 255, 0.95)',
          }}
        >
          <button
            type="button"
            onClick={handleBackToRoot}
            className={`font-medium transition-colors ${
              currentFolder
                ? 'text-[#5C4535] hover:text-[#23150F]'
                : 'text-[#23150F] font-bold'
            }`}
          >
            My Documents
          </button>

          {currentFolder && (
            <>
              <span className="text-[#8C6020] font-bold">›</span>
              <span className="text-[#C59341] font-bold truncate">
                {currentFolder.name}
              </span>
            </>
          )}
        </div>

        {/* Right Section: View Switcher & Search Bar */}
        <div className="flex items-center gap-4">
          {/* View Mode Switcher */}
          <div
            className="flex items-center rounded-2xl p-1 gap-1"
            style={{
              backgroundColor: '#ECE1D2',
              boxShadow:
                '5px 5px 12px rgba(182, 155, 130, 0.35), -5px -5px 12px #FFFFFF',
            }}
          >
            {/* List Icon */}
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-xl transition-all ${
                viewMode === 'list'
                  ? 'bg-[#DFC5A4] text-[#23150F] shadow-[inset_1px_1px_3px_rgba(0,0,0,0.15)]'
                  : 'text-[#7D6855] hover:text-[#23150F]'
              }`}
              title="List view"
              aria-label="List view"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>

            {/* Grid Icon */}
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-xl transition-all ${
                viewMode === 'grid'
                  ? 'bg-[#DFC5A4] text-[#23150F] shadow-[inset_1px_1px_3px_rgba(0,0,0,0.15)]'
                  : 'text-[#7D6855] hover:text-[#23150F]'
              }`}
              title="Grid view"
              aria-label="Grid view"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect width="7" height="7" x="3" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="14" rx="1" />
                <rect width="7" height="7" x="3" y="14" rx="1" />
              </svg>
            </button>
          </div>

          {/* Search Input (Debossed Inset) */}
          <div
            className="relative flex items-center px-4 py-2 rounded-full w-48 sm:w-60"
            style={{
              backgroundColor: '#E6D7C3',
              boxShadow:
                'inset 2px 2px 5px rgba(165, 140, 115, 0.5), inset -2px -2px 5px rgba(255, 255, 255, 0.95)',
            }}
          >
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search"
              className="w-full bg-transparent text-xs sm:text-sm text-[#23150F] placeholder:text-[#8C7A6A] focus:outline-none pr-6"
            />
            <svg
              className="w-4 h-4 text-[#8C7A6A] absolute right-3 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
        </div>
      </div>

      {/* ─── Skeleton Loading State during Navigation ─── */}
      {isNavigating ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 sm:gap-8 items-start pt-4 animate-in fade-in duration-150">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center justify-center p-3 rounded-2xl space-y-3">
              <div
                className="w-32 h-24 sm:w-36 sm:h-26 rounded-2xl neu-skeleton"
                style={{
                  boxShadow: '4px 4px 10px rgba(182, 155, 130, 0.25), -4px -4px 10px #FFFFFF',
                }}
              />
              <div className="h-3 w-24 rounded neu-skeleton-text" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* ─── SCENARIO A: Top-level Folders View (Matches Image 2) ────────────── */}
          {!currentFolder && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 sm:gap-8 items-start pt-4">
                  {filteredFolders.map((folder) => {
                    const isInteracted = interactedFolderIds.includes(folder.id);
                    // A folder is only NEW if recently created AND this user hasn't interacted with it yet!
                    const isNew = Boolean(folder.isRecentlyCreated && !isInteracted);
                    const isHovered = hoveredFolderId === folder.id;

                    // Pick appropriate icon:
                    // If it's NEW -> new_folder_icon.svg (with yellow NEW badge)
                    // If hovered -> folder_hover.svg (open folder)
                    // Otherwise -> folder_icon.svg (closed folder)
                    let iconSrc = '/assets/folder_icon.svg';
                    if (isNew) {
                      iconSrc = '/assets/new_folder_icon.svg';
                    } else if (isHovered) {
                      iconSrc = '/assets/folder_hover.svg';
                    }

                    return (
                      <div
                        key={folder.id}
                        onClick={() => handleFolderClick(folder)}
                        onMouseEnter={() => setHoveredFolderId(folder.id)}
                        onMouseLeave={() => setHoveredFolderId(null)}
                        className="group flex flex-col items-center justify-center cursor-pointer p-3 rounded-2xl hover:bg-[#EFE5D8]/40 transition-all select-none"
                      >
                        {/* Folder Icon graphic */}
                        <div className="relative w-32 h-26 sm:w-36 sm:h-28 flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
                          <Image
                            src={iconSrc}
                            alt={folder.name}
                            width={140}
                            height={110}
                            className="w-full h-full object-contain drop-shadow-sm"
                            priority
                          />
                        </div>

                        {/* Folder Name */}
                        <span className="font-serif text-xs sm:text-[13px] text-[#23150F] text-center mt-2.5 font-medium leading-tight max-w-[150px] group-hover:text-[#C58B3C] transition-colors">
                          {folder.name}
                        </span>
                      </div>
                    );
                  })}

                  {/* Item 10: Circular Neumorphic + Button (Matching Image 2) */}
                  <div className="flex flex-col items-center justify-center p-3 pt-6">
                    <button
                      type="button"
                      onClick={() => setShowNewFolderModal(true)}
                      className="w-20 h-20 sm:w-22 sm:h-22 rounded-full flex items-center justify-center text-3xl font-light text-[#8C7A6A] hover:text-[#23150F] transition-all hover:scale-105"
                      style={{
                        backgroundColor: '#ECE1D2',
                        boxShadow:
                          '8px 8px 18px rgba(182, 155, 130, 0.4), -8px -8px 18px #FFFFFF, 2px 2px 5px rgba(182, 155, 130, 0.2)',
                      }}
                      title="Create new folder"
                      aria-label="Create new folder"
                    >
                      <span className="leading-none mb-1">+</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* List View */
                <div
                  className="rounded-[24px] p-4 sm:p-6 bg-[#ECE1D2] space-y-2"
                  style={{
                    boxShadow:
                      '10px 10px 24px rgba(182, 155, 130, 0.35), -10px -10px 24px #FFFFFF',
                  }}
                >
                  {filteredFolders.map((folder) => {
                    const isInteracted = interactedFolderIds.includes(folder.id);
                    const isNew = Boolean(folder.isRecentlyCreated && !isInteracted);
                    return (
                      <div
                        key={folder.id}
                        onClick={() => handleFolderClick(folder)}
                        className="flex items-center justify-between p-3.5 rounded-xl hover:bg-[#DFC5A4]/40 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Image
                            src={isNew ? '/assets/new_folder_icon.svg' : '/assets/folder_icon.svg'}
                            alt={folder.name}
                            width={32}
                            height={26}
                            className="object-contain"
                          />
                          <span className="font-serif text-sm font-semibold text-[#23150F]">
                            {folder.name}
                          </span>
                          {isNew && (
                            <span className="text-[9px] uppercase font-bold tracking-wider bg-amber-400 text-[#23150F] px-2 py-0.5 rounded-full">
                              NEW
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-[#7D6855]">{folder.files.length} items</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ─── SCENARIO B: Inside a Folder View (Matches Image 3) ─────────────── */}
          {currentFolder && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 sm:gap-8 items-start pt-4">
                  {filteredFiles.map((file) => (
                    <div
                      key={file.id}
                      onClick={() => setPreviewDocument(file)}
                      className="group flex flex-col items-center justify-center cursor-pointer p-3 rounded-2xl hover:bg-[#EFE5D8]/40 transition-all select-none"
                    >
                      {/* Document Icon Graphic */}
                      <div className="relative w-28 h-32 sm:w-32 sm:h-36 flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
                        <Image
                          src={getDocIconPath(file.type)}
                          alt={file.name}
                          width={120}
                          height={140}
                          className="w-full h-full object-contain drop-shadow-sm"
                          priority
                        />
                      </div>

                      {/* Document Name */}
                      <span className="font-serif text-xs sm:text-[13px] text-[#23150F] text-center mt-2 font-medium leading-tight max-w-[150px] group-hover:text-[#C58B3C] transition-colors truncate">
                        {file.name}
                      </span>
                    </div>
                  ))}

                  {/* Circular Neumorphic + Button (Matching Image 3) */}
                  <div className="flex flex-col items-center justify-center p-3 pt-6">
                    <button
                      type="button"
                      onClick={() => setShowUploadFileModal(true)}
                      className="w-20 h-20 sm:w-22 sm:h-22 rounded-full flex items-center justify-center text-3xl font-light text-[#8C7A6A] hover:text-[#23150F] transition-all hover:scale-105"
                      style={{
                        backgroundColor: '#ECE1D2',
                        boxShadow:
                          '8px 8px 18px rgba(182, 155, 130, 0.4), -8px -8px 18px #FFFFFF, 2px 2px 5px rgba(182, 155, 130, 0.2)',
                      }}
                      title="Upload document"
                      aria-label="Upload document"
                    >
                      <span className="leading-none mb-1">+</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* List View */
                <div
                  className="rounded-[24px] p-4 sm:p-6 bg-[#ECE1D2] space-y-2"
                  style={{
                    boxShadow:
                      '10px 10px 24px rgba(182, 155, 130, 0.35), -10px -10px 24px #FFFFFF',
                  }}
                >
                  {filteredFiles.map((file) => (
                    <div
                      key={file.id}
                      onClick={() => setPreviewDocument(file)}
                      className="flex items-center justify-between p-3.5 rounded-xl hover:bg-[#DFC5A4]/40 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Image
                          src={getDocIconPath(file.type)}
                          alt={file.name}
                          width={24}
                          height={28}
                          className="object-contain"
                        />
                        <span className="font-serif text-sm font-semibold text-[#23150F]">
                          {file.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-[#7D6855]">
                        <span>{file.size}</span>
                        <span>{file.updatedAt}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ─── MODAL 1: Create New Folder ────────────────────────────────────── */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <form
            onSubmit={handleCreateFolder}
            className="w-full max-w-md rounded-[28px] p-7 bg-[#ECE1D2] space-y-4"
            style={{
              boxShadow: '16px 16px 40px rgba(0,0,0,0.25), -8px -8px 24px #FFFFFF',
            }}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#D1BEA8]/80">
              <h3 className="font-cormorant text-xl font-bold text-[#23150F]">
                Create New Case Folder
              </h3>
              <button
                type="button"
                onClick={() => setShowNewFolderModal(false)}
                className="text-[#5C4535] hover:text-[#23150F] font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#5C4535]">
              New folders will be marked with a <strong>NEW</strong> tag until you open them.
            </p>

            <div className="space-y-1.5 pt-1">
              <label className="block text-xs font-semibold text-[#5C4535]">Folder Name:</label>
              <input
                type="text"
                required
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g., Intellectual Property Dispute"
                className="w-full rounded-2xl py-3 px-4 bg-[#E4D5C2] text-xs sm:text-sm text-[#23150F] placeholder:text-[#9E8E7D] focus:outline-none"
                style={{
                  boxShadow:
                    'inset 2px 2px 5px rgba(165, 140, 115, 0.45), inset -2px -2px 5px rgba(255, 255, 255, 0.85)',
                }}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowNewFolderModal(false)}
                className="px-5 py-2.5 rounded-xl border border-[#C8B59E] text-xs font-semibold text-[#5C4535]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-[#DFC5A4] hover:bg-[#D4B892] text-xs font-bold text-[#23150F] shadow-md"
              >
                Create Folder
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── MODAL 2: Upload Document ──────────────────────────────────────── */}
      {showUploadFileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <form
            onSubmit={handleUploadFile}
            className="w-full max-w-md rounded-[28px] p-7 bg-[#ECE1D2] space-y-4"
            style={{
              boxShadow: '16px 16px 40px rgba(0,0,0,0.25), -8px -8px 24px #FFFFFF',
            }}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#D1BEA8]/80">
              <h3 className="font-cormorant text-xl font-bold text-[#23150F]">
                Upload Document to {currentFolder?.name}
              </h3>
              <button
                type="button"
                onClick={() => setShowUploadFileModal(false)}
                className="text-[#5C4535] hover:text-[#23150F] font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="block text-xs font-semibold text-[#5C4535]">Document Name:</label>
              <input
                type="text"
                required
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="e.g., Witness Statement"
                className="w-full rounded-2xl py-3 px-4 bg-[#E4D5C2] text-xs sm:text-sm text-[#23150F] placeholder:text-[#9E8E7D] focus:outline-none"
                style={{
                  boxShadow:
                    'inset 2px 2px 5px rgba(165, 140, 115, 0.45), inset -2px -2px 5px rgba(255, 255, 255, 0.85)',
                }}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#5C4535]">File Type:</label>
              <select
                value={newFileType}
                onChange={(e) => setNewFileType(e.target.value as DocumentItem['type'])}
                className="w-full rounded-2xl py-3 px-4 bg-[#E4D5C2] text-xs sm:text-sm text-[#23150F] focus:outline-none"
                style={{
                  boxShadow:
                    'inset 2px 2px 5px rgba(165, 140, 115, 0.45), inset -2px -2px 5px rgba(255, 255, 255, 0.85)',
                }}
              >
                <option value="pdf">PDF Document (.pdf)</option>
                <option value="doc">Word Document (.docx)</option>
                <option value="excel">Excel Spreadsheet (.xlsx)</option>
                <option value="csv">CSV Data (.csv)</option>
                <option value="png">PNG Image (.png)</option>
                <option value="jpg">JPEG Image (.jpg)</option>
                <option value="txt">Text File (.txt)</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowUploadFileModal(false)}
                className="px-5 py-2.5 rounded-xl border border-[#C8B59E] text-xs font-semibold text-[#5C4535]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-[#DFC5A4] hover:bg-[#D4B892] text-xs font-bold text-[#23150F] shadow-md"
              >
                Upload File
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── MODAL 3: Document Preview ─────────────────────────────────────── */}
      {previewDocument && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div
            className="w-full max-w-lg rounded-[28px] p-7 bg-[#ECE1D2] space-y-4"
            style={{
              boxShadow: '16px 16px 40px rgba(0,0,0,0.3), -8px -8px 24px #FFFFFF',
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#D1BEA8]/80">
              <div className="flex items-center gap-3">
                <Image
                  src={getDocIconPath(previewDocument.type)}
                  alt={previewDocument.name}
                  width={32}
                  height={38}
                  className="object-contain"
                />
                <div>
                  <h3 className="font-cormorant text-xl font-bold text-[#23150F]">
                    {previewDocument.name}
                  </h3>
                  <p className="text-[10px] text-[#7D6855]">
                    Size: {previewDocument.size} • Last Updated: {previewDocument.updatedAt}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDocument(null)}
                className="text-[#5C4535] hover:text-[#23150F] font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Document Mock Viewer Body */}
            <div
              className="rounded-2xl p-6 bg-[#FFFFFF] border border-[#D1BEA8] min-h-[180px] flex flex-col justify-between shadow-inner"
            >
              <div className="space-y-2">
                <div className="h-3 bg-[#E5D5C1] rounded w-3/4" />
                <div className="h-3 bg-[#EAE0D2] rounded w-full" />
                <div className="h-3 bg-[#EAE0D2] rounded w-5/6" />
                <div className="h-3 bg-[#EAE0D2] rounded w-2/3" />
              </div>
              <p className="text-[11px] text-[#8C7A6A] italic pt-4">
                Confidential Attorney-Client Record • Protected under Rule 130 of the Rules of Court
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-[#7D6855]">Privileged Case Material</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => alert(`Downloading ${previewDocument.name}...`)}
                  className="px-5 py-2.5 rounded-xl bg-[#DFC5A4] hover:bg-[#D4B892] text-xs font-bold text-[#23150F] shadow-sm"
                >
                  Download File
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDocument(null)}
                  className="px-5 py-2.5 rounded-xl bg-[#23150F] text-[#ded7cb] text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DocumentsView;
