'use client';

import React, { useState, useEffect } from 'react';
import {
  getUserDocumentsDataAction,
  createDocumentFolderAction,
  uploadDocumentFileAction,
} from '@/app/actions/consultationActions';
import { useRef } from 'react';
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
  kind?: 'shared' | 'owned';
  isRecentlyCreated?: boolean;
  files: DocumentItem[];
}

interface DocumentsViewProps {
  role?: 'client' | 'lawyer';
}


export function DocumentsView({ role = 'client' }: DocumentsViewProps) {
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState<boolean>(true);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [currentSection, setCurrentSection] = useState<'shared' | 'owned' | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [hoveredFolderId, setHoveredFolderId] = useState<string | null>(null);
  const [hoveredSection, setHoveredSection] = useState<'shared' | 'owned' | null>(null);
  const [isNavigating, setIsNavigating] = useState<boolean>(false);

  // Independent interacted state per user role (client vs lawyer)
  const storageKey = `justicia_interacted_folders_${role}`;
  const customStorageKey = role === 'lawyer' ? 'justicia_lawyer_custom_folders' : 'justicia_client_custom_folders';
  const [interactedFolderIds, setInteractedFolderIds] = useState<string[]>([]);

  // Modals
  const [showNewFolderModal, setShowNewFolderModal] = useState<boolean>(false);
  const [showUploadFileModal, setShowUploadFileModal] = useState<boolean>(false);
  const [previewDocument, setPreviewDocument] = useState<DocumentItem | null>(null);

  // Form inputs
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [newFileName, setNewFileName] = useState<string>('');
  const [newFileType, setNewFileType] = useState<DocumentItem['type']>('pdf');
  const [newFileSize, setNewFileSize] = useState<string>('1.4 MB');
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);
  const [isUploadingFile, setIsUploadingFile] = useState<boolean>(false);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (navigationTimerRef.current) clearTimeout(navigationTimerRef.current);
  }, []);

  const animateFolderNavigation = () => {
    if (navigationTimerRef.current) clearTimeout(navigationTimerRef.current);
    setIsNavigating(true);
    navigationTimerRef.current = setTimeout(() => {
      setIsNavigating(false);
      navigationTimerRef.current = null;
    }, 240);
  };

  // Load real folders and documents from Supabase
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setInteractedFolderIds(JSON.parse(stored));
      }
    } catch {
      // Ignore storage errors
    }

    setLoadingDocs(true);
    getUserDocumentsDataAction(role).then((dbFolders: any) => {
      let combined: FolderItem[] = [];
      if (dbFolders && Array.isArray(dbFolders) && dbFolders.length > 0) {
        combined = dbFolders;
      }

      // Also merge any instant local custom folders
      try {
        const custom = localStorage.getItem(customStorageKey);
        if (custom) {
          const parsed: FolderItem[] = JSON.parse(custom);
          if (parsed && Array.isArray(parsed)) {
            const existingIds = new Set(combined.map((f) => f.id));
            const extra = parsed.filter((f) => !existingIds.has(f.id)).map((f) => ({ ...f, kind: 'owned' as const }));
            combined = [...extra, ...combined];
          }
        }
      } catch {
        // ignore
      }

      setFolders(combined);
      setLoadingDocs(false);
    });
  }, [role, storageKey, customStorageKey]);

  // Handle clicking on a folder:
  // 1. Shows sleek skeleton transition
  // 2. Marks it as interacted for this role (removes NEW badge permanently for this user)
  // 3. Opens the folder
  const handleFolderClick = (folder: FolderItem) => {
    animateFolderNavigation();
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
  };

  const handleBackToRoot = () => {
    if (!currentFolderId && !currentSection) return;
    animateFolderNavigation();
    setCurrentFolderId(null);
    if (!currentFolderId) setCurrentSection(null);
  };

  const navigateLawyerDocuments = (section: 'shared' | 'owned' | null, folderId: string | null = null) => {
    animateFolderNavigation();
    setCurrentSection(section);
    setCurrentFolderId(folderId);
  };

  const currentFolder = folders.find((f) => f.id === currentFolderId) || null;

  // Filtered lists
  const filteredFolders = folders.filter((f) =>
    (role !== 'lawyer' || !currentSection || (f.kind ?? 'shared') === currentSection) &&
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFiles = currentFolder
    ? currentFolder.files.filter((file) =>
        file.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const getFolderArtwork = (isNew: boolean, isHovered: boolean) =>
    isNew ? '/assets/new_folder_icon.svg' : isHovered ? '/assets/folder_hover.svg' : '/assets/folder_icon.svg';

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim() || isCreatingFolder) return;
    setIsCreatingFolder(true);
    setFolderError(null);

    try {
      const res = await createDocumentFolderAction(newFolderName.trim(), role);
      if (res && 'error' in res && res.error) {
        setFolderError(res.error);
        setIsCreatingFolder(false);
        return;
      }

      const created: FolderItem = (res && 'folder' in res && res.folder) ? res.folder : {
        id: `fld-${Date.now()}`,
        name: newFolderName.trim(),
        kind: 'owned',
        isRecentlyCreated: true,
        files: [],
      };

      setFolders((prev) => [created, ...prev]);
      if (role === 'lawyer') navigateLawyerDocuments('owned');

      try {
        const custom = localStorage.getItem(customStorageKey);
        const parsed: FolderItem[] = custom ? JSON.parse(custom) : [];
        localStorage.setItem(customStorageKey, JSON.stringify([created, ...parsed]));
      } catch {
        // ignore
      }

      setNewFolderName('');
      setShowNewFolderModal(false);
    } catch (err: any) {
      setFolderError(err?.message || 'Failed to create folder');
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleLocalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setNewFileName(file.name);
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    setNewFileSize(file.size > 1024 * 1024 ? `${sizeMb} MB` : `${Math.round(file.size / 1024)} KB`);

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
    if (!newFileName.trim() || isUploadingFile) return;
    setIsUploadingFile(true);
    setUploadError(null);

    const extension = '.' + (newFileType === 'doc' ? 'docx' : newFileType);
    const fullName = newFileName.includes('.') ? newFileName : `${newFileName}${extension}`;
    const targetFolderId = currentFolderId || (folders[0]?.id || null);

    try {
      const res = await uploadDocumentFileAction(targetFolderId, fullName, newFileType, newFileSize);
      const newFile: DocumentItem = (res && 'file' in res && res.file) ? res.file : {
        id: `file-${Date.now()}`,
        name: fullName,
        size: newFileSize,
        type: newFileType,
        updatedAt: 'Just now',
      };

      setFolders((prev) => {
        let matched = false;
        const updated = prev.map((f) => {
          if (f.id === targetFolderId || (!targetFolderId && f.name.includes('Vault'))) {
            matched = true;
            return { ...f, files: [newFile, ...f.files] };
          }
          return f;
        });

        if (!matched) {
          if (updated.length > 0) {
            updated[0] = { ...updated[0], files: [newFile, ...updated[0].files] };
          } else {
            updated.push({
              id: 'uploaded-records',
              name: 'Client Vault & Uploaded Records',
              isRecentlyCreated: false,
              files: [newFile],
            });
          }
        }
        return updated;
      });

      setNewFileName('');
      setShowUploadFileModal(false);
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to upload document');
    } finally {
      setIsUploadingFile(false);
    }
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
    <div className={`${role === 'lawyer' ? 'lawyer-documents' : ''} max-w-[1300px] mx-auto px-4 sm:px-8 py-6 space-y-8`}>
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
            onClick={role === 'lawyer' ? () => navigateLawyerDocuments(null) : handleBackToRoot}
            className={`font-medium transition-colors ${
              currentFolder
                ? 'text-[#5C4535] hover:text-[#23150F]'
                : 'text-[#23150F] font-bold'
            }`}
          >
            {role === 'lawyer' ? 'Client Documents' : 'My Documents'}
          </button>

          {role === 'lawyer' && currentSection && (
            <>
              <span aria-hidden="true">›</span>
              <button type="button" onClick={() => navigateLawyerDocuments(currentSection)} className="font-medium text-[#341512]">
                {currentSection === 'shared' ? 'Shared With You' : 'Your Documents'}
              </button>
            </>
          )}

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
          {Array.from({ length: role === 'lawyer' ? (currentFolder ? 5 : 3) : 10 }).map((_, i) => (
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
          {role === 'lawyer' && !currentSection && !currentFolder && (
            <div className="lawyer-document-categories grid grid-cols-2 sm:grid-cols-[repeat(3,190px)] gap-6 pt-4 animate-in fade-in duration-150">
              {([{ key: 'shared', label: 'Shared With You' }, { key: 'owned', label: 'Your Documents' }] as const).map((section) => {
                const isNew = folders.some((folder) =>
                  (folder.kind ?? 'shared') === section.key && folder.isRecentlyCreated && !interactedFolderIds.includes(folder.id)
                );
                const iconSrc = getFolderArtwork(isNew, hoveredSection === section.key);
                return (
                  <button
                    key={section.key}
                    type="button"
                    onClick={() => navigateLawyerDocuments(section.key)}
                    onMouseEnter={() => setHoveredSection(section.key)}
                    onMouseLeave={() => setHoveredSection(null)}
                    onFocus={() => setHoveredSection(section.key)}
                    onBlur={() => setHoveredSection(null)}
                    className="group flex flex-col items-center justify-center cursor-pointer p-3 rounded-2xl hover:bg-[#EFE5D8]/40 transition-all select-none focus-visible:outline-2 focus-visible:outline-[#85441e]"
                  >
                    <div className="relative w-32 h-26 sm:w-36 sm:h-28 flex items-center justify-center transition-transform duration-200 group-hover:scale-105 group-focus-visible:scale-105">
                      <Image src={iconSrc} alt="" width={140} height={110} className="w-full h-full object-contain drop-shadow-sm" priority />
                    </div>
                    <span className="font-serif text-xs sm:text-[13px] text-[#23150F] text-center mt-2.5 font-medium leading-tight max-w-[150px] group-hover:text-[#C58B3C] transition-colors">{section.label}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setShowNewFolderModal(true)}
                aria-label="Create new folder"
                className="lawyer-document-category-add self-center justify-self-center w-20 h-20 sm:w-22 sm:h-22 rounded-full flex items-center justify-center text-3xl font-light text-[#8C7A6A] hover:text-[#23150F] transition-all hover:scale-105"
                style={{ backgroundColor: '#ECE1D2', boxShadow: '8px 8px 18px rgba(182, 155, 130, 0.4), -8px -8px 18px #FFFFFF, 2px 2px 5px rgba(182, 155, 130, 0.2)' }}
              >+</button>
            </div>
          )}
          {!currentFolder && (role !== 'lawyer' || currentSection) && (
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
                    const iconSrc = getFolderArtwork(isNew, isHovered);

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

                  {filteredFolders.length === 0 && !loadingDocs && (
                    <div className="col-span-full py-16 text-center space-y-2">
                      <Image src="/assets/folder_icon.svg" alt="" width={64} height={52} className="mx-auto opacity-60" />
                      <p className="text-sm font-semibold text-[#34150F]">{role === 'lawyer' ? 'No folders here yet' : 'No case folders in your vault yet'}</p>
                      <p className="text-xs text-[#7D6855] max-w-md mx-auto">
                        {role === 'lawyer' && currentSection === 'shared'
                          ? 'Documents shared through consultations will appear here.'
                          : 'Folders and attached files from your booked consultations will automatically appear here. You can also click + to create a custom folder.'}
                      </p>
                    </div>
                  )}

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

            {folderError && (
              <div className="p-2.5 rounded-xl bg-red-100 border border-red-300 text-xs text-red-800">
                {folderError}
              </div>
            )}

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
                disabled={isCreatingFolder}
                className="px-6 py-2.5 rounded-xl bg-[#DFC5A4] hover:bg-[#D4B892] disabled:opacity-60 text-xs font-bold text-[#23150F] shadow-md flex items-center gap-2"
              >
                {isCreatingFolder ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin text-[#23150F]" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Creating...</span>
                  </>
                ) : (
                  <span>Create Folder</span>
                )}
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

            {uploadError && (
              <div className="p-2.5 rounded-xl bg-red-100 border border-red-300 text-xs text-red-800">
                {uploadError}
              </div>
            )}

            {/* Native File Selector Area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-5 rounded-2xl border-2 border-dashed border-[#C5B099] bg-[#E8DDD0] hover:bg-[#E3D6C6] transition-colors cursor-pointer text-center space-y-1.5"
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleLocalFileSelect}
              />
              <svg className="w-8 h-8 text-[#7D6855] mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
              </svg>
              <div className="text-xs font-bold text-[#23150F]">
                Click to browse a file from your device
              </div>
              <p className="text-[10px] text-[#7D6855]">
                PDF, Word, Excel, CSV, PNG, JPG, or Text
              </p>
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
                disabled={isUploadingFile}
                className="px-6 py-2.5 rounded-xl bg-[#DFC5A4] hover:bg-[#D4B892] disabled:opacity-60 text-xs font-bold text-[#23150F] shadow-md flex items-center gap-2"
              >
                {isUploadingFile ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin text-[#23150F]" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Uploading...</span>
                  </>
                ) : (
                  <span>Upload File</span>
                )}
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
