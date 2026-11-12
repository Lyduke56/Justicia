'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useLawyerReviews } from './useLawyerReviews';
import { motion, AnimatePresence } from 'motion/react';
import { createClient } from '@/lib/supabase/client';
import type { PublicLawyerProfile } from './LawyerGrid';
import {
  bookConsultationAction,
  getBookedSlotsForLawyer,
  getUserDocumentsDataAction,
  createDocumentFolderAction,
  uploadDocumentFileAction,
} from '@/app/actions/consultationActions';
import type {
  ClientConsultation,
  DocumentFileItem,
  DocumentFolderItem,
} from '@/app/actions/consultationActions';
import { ConsultationSummaryModal, clientConsultationToSummary } from './ConsultationSummaryModal';

/** A My Documents file attached to the booking (shared with the lawyer by document ID). */
interface BookingAttachment {
  id: string;
  name: string;
  size: string;
}

interface BookingDraft {
  year: number;
  month: number;
  day: number;
  timeSlot: string;
  communicationMode: 'video' | 'audio';
  subject: string;
  description: string;
  attachments: BookingAttachment[];
  agreedToTerms: boolean;
  savedAt: string;
}

const DEFAULT_TIME_SLOT = '2:00 PM - 3:00 PM • PST, GMT+8';
const bookingDraftKey = (lawyerId: string) => `justicia_booking_draft_${lawyerId}`;

/** Parses "2:00 PM - 3:00 PM • …" into minutes-from-midnight. */
function parseSlotMinutes(slot: string): { start: number; end: number } | null {
  const matches = [...slot.matchAll(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/gi)];
  if (matches.length === 0) return null;
  const toMin = (m: RegExpMatchArray) => {
    let h = Number(m[1]) % 12;
    if (m[3].toUpperCase() === 'PM') h += 12;
    return h * 60 + (m[2] ? Number(m[2]) : 0);
  };
  const start = toMin(matches[0]);
  const end = matches[1] ? toMin(matches[1]) : start + 60;
  return { start, end: end > start ? end : start + 60 };
}

function slotsOverlap(a: string, b: string): boolean {
  if (a === b) return true;
  const ra = parseSlotMinutes(a);
  const rb = parseSlotMinutes(b);
  return !!ra && !!rb && ra.start < rb.end && rb.start < ra.end;
}

export interface ReviewItem {
  id: number | string;
  name: string;
  stars: number;
  date: string;
  content: string;
  reply?: string;
}

interface LawyerDetailViewProps {
  lawyer: PublicLawyerProfile;
  onBack?: () => void;
  defaultTab?: 'about' | 'reviews' | 'booking' | 'cases';
  onEdit?: () => void;
}

type TabType = 'about' | 'reviews' | 'booking' | 'cases';
// Always resolves "today" in Philippine time (GMT+8), regardless of device/server timezone
const getTodayPH = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get('year'), month: get('month') - 1, day: get('day') };
};


// ─── Neumorphic SVG Icon Helpers (Zero AI Emojis) ───────────────────────────

function StarIcon({ filled = false, className = "w-4 h-4" }: { filled?: boolean; className?: string }) {
  return (
    <svg className={`${className} ${filled ? 'text-[#C58B3C] fill-[#C58B3C]' : 'text-[#CBB8A4] fill-transparent stroke-current'}`} viewBox="0 0 20 20" strokeWidth="1.2">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

function ScalesIcon({ className = "w-3.5 h-3.5 text-[#C58B3C] shrink-0" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3v18M7 21h10M3 7h18" />
      <path d="M6 7l-3 7c0 1.5 1.5 2.5 3 2.5s3-1 3-2.5L6 7z" />
      <path d="M18 7l-3 7c0 1.5 1.5 2.5 3 2.5s3-1 3-2.5L18 7z" />
    </svg>
  );
}

function PaperclipIcon({ className = "w-3.5 h-3.5 text-[#C58B3C] shrink-0" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.373L8.558 18.315a1.5 1.5 0 0 1-2.121-2.121l7.693-7.693" />
    </svg>
  );
}

function FolderIcon({ className = "w-4 h-4 text-[#C58B3C] shrink-0" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
    </svg>
  );
}

function FileDocIcon({ className = "w-4 h-4 text-[#7A6756] shrink-0" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  );
}

export function LawyerDetailView({
  lawyer,
  onBack,
  defaultTab = 'about',
  onEdit,
}: LawyerDetailViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);

  const [currentYear, setCurrentYear] = useState<number>(() => getTodayPH().year);
  const [currentMonth, setCurrentMonth] = useState<number>(() => getTodayPH().month);
  const [selectedDay, setSelectedDay] = useState<number>(() => getTodayPH().day);

  useEffect(() => {
    const t = getTodayPH();
    setCurrentYear(t.year);
    setCurrentMonth(t.month);
    setSelectedDay(t.day);
  }, []);

  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>(DEFAULT_TIME_SLOT);
  const [communicationMode, setCommunicationMode] = useState<'video' | 'audio'>('video');
  const [subject, setSubject] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [agreedToTerms, setAgreedToTerms] = useState<boolean>(false);

  // ─── Documents Vault Picker Modal State ───
  const [showDocPickerModal, setShowDocPickerModal] = useState<boolean>(false);
  const [docPickerFolders, setDocPickerFolders] = useState<DocumentFolderItem[]>([]);
  const [loadingDocPicker, setLoadingDocPicker] = useState<boolean>(false);
  const [selectedDocPickerFiles, setSelectedDocPickerFiles] = useState<string[]>([]);
  const [activePickerFolderId, setActivePickerFolderId] = useState<string | null>(null);
  const [pickerNewFolderName, setPickerNewFolderName] = useState<string>('');
  const [isCreatingPickerFolder, setIsCreatingPickerFolder] = useState<boolean>(false);
  const [isUploadingPickerFile, setIsUploadingPickerFile] = useState<boolean>(false);
  const [pickerNotice, setPickerNotice] = useState<string | null>(null);
  const pickerFileInputRef = useRef<HTMLInputElement>(null);
  const [attachedFiles, setAttachedFiles] = useState<BookingAttachment[]>([]);
  const [bookingStatus, setBookingStatus] = useState<'idle' | 'saved'>('idle');
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [submittingBooking, setSubmittingBooking] = useState<boolean>(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [submittedConsultation, setSubmittedConsultation] = useState<ClientConsultation | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState<boolean>(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState<boolean>(false);
  const draftRestoredRef = useRef<boolean>(false);

  useEffect(() => {
    if (activeTab === 'booking') {
      const t = getTodayPH();
      setCurrentYear(t.year);
      setCurrentMonth(t.month);
      setSelectedDay(t.day);

      // Restore a previously saved draft for this lawyer (once per visit).
      if (draftRestoredRef.current) return;
      draftRestoredRef.current = true;
      let draft: BookingDraft | null = null;
      try {
        const raw = localStorage.getItem(bookingDraftKey(lawyer.userId));
        draft = raw ? (JSON.parse(raw) as BookingDraft) : null;
      } catch {
        draft = null;
      }
      if (!draft) return;

      const draftDate = Date.UTC(draft.year, draft.month, draft.day);
      if (draftDate >= Date.UTC(t.year, t.month, t.day)) {
        setCurrentYear(draft.year);
        setCurrentMonth(draft.month);
        setSelectedDay(draft.day);
        if (draft.timeSlot) setSelectedTimeSlot(draft.timeSlot);
      }
      setCommunicationMode(draft.communicationMode === 'audio' ? 'audio' : 'video');
      setSubject(draft.subject ?? '');
      setDescription(draft.description ?? '');
      setAttachedFiles(Array.isArray(draft.attachments) ? draft.attachments : []);
      setAgreedToTerms(!!draft.agreedToTerms);
    }
  }, [activeTab, lawyer.userId]);

  const bioRef = useRef<HTMLDivElement>(null);
  const [showBioFade, setShowBioFade] = useState(false);

  const updateBioFade = useCallback(() => {
    const el = bioRef.current;
    if (!el) return;
    // true only if there's more content below the visible area
    setShowBioFade(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
  }, []);

  useEffect(() => {
    const el = bioRef.current;
    if (!el) return;
    updateBioFade();
    const ro = new ResizeObserver(updateBioFade);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateBioFade, lawyer.about]);
  // ─── Document Vault Picker Handlers ──────────────────────────────────────────
  const handleOpenDocPicker = async () => {
    setShowDocPickerModal(true);
    setLoadingDocPicker(true);
    setPickerNotice(null);
    // Pre-select files already attached to this booking.
    setSelectedDocPickerFiles(attachedFiles.map((f) => f.id));
    try {
      const data = await getUserDocumentsDataAction('client');
      const folders = Array.isArray(data) ? data : [];
      setDocPickerFolders(folders);
      if (folders.length > 0) {
        setActivePickerFolderId(folders[0].id);
      }
    } catch (err) {
      console.error('Error fetching documents for picker:', err);
      setPickerNotice('We could not load My Documents. Please try again.');
    } finally {
      setLoadingDocPicker(false);
    }
  };

  const handleToggleSelectDoc = (fileId: string) => {
    setSelectedDocPickerFiles((prev) =>
      prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]
    );
  };

  /** Uploads files to My Documents and returns the stored document records. */
  const uploadToMyDocuments = async (
    files: File[],
    folderId: string | null
  ): Promise<{ uploaded: DocumentFileItem[]; errors: string[] }> => {
    const uploaded: DocumentFileItem[] = [];
    const errors: string[] = [];
    for (const file of files) {
      const fd = new FormData();
      fd.append('file', file);
      if (folderId) fd.append('folderId', folderId);
      const res = await uploadDocumentFileAction(fd);
      if ('file' in res && res.file) uploaded.push(res.file);
      else errors.push(('error' in res && res.error) || `Failed to upload "${file.name}".`);
    }
    return { uploaded, errors };
  };

  /** Dropzone / browse: uploads to My Documents, then attaches to this booking. */
  const handleAttachLocalFiles = async (fileList: FileList | File[] | null) => {
    const files = fileList ? Array.from(fileList) : [];
    if (files.length === 0 || isUploadingAttachment) return;
    setIsUploadingAttachment(true);
    setBookingError(null);
    try {
      const { uploaded, errors } = await uploadToMyDocuments(files, null);
      if (uploaded.length > 0) {
        setAttachedFiles((prev) => {
          const seen = new Set(prev.map((f) => f.id));
          return [...prev, ...uploaded.filter((f) => !seen.has(f.id)).map(({ id, name, size }) => ({ id, name, size }))];
        });
      }
      if (errors.length > 0) setBookingError(errors.join(' '));
    } catch {
      setBookingError('We could not upload your files. Please try again.');
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const handleCreatePickerFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickerNewFolderName.trim() || isCreatingPickerFolder) return;
    setIsCreatingPickerFolder(true);
    setPickerNotice(null);
    try {
      const res = await createDocumentFolderAction(pickerNewFolderName.trim());
      if (!('folder' in res) || !res.folder) {
        setPickerNotice(('error' in res && res.error) || 'Failed to create folder');
        return;
      }
      const newFolder = res.folder;
      setDocPickerFolders((prev) => [newFolder, ...prev]);
      setActivePickerFolderId(newFolder.id);

      setPickerNewFolderName('');
      setPickerNotice(`Created folder "${newFolder.name}" successfully.`);
    } catch (err: any) {
      setPickerNotice(err?.message || 'Failed to create folder');
    } finally {
      setIsCreatingPickerFolder(false);
    }
  };

  const handlePickerFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file || isUploadingPickerFile) return;

    setIsUploadingPickerFile(true);
    setPickerNotice(null);

    // Only user-created folders are real storage folders; anything else goes to the vault root.
    const activeFolder = docPickerFolders.find((f) => f.id === activePickerFolderId);
    const targetFolderId =
      activeFolder && activeFolder.kind === 'owned' && activeFolder.id !== 'uploaded-records'
        ? activeFolder.id
        : null;

    try {
      const { uploaded, errors } = await uploadToMyDocuments([file], targetFolderId);
      const newFileItem = uploaded[0];
      if (!newFileItem) {
        setPickerNotice(errors[0] || 'Failed to upload document');
        return;
      }

      setDocPickerFolders((prev) => {
        const destinationId = targetFolderId ?? 'uploaded-records';
        if (prev.some((f) => f.id === destinationId)) {
          return prev.map((f) => (f.id === destinationId ? { ...f, files: [newFileItem, ...f.files] } : f));
        }
        return [
          { id: 'uploaded-records', name: 'Client Vault & Uploaded Records', kind: 'owned', isRecentlyCreated: false, files: [newFileItem] },
          ...prev,
        ];
      });
      if (!targetFolderId) setActivePickerFolderId('uploaded-records');

      // Auto-select the newly uploaded file
      setSelectedDocPickerFiles((prev) => Array.from(new Set([...prev, newFileItem.id])));
      setPickerNotice(`Uploaded "${newFileItem.name}" to My Documents and added it to your selection.`);
    } catch {
      setPickerNotice('Failed to upload document');
    } finally {
      setIsUploadingPickerFile(false);
      input.value = '';
    }
  };

  const handleConfirmDocPicker = () => {
    const allFiles = new Map<string, DocumentFileItem>();
    docPickerFolders.forEach((folder) => folder.files.forEach((f) => allFiles.set(f.id, f)));
    setAttachedFiles((prev) => {
      const keep = prev.filter((f) => selectedDocPickerFiles.includes(f.id) || !allFiles.has(f.id));
      const seen = new Set(keep.map((f) => f.id));
      const added = selectedDocPickerFiles
        .filter((id) => !seen.has(id) && allFiles.has(id))
        .map((id) => {
          const f = allFiles.get(id)!;
          return { id: f.id, name: f.name, size: f.size };
        });
      return [...keep, ...added];
    });
    setSelectedDocPickerFiles([]);
    setShowDocPickerModal(false);
  };

  // ─── Reviews State ────────────────────────────────────────────────────────────
  const { reviews: reviewsList, loading: reviewsLoading, error: reviewsError } = useLawyerReviews(lawyer.userId);
  const [selectedReviewStar, setSelectedReviewStar] = useState<number | 'all'>('all');
  const [reviewPage, setReviewPage] = useState<number>(1);
  const [helpfulCounts, setHelpfulCounts] = useState<{ [id: string | number]: number }>({});
  const [userVotedHelpful, setUserVotedHelpful] = useState<{ [id: string | number]: boolean }>({});

  // Fetch booked slots for the selected day to prevent duplicate appointments
  const [slotsRefreshKey, setSlotsRefreshKey] = useState<number>(0);
  const isSlotBooked = (slot: string) => bookedSlots.some((booked) => slotsOverlap(booked, slot));

  useEffect(() => {
    if (!lawyer.userId) return;
    let stale = false;
    const dateStr = `${monthNames[currentMonth]} ${selectedDay}, ${currentYear}`;
    getBookedSlotsForLawyer(lawyer.userId, dateStr).then((slots) => {
      if (stale) return;
      const booked = slots || [];
      setBookedSlots(booked);
      setSelectedTimeSlot((current) => {
        if (!booked.some((b) => slotsOverlap(b, current))) return current;
        return timeSlots.find((s) => !booked.some((b) => slotsOverlap(b, s))) ?? current;
      });
    });
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lawyer.userId, selectedDay, currentMonth, currentYear, slotsRefreshKey]);

  // ─── Cases State ──────────────────────────────────────────────────────────────
  const [casePage, setCasePage] = useState<number>(1);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthShortNames = [
    'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
    'JUL', 'AUG', 'SEPT', 'OCT', 'NOV', 'DEC'
  ];

  const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun

  const daysInMonth = React.useMemo(() => {
    const slots: Array<{ day: number | null }> = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      slots.push({ day: null });
    }
    for (let d = 1; d <= totalDaysInMonth; d++) {
      slots.push({ day: d });
    }
    return slots;
  }, [firstDayOfWeek, totalDaysInMonth]);

  const selectedDateObj = React.useMemo(() => {
    const validDay = Math.min(selectedDay, totalDaysInMonth);
    return new Date(currentYear, currentMonth, validDay);
  }, [currentYear, currentMonth, selectedDay, totalDaysInMonth]);

  const selectedDayOfWeek = React.useMemo(() => {
    return selectedDateObj.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  }, [selectedDateObj]);

  const selectedMonthName = monthNames[currentMonth];
  const selectedMonthShort = monthShortNames[currentMonth];
  const clampDay = (year: number, month: number) =>
    setSelectedDay((d) => Math.min(d, new Date(year, month + 1, 0).getDate()));

  const handlePrevMonth = () => {
    const y = currentMonth === 0 ? currentYear - 1 : currentYear;
    const m = currentMonth === 0 ? 11 : currentMonth - 1;
    setCurrentYear(y);
    setCurrentMonth(m);
    clampDay(y, m);
  };

  const handleNextMonth = () => {
    const y = currentMonth === 11 ? currentYear + 1 : currentYear;
    const m = currentMonth === 11 ? 0 : currentMonth + 1;
    setCurrentYear(y);
    setCurrentMonth(m);
    clampDay(y, m);
  };

  const handleGoToToday = () => {
    const t = getTodayPH();
    setCurrentYear(t.year);
    setCurrentMonth(t.month);
    setSelectedDay(t.day);
  };

  const timeSlots = [
    '9:00 AM - 10:00 AM • PST, GMT+8',
    '10:00 AM - 11:00 AM • PST, GMT+8',
    '1:00 PM - 2:00 PM • PST, GMT+8',
    '2:00 PM - 3:00 PM • PST, GMT+8',
    '3:00 PM - 4:00 PM • PST, GMT+8',
    '4:00 PM - 5:00 PM • PST, GMT+8',
  ];

  const resetBookingForm = () => {
    const t = getTodayPH();
    setCurrentYear(t.year);
    setCurrentMonth(t.month);
    setSelectedDay(t.day);
    setSelectedTimeSlot(DEFAULT_TIME_SLOT);
    setCommunicationMode('video');
    setSubject('');
    setDescription('');
    setAttachedFiles([]);
    setAgreedToTerms(false);
    setBookingError(null);
    try {
      localStorage.removeItem(bookingDraftKey(lawyer.userId));
    } catch {
      // storage unavailable — nothing to clear
    }
  };

  const handleClearInputs = () => {
    resetBookingForm();
    setBookingStatus('idle');
  };

  const handleSaveDraft = () => {
    const draft: BookingDraft = {
      year: currentYear,
      month: currentMonth,
      day: selectedDay,
      timeSlot: selectedTimeSlot,
      communicationMode,
      subject,
      description,
      attachments: attachedFiles,
      agreedToTerms,
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(bookingDraftKey(lawyer.userId), JSON.stringify(draft));
      setBookingError(null);
      setBookingStatus('saved');
      setTimeout(() => setBookingStatus((s) => (s === 'saved' ? 'idle' : s)), 4000);
    } catch {
      setBookingError('Your browser blocked saving the draft. Please check your storage settings and try again.');
    }
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingBooking) return;
    setBookingError(null);

    if (isUploadingAttachment) {
      setBookingError('Please wait for your files to finish uploading.');
      return;
    }
    if (!subject.trim()) {
      setBookingError('Please enter a consultation subject.');
      return;
    }
    if (!agreedToTerms) {
      setBookingError('Please agree to the attorney-client privilege review terms.');
      return;
    }
    if (isSlotBooked(selectedTimeSlot)) {
      setBookingError('This time slot is already booked. Please choose another time slot.');
      return;
    }

    setSubmittingBooking(true);
    try {
      const res = await bookConsultationAction({
        lawyerId: lawyer.userId,
        dateStr: `${selectedMonthName} ${selectedDay}, ${currentYear}`,
        timeSlot: selectedTimeSlot,
        communicationMode,
        subject,
        description,
        documentIds: attachedFiles.map((f) => f.id),
      });

      if (!('consultation' in res) || !res.consultation) {
        setBookingError(('error' in res && res.error) || 'Error submitting booking');
        setSlotsRefreshKey((k) => k + 1);
        return;
      }

      setSubmittedConsultation(res.consultation);
      resetBookingForm();
      setBookingStatus('idle');
      setSlotsRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error submitting booking';
      setBookingError(msg);
    } finally {
      setSubmittingBooking(false);
    }
  };

  const toggleHelpful = (idx: string | number) => {
    const hasVoted = userVotedHelpful[idx];
    setHelpfulCounts((prev) => ({
      ...prev,
      [idx]: (prev[idx] || 0) + (hasVoted ? -1 : 1),
    }));
    setUserVotedHelpful((prev) => ({
      ...prev,
      [idx]: !hasVoted,
    }));
  };

  const standardFee = lawyer.feeStandard60min ?? 1500;
  const initialFee = lawyer.feeInitial30min ?? 700;
  const extendedFee = lawyer.feeExtended120min ?? 2300;

  // Filtered reviews and dynamic rating metrics
  const filteredReviews = reviewsList.filter((rev) => {
    if (selectedReviewStar === 'all') return true;
    return rev.stars === selectedReviewStar;
  });

  const averageRating =
    reviewsList.length > 0
      ? reviewsList.reduce((acc, r) => acc + r.stars, 0) / reviewsList.length
      : 0;

  const REVIEWS_PER_PAGE = 4;
  const totalReviewsCount = reviewsList.length;
  const totalReviewPages = Math.max(1, Math.ceil(filteredReviews.length / REVIEWS_PER_PAGE));
  const pagedReviews = filteredReviews.slice(
    (reviewPage - 1) * REVIEWS_PER_PAGE,
    reviewPage * REVIEWS_PER_PAGE
  );

  // Cases handled matching Figma design
  const casesHandled = [
    {
      id: 1,
      docket: 'SUBJECT MATTER & CASE DOCKET',
      title: 'Makati Residential Lease Deposit Dispute & Formal Notice to Vacate',
      content:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    },
    {
      id: 2,
      docket: 'SUBJECT MATTER & CASE DOCKET',
      title: 'Makati Residential Lease Deposit Dispute & Formal Notice to Vacate',
      content:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    },
    {
      id: 3,
      docket: 'SUBJECT MATTER & CASE DOCKET',
      title: 'Makati Residential Lease Deposit Dispute & Formal Notice to Vacate',
      content:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    },
    {
      id: 4,
      docket: 'SUBJECT MATTER & CASE DOCKET',
      title: 'Makati Residential Lease Deposit Dispute & Formal Notice to Vacate',
      content:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-7 select-none animate-in fade-in duration-200">
      {/* ─── Back Navigation Link (Encapsulated with Rise Look) ────────────────── */}
      <div className="flex items-center justify-start pb-1">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="neu-raised-sm bg-[#E5D8CB] hover:bg-[#D39758]/20 rounded-[12px] px-4 py-2 inline-flex items-center gap-2.5 font-lora text-xs sm:text-[13px] font-semibold text-[#341512]/80 hover:text-[#341512] transition-all hover:brightness-102 active:scale-97 cursor-pointer select-none"
          >
            <svg className="w-4 h-4 text-[#341512]/80 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Lawyers Directory</span>
          </button>
        ) : (
          <Link
            href="/client/lawyers"
            className="neu-raised-sm bg-[#E5D8CB] hover:bg-[#D39758]/20 rounded-[12px] px-4 py-2 inline-flex items-center gap-2.5 font-lora text-xs sm:text-[13px] font-semibold text-[#341512]/80 hover:text-[#341512] transition-all hover:brightness-102 active:scale-97 cursor-pointer select-none"
          >
            <svg className="w-4 h-4 text-[#341512]/80 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Lawyers Directory</span>
          </Link>
        )}
      </div>

      {/* ─── Lawyer Banner Header Card ───────── */}
      <div className="neu-raised-highlight w-full rounded-[20px] sm:rounded-[22px] px-6 py-5 sm:px-8 sm:py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 transition-all select-none">
        <div className="flex items-center gap-4 sm:gap-6">
          {/* Avatar */}
          {lawyer.photoUrl ? (
            <img
              src={lawyer.photoUrl}
              alt={lawyer.fullName}
              className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-full shrink-0"
            />
          ) : (
            <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 flex items-center justify-center text-[#341512]/80">
              <svg className="w-full h-full" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="4.2">
                <circle cx="32" cy="32" r="28" />
                <circle cx="32" cy="24" r="8" />
                <path d="M16 48c0-8.837 7.163-14 16-14s16 5.163 16 14" strokeLinecap="round" />
              </svg>
            </div>
          )}

          {/* Lawyer Info */}
          <div className="space-y-1">
            <h1 className="font-lora text-xl sm:text-2xl font-bold text-[#341512]/80 leading-snug">
              {lawyer.fullName}{lawyer.fullName.includes(',') ? '' : ', Ll.B.'}
            </h1>
            <p className="text-xs sm:text-[13px] text-[#341512]/80 font-inter font-normal leading-tight">
              Roll No. {lawyer.rollNumber || '58942'} <span className="mx-2 text-[#341512]/80">|</span> IBP {lawyer.ibpChapter?.toUpperCase() || 'MAKATI'}
            </p>
            <div className="flex items-center gap-1.5 text-xs sm:text-[13px] text-[#341512]/80 font-inter">
              <svg className="w-3.5 h-3.5 fill-transparent stroke-current text-[#341512]/80" viewBox="0 0 20 20" strokeWidth="1.6">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span>{averageRating.toFixed(1)} ({totalReviewsCount} Reviews)</span>
              <span className="mx-1">•</span>
              <span>{lawyer.experienceYears ?? 9} years of practice</span>
            </div>
            <p className="text-xs sm:text-[13px] text-[#341512]/80 font-inter">
              {lawyer.practiceAreas && lawyer.practiceAreas.length > 0
                ? lawyer.practiceAreas.join(' • ')
                : 'Labor & Employment • Corporate • Civil Law'}
            </p>
          </div>
        </div>

        {/* Rate on right side */}
        <div className="flex items-baseline md:justify-end gap-1 shrink-0 self-start md:self-center">
          <span className="font-lora text-2xl sm:text-3xl font-bold text-[#341512]/80">
            ₱{standardFee.toLocaleString()}
          </span>
          <span className="text-xs sm:text-sm font-inter text-[#341512]/80 font-normal">
            /per hour
          </span>
        </div>
      </div>

      {/* ─── Navigation Tabs ───── */}
      <div className="flex flex-wrap items-center gap-6 sm:gap-10 pt-1 pb-1 select-none">
        {[
          { key: 'about', label: 'About' },
          { key: 'reviews', label: 'Reviews' },
          { key: 'booking', label: 'Consultation Booking' },
          { key: 'cases', label: 'Cases Handled' },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as TabType)}
              className={`font-lora text-sm sm:text-base font-semibold transition-all cursor-pointer select-none ${isActive
                ? 'neu-raised-highlight-sm rounded-[12px] px-6 py-2 text-[#341512]/80'
                : 'px-2 py-1 text-[#341512]/80 hover:text-[#341512]'
                }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ─── TAB 1: ABOUT (Matches Figma Specs) ─────────────────────────────────── */}
      {activeTab === 'about' && (
        <div className="space-y-8 animate-in fade-in duration-150">
          {/* Top Row: Bio (flexible) & Consultation Rates (fixed width — edit the px value) */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_415px] gap-6 items-stretch">
            {/* Bio Card */}
            <div className="relative rounded-[20px] sm:rounded-[24px] neu-recessed bg-[#E5D8CB] flex flex-col max-h-[220px] sm:max-h-[235px] overflow-hidden">
              <div
                ref={bioRef}
                onScroll={updateBioFade}
                className="flex-1 min-h-0 overflow-y-auto neu-scrollbar-discrete space-y-3 py-6 sm:py-7 pl-6 sm:pl-7 pr-3 sm:pr-4 mr-1.5"
              >
                <p className="text-xs sm:text-[13px] text-[#341512]/80 leading-relaxed text-justify font-inter">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
                </p>
              </div>
            </div>

            {/* Consultation Rates Card */}
            <div className="rounded-[20px] sm:rounded-[24px] px-6 py-6 sm:px-7 sm:py-7 neu-raised-highlight flex flex-col justify-center space-y-4 sm:space-y-5">
              <h3 className="font-lora text-xl sm:text-2xl font-bold text-[#341512]/80 text-center">
                Consultation Rates:
              </h3>

              <div className="space-y-3.5 sm:space-y-4 font-inter text-[#341512]/80">
                <div className="flex justify-between items-baseline gap-4">
                  <span className="text-xs sm:text-[15px] font-lora font-medium text-[#341512]/80">Initial Consultation (30 mins)</span>
                  <div className="text-right shrink-0 whitespace-nowrap">
                    <span className="font-lora font-bold text-sm sm:text-base text-[#341512]/80">₱{initialFee.toLocaleString()}</span>
                    <span className="text-xs sm:text-[13px] text-[#341512]/80 ml-0.5">/per hour</span>
                  </div>
                </div>

                <div className="flex justify-between items-baseline gap-4">
                  <span className="text-xs sm:text-[15px] font-lora font-medium text-[#341512]/80">Standard Consultation (1 hr)</span>
                  <div className="text-right shrink-0 whitespace-nowrap">
                    <span className="font-lora font-bold text-sm sm:text-base text-[#341512]/80">₱{standardFee.toLocaleString()}</span>
                    <span className="text-xs sm:text-[13px] text-[#341512]/80 ml-0.5">/per hour</span>
                  </div>
                </div>

                <div className="flex justify-between items-baseline gap-4">
                  <span className="text-xs sm:text-[15px] font-lora font-medium text-[#341512]/80">Extended Consultation (2 hrs)</span>
                  <div className="text-right shrink-0 whitespace-nowrap">
                    <span className="font-lora font-bold text-sm sm:text-base text-[#341512]/80">₱{extendedFee.toLocaleString()}</span>
                    <span className="text-xs sm:text-[13px] text-[#341512]/80 ml-0.5">/per hour</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Professional Background Section */}
          <div className="space-y-4">
            <h2 className="font-lora text-xl sm:text-2xl font-bold text-[#341512]/80">Professional Background</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
              {/* Areas of Practice */}
              <div className="neu-card-recessed-to-rise rounded-[20px] sm:rounded-[24px] p-6 space-y-3 cursor-default">
                <div className="flex items-center gap-3.5">
                  <svg className="w-8 h-8 text-[#341512]/80 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                  </svg>
                  <h4 className="font-lora font-bold text-base sm:text-lg text-[#341512]/80">Areas of Practice</h4>
                </div>
                <ul className="space-y-1.5 text-xs sm:text-[13px] text-[#341512]/80 leading-relaxed font-inter">
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0 text-[#341512]/80">●</span>
                    <span>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0 text-[#341512]/80">●</span>
                    <span>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0 text-[#341512]/80">●</span>
                    <span>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</span>
                  </li>
                </ul>
              </div>

              {/* Legal Experience */}
              <div className="neu-card-recessed-to-rise rounded-[20px] sm:rounded-[24px] p-6 space-y-3 cursor-default">
                <div className="flex items-center gap-3.5">
                  <svg className="w-8 h-8 text-[#341512]/80 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14 13-7.5 7.5a2.12 2.12 0 1 1-3-3L11 10" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="m16 16 6-6" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8 8 6-6" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="m9 7 8 8" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 11-8-8" />
                  </svg>
                  <h4 className="font-lora font-bold text-base sm:text-lg text-[#341512]/80">Legal Experience</h4>
                </div>
                <ul className="space-y-1.5 text-xs sm:text-[13px] text-[#341512]/80 leading-relaxed font-inter">
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0 text-[#341512]/80">●</span>
                    <span>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0 text-[#341512]/80">●</span>
                    <span>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0 text-[#341512]/80">●</span>
                    <span>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</span>
                  </li>
                </ul>
              </div>

              {/* Consultation Services */}
              <div className="neu-card-recessed-to-rise rounded-[20px] sm:rounded-[24px] p-6 space-y-3 cursor-default">
                <div className="flex items-center gap-3.5">
                  <svg className="w-8 h-8 text-[#341512]/80 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 6.75 3.19-1.595A3 3 0 0 1 7.234 16H18a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v12.75Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 16v2.25a2.25 2.25 0 0 1-2.25 2.25H9.75l-2.25 1.125" />
                  </svg>
                  <h4 className="font-lora font-bold text-base sm:text-lg text-[#341512]/80">Consultation Services</h4>
                </div>
                <ul className="space-y-1.5 text-xs sm:text-[13px] text-[#341512]/80 leading-relaxed font-inter">
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0 text-[#341512]/80">●</span>
                    <span>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0 text-[#341512]/80">●</span>
                    <span>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0 text-[#341512]/80">●</span>
                    <span>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</span>
                  </li>
                </ul>
              </div>

              {/* Philippine Bar Examination Passer */}
              <div className="neu-card-recessed-to-rise rounded-[20px] sm:rounded-[24px] p-6 space-y-3 cursor-default">
                <div className="flex items-center gap-3.5">
                  <svg className="w-8 h-8 text-[#341512]/80 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="8" r="5.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 13.5 17.5 21l-5.5-2.75L6.5 21l2-7.5" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 8 1.5 1.5 3-3" />
                  </svg>
                  <h4 className="font-lora font-bold text-base sm:text-lg text-[#341512]/80">
                    Philippine Bar Examination Passer ({lawyer.barPasserYear ?? 2022})
                  </h4>
                </div>
                <ul className="space-y-1.5 text-xs sm:text-[13px] text-[#341512]/80 leading-relaxed font-inter">
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0 text-[#341512]/80">●</span>
                    <span>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0 text-[#341512]/80">●</span>
                    <span>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0 text-[#341512]/80">●</span>
                    <span>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Educational Background Section */}
          <div className="space-y-4">
            <h2 className="font-lora text-xl sm:text-2xl font-bold text-[#341512]/80">Educational Background</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
              {/* Card 1: Juris Doctor */}
              <div className="neu-card-recessed-to-rise rounded-[20px] sm:rounded-[24px] p-6 space-y-3 cursor-default">
                <div className="flex items-center gap-3.5">
                  {/* Scales of Justice Icon */}
                  <svg className="w-8 h-8 text-[#341512]/80 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 3v18M7 21h10M3 7h18" />
                    <path d="M6 7l-3 7c0 1.5 1.5 2.5 3 2.5s3-1 3-2.5L6 7z" />
                    <path d="M18 7l-3 7c0 1.5 1.5 2.5 3 2.5s3-1 3-2.5L18 7z" />
                  </svg>
                  <div>
                    <h4 className="font-lora font-bold text-base sm:text-lg text-[#341512]/80 leading-tight">
                      Juris Doctor (2017 - 2021)
                    </h4>
                    <p className="text-xs text-[#341512]/80 font-inter">University of the Philippines - Cebu</p>
                  </div>
                </div>

                <ul className="space-y-1.5 text-xs sm:text-[13px] text-[#341512]/80 leading-relaxed pt-1 font-inter">
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0 text-[#341512]/80">●</span>
                    <span>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0 text-[#341512]/80">●</span>
                    <span>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0 text-[#341512]/80">●</span>
                    <span>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</span>
                  </li>
                </ul>
              </div>

              {/* Card 2: Bachelor of Arts in Political Science */}
              <div className="neu-card-recessed-to-rise rounded-[20px] sm:rounded-[24px] p-6 space-y-3 cursor-default">
                <div className="flex items-center gap-3.5">
                  {/* Graduation Cap / Diploma Icon */}
                  <svg className="w-8 h-8 text-[#341512]/80 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                    <path d="M6 12v5c3 3 9 3 12 0v-5" />
                  </svg>
                  <div>
                    <h4 className="font-lora font-bold text-base sm:text-lg text-[#341512]/80 leading-tight">
                      Bachelor of Arts in Political Science (2013 - 2017)
                    </h4>
                    <p className="text-xs text-[#341512]/80 font-inter">University of San Carlos - Main Campus</p>
                  </div>
                </div>

                <ul className="space-y-1.5 text-xs sm:text-[13px] text-[#341512]/80 leading-relaxed pt-1 font-inter">
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0 text-[#341512]/80">●</span>
                    <span>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0 text-[#341512]/80">●</span>
                    <span>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0 text-[#341512]/80">●</span>
                    <span>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: REVIEWS (Matches Figma Specs) ───────────────────────────────── */}
      {activeTab === 'reviews' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {reviewsLoading && <p role="status">Loading reviews…</p>}
          {reviewsError && <p role="alert" className="text-red-700">{reviewsError}</p>}
          {/* Main Large Reviews Outer Container (Recessed Look) */}
          <div className="rounded-[28px] sm:rounded-[32px] p-6 sm:p-9 neu-recessed bg-[#E5D8CB] space-y-6 select-none">
            {/* Score header: 4.9/5 ★★★★★ (53 Reviews) */}
            <div className="flex flex-wrap items-baseline gap-2 sm:gap-3">
              <span className="font-lora text-4xl sm:text-5xl font-bold text-[#341512]/80 leading-none">
                {averageRating.toFixed(1)}
              </span>
              <span className="font-lora text-2xl sm:text-3xl font-bold text-[#341512]/80">
                /5
              </span>

              {/* Stars */}
              <div className="flex items-center gap-1 text-[#C58B3C] text-xl sm:text-2xl ml-2 sm:ml-4">
                {[1, 2, 3, 4, 5].map((s) => (
                  <StarIcon key={s} filled={s <= Math.round(averageRating)} className="w-5 h-5 sm:w-6 sm:h-6" />
                ))}
              </div>

              <span className="font-lora text-sm sm:text-base font-normal text-[#341512]/80 ml-2">
                ({totalReviewsCount} Reviews)
              </span>
            </div>

            {/* Filter pills: ★ 5, ★ 4, ★ 3, ★ 2, ★ 1 */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-1">
              {[5, 4, 3, 2, 1].map((s) => {
                const isActive = selectedReviewStar === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setSelectedReviewStar((prev) => (prev === s ? 'all' : s));
                      setReviewPage(1);
                    }}
                    className={`rounded-[12px] px-5 py-1.5 sm:px-6 sm:py-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer select-none inline-flex items-center gap-1.5 ${
                      isActive
                        ? 'neu-raised-highlight-sm text-[#341512]/80'
                        : 'neu-raised-sm bg-[#E5D8CB] hover:bg-[#D39758]/20 text-[#341512]/80'
                    }`}
                  >
                    <StarIcon filled className="w-3.5 h-3.5 text-[#C58B3C]" />
                    <span className="font-lora font-bold text-[#341512]/80">{s}</span>
                  </button>
                );
              })}
            </div>

            {/* Review Cards Stack */}
            <div className="space-y-4 pt-1">
              {pagedReviews.map((rev) => (
                <div
                  key={rev.id}
                  className="neu-raised-highlight rounded-[18px] sm:rounded-[20px] p-5 sm:p-6 space-y-2.5 transition-all select-none"
                >
                  {/* Header: Avatar, Name, Stars, Date */}
                  <div className="flex items-center gap-3.5">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 flex items-center justify-center text-[#341512]/80">
                      <svg className="w-full h-full" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="4.2">
                        <circle cx="32" cy="32" r="28" />
                        <circle cx="32" cy="24" r="8" />
                        <path d="M16 48c0-8.837 7.163-14 16-14s16 5.163 16 14" strokeLinecap="round" />
                      </svg>
                    </div>

                    <div>
                      <h4 className="font-lora font-bold text-sm sm:text-base text-[#341512]/80 leading-tight">
                        {rev.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex items-center text-[#C58B3C]">
                          {[1, 2, 3, 4, 5].map((st) => (
                            <StarIcon key={st} filled={st <= rev.stars} className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          ))}
                        </div>
                        <span className="text-[10px] sm:text-[11px] text-[#341512]/70 font-inter">
                          {rev.date}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Body Text */}
                  <p className="text-xs sm:text-[13px] text-[#341512]/80 leading-relaxed text-justify font-inter">
                    {rev.content}
                  </p>

                  {/* Helpful feedback */}
                  <div className="flex items-center gap-4 pt-1 text-[11px] font-medium text-[#341512]/80 font-inter">
                    <button
                      type="button"
                      onClick={() => toggleHelpful(rev.id)}
                      className="inline-flex items-center gap-1.5 hover:text-[#341512] transition-colors cursor-pointer"
                    >
                      <svg
                        className={`w-3.5 h-3.5 ${userVotedHelpful[rev.id] ? 'fill-current text-[#C58B3C]' : 'text-[#341512]/80'}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                      </svg>
                      <span>Helpful?</span>
                    </button>
                  </div>

                  {/* Attorney Reply Bubble if present */}
                  {rev.reply && (
                    <div className="mt-2 p-3.5 rounded-[14px] bg-[#E5D8CB]/80 neu-recessed text-xs space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#341512]/80 font-lora">
                        <ScalesIcon className="w-3.5 h-3.5 text-[#C58B3C]" />
                        <span>Response from {lawyer.fullName}</span>
                      </div>
                      <p className="text-[#341512]/80 text-xs leading-relaxed font-inter">{rev.reply}</p>
                    </div>
                  )}

                </div>
              ))}

              {filteredReviews.length === 0 && (
                <div className="py-10 text-center text-xs text-[#341512]/80 font-lora">
                  {reviewsLoading ? 'Loading reviews…' : reviewsError ? 'Reviews are currently unavailable.' : reviewsList.length === 0 ? 'No consultation reviews yet.' : 'No reviews match this rating.'}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Pagination matching Figma: < ● ● ● ● > */}
          {totalReviewPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-3 pb-4">
              <button
                type="button"
                onClick={() => setReviewPage((p) => Math.max(1, p - 1))}
                disabled={reviewPage <= 1}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full neu-raised-sm bg-[#E5D8CB] hover:bg-[#D39758]/20 flex items-center justify-center text-[#341512]/80 hover:text-[#341512] disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer"
                aria-label="Previous reviews page"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div className="flex items-center gap-2.5">
                {Array.from({ length: totalReviewPages }).map((_, idx) => {
                  const p = idx + 1;
                  const isActive = p === reviewPage;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setReviewPage(p)}
                      className={`rounded-full transition-all cursor-pointer ${
                        isActive
                          ? 'w-2.5 h-2.5 bg-[#D39758] scale-125'
                          : 'w-2 h-2 bg-[#341512]/70 hover:bg-[#341512]'
                      }`}
                      aria-label={`Go to review page ${p}`}
                    />
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setReviewPage((p) => Math.min(totalReviewPages, p + 1))}
                disabled={reviewPage >= totalReviewPages}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full neu-raised-sm bg-[#E5D8CB] hover:bg-[#D39758]/20 flex items-center justify-center text-[#341512]/80 hover:text-[#341512] disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer"
                aria-label="Next reviews page"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: CONSULTATION BOOKING (Matches Image 3) ───────────────────── */}
      {activeTab === 'booking' && (
        <form onSubmit={handleSubmitBooking} className="space-y-8 animate-in fade-in duration-150">
          {/* Confirmation Feedback */}
          {bookingStatus === 'saved' && (
            <div className="p-4 rounded-2xl bg-amber-100/90 border border-amber-300 text-amber-900 text-xs sm:text-sm flex items-center justify-between">
              <span>✓ Consultation draft details saved. You can complete your submission anytime.</span>
              <button type="button" onClick={() => setBookingStatus('idle')} className="font-bold">✕</button>
            </div>
          )}

          {/* Calendar & Time Slots Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Calendar Card (Left - 8 cols) */}
            <div
              className="lg:col-span-8 rounded-[28px] p-6 sm:p-8 bg-[#E5D8CB] flex flex-col justify-between"
              style={{
                boxShadow:
                  '12px 12px 30px rgba(182, 155, 130, 0.4), -12px -12px 30px #FFFFFF, 3px 3px 8px rgba(182, 155, 130, 0.2), -3px -3px 8px #FFFFFF',
              }}
            >
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6 sm:gap-10">
                {/* Big Date Highlight */}
                <div className="text-center sm:text-left sm:pr-8 sm:border-r border-[#D1BEA8]/80 shrink-0 min-w-[120px]">
                  <div className="font-lora text-base font-bold uppercase tracking-widest text-[#4A3525]">
                    {selectedMonthShort}
                  </div>
                  <div className="font-lora text-6xl sm:text-7xl font-bold text-[#C58B3C] leading-none my-1">
                    {selectedDay}
                  </div>
                  <div className="font-lora text-xs sm:text-sm font-bold tracking-widest uppercase text-[#4A3525]">
                    {selectedDayOfWeek}
                  </div>
                </div>

                {/* Mini Calendar Grid with Month Switcher Controls */}
                <div className="flex-1 w-full max-w-sm sm:max-w-none">
                  {/* Month Navigation Bar */}
                  <div className="flex items-center justify-between pb-3 px-1">
                    <span className="font-lora text-base sm:text-lg font-bold text-[#4A3525] tracking-wide">
                      {selectedMonthName} {currentYear}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleGoToToday}
                        className="px-2.5 py-0.5 rounded-full bg-[#E5D8CB] hover:bg-[#D5C2AB] text-[#34150F] text-[10px] font-bold uppercase tracking-wider transition-colors shadow-xs"
                        title="Snap to Today"
                      >
                        Today
                      </button>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handlePrevMonth}
                          className="w-7 h-7 rounded-full bg-[#E5D8CB] hover:bg-[#D5C2AB] text-[#34150F] flex items-center justify-center font-bold text-sm transition-colors shadow-xs active:scale-95"
                          title="Previous Month"
                          aria-label="Previous Month"
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          onClick={handleNextMonth}
                          className="w-7 h-7 rounded-full bg-[#E5D8CB] hover:bg-[#D5C2AB] text-[#34150F] flex items-center justify-center font-bold text-sm transition-colors shadow-xs active:scale-95"
                          title="Next Month"
                          aria-label="Next Month"
                        >
                          ›
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Day of Week Headers */}
                  <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center pb-3 text-[11px] sm:text-xs font-bold text-[#4A3525] uppercase tracking-wider">
                    <span>SUN</span>
                    <span>MON</span>
                    <span>TUE</span>
                    <span>WED</span>
                    <span>THU</span>
                    <span>FRI</span>
                    <span>SAT</span>
                  </div>

                  {/* Dynamic Days in Month Grid */}
                  <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-xs">
                    {daysInMonth.map((item, idx) => {
                      if (!item.day) {
                        return <div key={`empty-${idx}`} className="h-8 w-8" />;
                      }
                      const isSelected = item.day === selectedDay;
                      const today = getTodayPH();
                      const isToday =
                        item.day === today.day &&
                        currentMonth === today.month &&
                        currentYear === today.year;

                      return (
                        <button
                          key={`day-${item.day}`}
                          type="button"
                          onClick={() => setSelectedDay(item.day!)}
                          className={`h-8 w-8 mx-auto rounded-full flex flex-col items-center justify-center font-medium text-xs transition-all cursor-pointer relative ${isSelected
                            ? 'bg-[#E5D8CB] text-[#C58B3C] font-bold shadow-[inset_1px_1px_3px_rgba(0,0,0,0.18)] scale-105'
                            : isToday
                              ? 'text-[#23150F] font-bold border border-[#C58B3C]/60 bg-[#E8DDD0]'
                              : 'text-[#3E2A1E] hover:bg-[#DECEB8] hover:text-[#23150F]'
                            }`}
                        >
                          <span>{String(item.day).padStart(2, '0')}</span>
                          {isToday && !isSelected && (
                            <span className="w-1 h-1 rounded-full bg-[#C58B3C] -mt-0.5" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Time Slots Card (Right - 4 cols) */}
            <div
              className="lg:col-span-4 rounded-[28px] p-6 bg-[#E5D8CB] flex flex-col justify-center space-y-3"
              style={{
                boxShadow:
                  '12px 12px 30px rgba(182, 155, 130, 0.4), -12px -12px 30px #FFFFFF, 3px 3px 8px rgba(182, 155, 130, 0.2), -3px -3px 8px #FFFFFF',
              }}
            >
              {timeSlots.map((slot) => {
                const isSelected = selectedTimeSlot === slot;
                const isBooked = isSlotBooked(slot);
                return (
                  <button
                    key={slot}
                    type="button"
                    disabled={isBooked}
                    onClick={() => !isBooked && setSelectedTimeSlot(slot)}
                    className={`w-full py-2.5 px-3 rounded-full text-xs font-medium transition-all text-center relative ${isBooked
                      ? 'opacity-40 cursor-not-allowed bg-stone-300 text-stone-500 line-through'
                      : isSelected
                        ? 'bg-[#E5D8CB] text-[#23150F] font-bold shadow-[inset_2px_2px_4px_rgba(0,0,0,0.14),inset_-2px_-2px_4px_rgba(255,255,255,0.7)]'
                        : 'bg-[#E6D7C3] hover:bg-[#E5D8CB]/60 text-[#5C4535] shadow-[2px_2px_5px_rgba(182,155,130,0.25)]'
                      }`}
                  >
                    <span>{slot}</span>
                    {isBooked && (
                      <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-rose-700 not-italic no-underline">
                        (Booked)
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mode of Communication Section */}
          <div className="space-y-3">
            <h2 className="font-lora text-2xl font-bold text-[#23150F]">Mode of Communication</h2>
            <div
              className="rounded-[28px] p-5 sm:p-6 bg-[#E5D8CB] space-y-3"
              style={{
                boxShadow:
                  '12px 12px 30px rgba(182, 155, 130, 0.4), -12px -12px 30px #FFFFFF, 3px 3px 8px rgba(182, 155, 130, 0.2), -3px -3px 8px #FFFFFF',
              }}
            >
              {/* Option 1: Video Consultation */}
              <div
                onClick={() => setCommunicationMode('video')}
                className={`flex items-start gap-3.5 p-4 rounded-[20px] cursor-pointer transition-all ${communicationMode === 'video'
                  ? 'bg-[#E5D8CB] shadow-[4px_5px_12px_rgba(165,135,105,0.35),-3px_-3px_8px_rgba(255,255,255,0.85)]'
                  : 'bg-transparent hover:bg-[#E5D8CB]/50'
                  }`}
              >
                <div className="mt-0.5">
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${communicationMode === 'video' ? 'border-[#23150F]' : 'border-[#7D6855]'
                      }`}
                  >
                    {communicationMode === 'video' && <div className="w-2 h-2 rounded-full bg-[#23150F]" />}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#23150F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs sm:text-sm font-bold text-[#23150F]">Video Consultation</span>
                    <span className="text-[9px] uppercase tracking-wider font-bold bg-[#E5D8CB] text-[#9E6C28] px-2 py-0.5 rounded-full ml-1">
                      Recommended
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-[#5C4535] leading-relaxed">
                    Meet your attorney face-to-face online through Google Meet. Once the attorney confirms your booking, a private Google Meet link will be sent to you and will appear in your Consultations tab. Join a few minutes early from a quiet, private place with a stable internet connection, test your camera and microphone, and keep your documents ready to share on screen.
                  </p>
                </div>
              </div>

              {/* Option 2: Audio Call */}
              <div
                onClick={() => setCommunicationMode('audio')}
                className={`flex items-start gap-3.5 p-4 rounded-[20px] cursor-pointer transition-all ${communicationMode === 'audio'
                  ? 'bg-[#E5D8CB] shadow-[4px_5px_12px_rgba(165,135,105,0.35),-3px_-3px_8px_rgba(255,255,255,0.85)]'
                  : 'bg-transparent hover:bg-[#E5D8CB]/50'
                  }`}
              >
                <div className="mt-0.5">
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${communicationMode === 'audio' ? 'border-[#23150F]' : 'border-[#7D6855]'
                      }`}
                  >
                    {communicationMode === 'audio' && <div className="w-2 h-2 rounded-full bg-[#23150F]" />}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#23150F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <span className="text-xs sm:text-sm font-bold text-[#23150F]">Audio Call</span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-[#5C4535] leading-relaxed">
                    Speak with your attorney by voice only through Google Meet. Once the attorney confirms your booking, a private Google Meet link will be sent to you and will appear in your Consultations tab. Join a few minutes early from a quiet, private place, test your microphone and speakers, and keep your camera off for the entire call.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Purpose of Consultation Section */}
          <div className="space-y-3">
            <h2 className="font-lora text-2xl font-bold text-[#23150F]">Purpose of Consultation</h2>
            <div
              className="rounded-[28px] p-6 sm:p-8 bg-[#E5D8CB] space-y-5"
              style={{
                boxShadow:
                  '12px 12px 30px rgba(182, 155, 130, 0.4), -12px -12px 30px #FFFFFF, 3px 3px 8px rgba(182, 155, 130, 0.2), -3px -3px 8px #FFFFFF',
              }}
            >
              {/* Subject Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#5C4535]">Subject:</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., Makati Residential Lease: Deposit Dispute & Formal Notice to Vacate"
                  className="w-full rounded-2xl py-3 px-4 bg-[#E4D5C2] text-xs sm:text-sm text-[#23150F] placeholder:text-[#9E8E7D] focus:outline-none"
                  style={{
                    boxShadow:
                      'inset 3px 3px 6px rgba(165, 140, 115, 0.45), inset -3px -3px 6px rgba(255, 255, 255, 0.85)',
                  }}
                />
              </div>

              {/* Subject Description */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#5C4535]">Subject Description:</label>
                <textarea
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide concise facts, key contract dates, and specific legal queries for counsel to review..."
                  className="w-full rounded-2xl py-3 px-4 bg-[#E4D5C2] text-xs sm:text-sm text-[#23150F] placeholder:text-[#9E8E7D] focus:outline-none resize-y"
                  style={{
                    boxShadow:
                      'inset 3px 3px 6px rgba(165, 140, 115, 0.45), inset -3px -3px 6px rgba(255, 255, 255, 0.85)',
                  }}
                />
              </div>

              {/* File Attachments Dropzone */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#5C4535]">File Attachments</label>
                <label
                  className={`w-full py-9 px-6 rounded-2xl flex flex-col items-center justify-center text-center transition-all block relative ${isDraggingFiles ? 'bg-[#DECDBA]' : 'bg-[#E4D5C2] hover:bg-[#DECDBA]'
                    } ${isUploadingAttachment ? 'cursor-wait opacity-80' : 'cursor-pointer'}`}
                  style={{
                    boxShadow:
                      'inset 3px 3px 6px rgba(165, 140, 115, 0.45), inset -3px -3px 6px rgba(255, 255, 255, 0.85)',
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!isDraggingFiles) setIsDraggingFiles(true);
                  }}
                  onDragLeave={() => setIsDraggingFiles(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingFiles(false);
                    handleAttachLocalFiles(e.dataTransfer.files);
                  }}
                >
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    disabled={isUploadingAttachment}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.txt,.mp4"
                    onChange={(e) => {
                      const input = e.target;
                      handleAttachLocalFiles(input.files ? Array.from(input.files) : null).finally(() => {
                        input.value = '';
                      });
                    }}
                  />
                  <svg className="w-9 h-9 text-[#7D6855] mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span className="text-xs text-[#5C4535] font-semibold mt-2.5 block">
                    {isUploadingAttachment
                      ? 'Uploading to My Documents...'
                      : 'Click to browse files or Drag & Drop case documents'}
                  </span>
                  <span className="text-[10px] text-[#8C7A6B] mt-0.5 block">
                    Attach contracts, demand letters, or evidence (PDF, DOCX, XLSX, Images)
                  </span>
                </label>

                {/* Attached Files List */}
                {attachedFiles.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {attachedFiles.map((file) => (
                      <div key={file.id} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#E5D8CB]/60 text-xs text-[#23150F]">
                        <div className="flex items-center gap-1.5 truncate"><PaperclipIcon className="w-3.5 h-3.5 text-[#C58B3C] shrink-0" /><span className="truncate">{file.name}</span><span className="text-[10px] text-[#7D6855] shrink-0">{file.size}</span></div>
                        <button
                          type="button"
                          aria-label={`Remove ${file.name}`}
                          onClick={() => setAttachedFiles((prev) => prev.filter((f) => f.id !== file.id))}
                          className="text-red-700 hover:text-red-900 font-bold ml-2"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="text-center py-1">
                  <span className="text-[11px] font-bold tracking-widest text-[#7D6855] uppercase">OR</span>
                </div>

                <button
                  type="button"
                  onClick={handleOpenDocPicker}
                  className="neu-raised-sm bg-[#E5D8CB] px-8 py-2.5 rounded-full text-xs sm:text-sm font-inter font-semibold text-[#34150F] hover:text-[#C58B3C] active:scale-95 transition-all mx-auto block cursor-pointer select-none"
                >
                  Share Uploaded Files from your Documents
                </button>
              </div>

              {bookingError && (
                <div className="p-3 rounded-xl bg-rose-100 border border-rose-300 text-rose-900 text-xs font-semibold">
                  <span className="flex items-center gap-1.5"><svg className="w-4 h-4 text-rose-600 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg><span>{bookingError}</span></span>
                </div>
              )}

              {/* Privilege Agreement Checkbox */}
              <label className="flex items-start gap-3 cursor-pointer pt-3">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 rounded border-[#C8B59E] text-[#C58B3C] focus:ring-[#C58B3C] w-4 h-4 cursor-pointer"
                />
                <span className="text-xs text-[#5C4535] leading-relaxed select-none">
                  I agree that this intake form and attached records will be reviewed strictly under confidential attorney-client privilege prior to the scheduled consultation session.
                </span>
              </label>
            </div>
          </div>

          {/* Action Buttons Row */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={handleClearInputs}
              className="w-full sm:w-auto px-6 py-2 rounded-xl border border-[#C8B59E] text-xs font-medium text-[#5C4535] hover:bg-[#E5D8CB] transition-colors"
            >
              Clear All Inputs
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              className="neu-raised-sm bg-[#E5D8CB] w-full sm:w-auto px-8 py-2.5 rounded-full text-xs font-inter font-semibold text-[#5C4535] hover:text-[#34150F] active:scale-95 transition-all cursor-pointer select-none"
            >
              Save
            </button>
          </div>

          {/* Divider Line */}
          <hr className="border-[#D1BEA8]/80 my-8" />

          {/* Centered Large Submit Button */}
          <div className="pt-2 pb-6">
            <button
              type="submit"
              className="neu-btn-caramel w-full max-w-xs mx-auto block py-3 px-10 rounded-full text-sm sm:text-base font-lora font-bold text-white text-center transition-all cursor-pointer shadow-md active:scale-95"
            >
              {submittingBooking ? 'Submitting Request...' : 'Submit Booking'}
            </button>
          </div>
        </form>
      )}

      {/* ─── TAB 4: CASES HANDLED (Matches Image 2) ─────────────────────────── */}
      {activeTab === 'cases' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* Stack of 4 Case Cards matching Figma */}
          {casesHandled.map((caseItem) => (
            <div
              key={caseItem.id}
              className="rounded-[28px] p-6 sm:p-8 bg-[#E5D8CB] space-y-2.5"
              style={{
                boxShadow:
                  '12px 12px 30px rgba(182, 155, 130, 0.4), -12px -12px 30px #FFFFFF, 3px 3px 8px rgba(182, 155, 130, 0.2), -3px -3px 8px #FFFFFF',
              }}
            >
              <div className="font-bold text-[10px] sm:text-[11px] text-[#C58B3C] uppercase tracking-wider">
                {caseItem.docket}
              </div>
              <h3 className="font-lora text-lg sm:text-xl font-bold text-[#23150F] leading-tight">
                {caseItem.title}
              </h3>
              <p className="text-xs sm:text-[13px] text-[#3E2A1E] leading-relaxed text-justify">
                {caseItem.content}
              </p>
            </div>
          ))}

          {/* Bottom Pagination matching Figma: < ● ● ● ● > */}
          <div className="flex items-center justify-center gap-4 pt-3 pb-4">
            <button
              type="button"
              onClick={() => setCasePage((p) => Math.max(1, p - 1))}
              disabled={casePage <= 1}
              className="w-9 h-9 rounded-full bg-[#E5D8CB] flex items-center justify-center text-[#5C4535] hover:text-[#23150F] disabled:opacity-30 transition-all"
              style={{
                boxShadow:
                  '4px 4px 10px rgba(182, 155, 130, 0.35), -4px -4px 10px #FFFFFF',
              }}
              aria-label="Previous cases page"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="flex items-center gap-2">
              {[1, 2, 3, 4].map((p) => {
                const isActive = p === casePage;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCasePage(p)}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${isActive ? 'bg-[#362519] scale-125' : 'bg-[#C58B3C]/80 hover:bg-[#362519]'
                      }`}
                    aria-label={`Go to case page ${p}`}
                  />
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setCasePage((p) => Math.min(4, p + 1))}
              disabled={casePage >= 4}
              className="w-9 h-9 rounded-full bg-[#E5D8CB] flex items-center justify-center text-[#5C4535] hover:text-[#23150F] disabled:opacity-30 transition-all"
              style={{
                boxShadow:
                  '4px 4px 10px rgba(182, 155, 130, 0.35), -4px -4px 10px #FFFFFF',
              }}
              aria-label="Next cases page"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ─── Share From My Documents Vault Modal ─────────────────────────────── */}
      {showDocPickerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div
            className="w-full max-w-3xl rounded-[32px] p-6 sm:p-8 bg-[#E5D8CB] space-y-5 max-h-[90vh] flex flex-col"
            style={{
              boxShadow: '16px 16px 40px rgba(0,0,0,0.35), -8px -8px 24px #FFFFFF',
            }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#D1BEA8]/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#E5D8CB] flex items-center justify-center text-xl shadow-xs">

                </div>
                <div>
                  <h3 className="font-lora text-2xl font-bold text-[#23150F] leading-tight">
                    My Documents Vault
                  </h3>
                  <p className="text-xs text-[#5C4535]">
                    Select records or upload documents from your vault to attach to this consultation.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDocPickerModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#5C4535] hover:text-[#23150F] hover:bg-[#E5D8CB]/40 font-bold transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Notification Notice */}
            {pickerNotice && (
              <div className="p-3 rounded-2xl bg-[#E2D4C1] border border-[#C5B099] text-xs font-medium text-[#23150F] flex items-center justify-between">
                <span>{pickerNotice}</span>
                <button
                  type="button"
                  onClick={() => setPickerNotice(null)}
                  className="text-[#7D6855] hover:text-[#23150F] font-bold ml-2"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Quick Upload & Create Folder Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#E4D5C2]/80 border border-[#D5C2AB]">
              {/* Left: Quick Upload File */}
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={pickerFileInputRef}
                  className="hidden"
                  onChange={handlePickerFileUpload}
                />
                <button
                  type="button"
                  disabled={isUploadingPickerFile}
                  onClick={() => pickerFileInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-[#23150F] text-[#ded7cb] text-xs font-bold hover:bg-[#34150F] transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-60"
                >
                  {isUploadingPickerFile ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin text-[#ded7cb]" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <span>+</span>
                      <span>Upload to Vault</span>
                    </>
                  )}
                </button>
                <span className="text-[11px] text-[#7D6855] hidden sm:inline">
                  (PDF, Word, Images, Evidence)
                </span>
              </div>

              {/* Right: Quick Create Folder */}
              <form onSubmit={handleCreatePickerFolder} className="flex items-center gap-2">
                <input
                  type="text"
                  value={pickerNewFolderName}
                  onChange={(e) => setPickerNewFolderName(e.target.value)}
                  placeholder="New folder name..."
                  className="py-1.5 px-3 rounded-xl bg-[#EBE0D2] text-xs text-[#23150F] placeholder:text-[#9E8E7D] focus:outline-none w-40 sm:w-48 shadow-inner"
                />
                <button
                  type="submit"
                  disabled={isCreatingPickerFolder || !pickerNewFolderName.trim()}
                  className="px-3 py-1.5 rounded-xl bg-[#E5D8CB] text-xs font-bold text-[#23150F] hover:bg-[#D4B892] disabled:opacity-50 transition-all shadow-xs"
                >
                  {isCreatingPickerFolder ? 'Creating...' : '+ Folder'}
                </button>
              </form>
            </div>

            {/* Folder & Files Browser Layout */}
            <div className="flex-1 min-h-[260px] overflow-hidden flex flex-col sm:flex-row gap-4 border border-[#D1BEA8]/80 rounded-2xl p-3 bg-[#EAE0D2]/50">
              {/* Folders List (Left Sidebar) */}
              <div className="w-full sm:w-56 shrink-0 space-y-1.5 overflow-y-auto max-h-[280px] sm:max-h-full pr-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#7D6855] px-2 py-1">
                  Folders ({docPickerFolders.length})
                </div>

                {loadingDocPicker ? (
                  <div className="p-4 text-center text-xs text-[#7D6855]">Loading vault...</div>
                ) : docPickerFolders.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[#7D6855]">No folders yet.</div>
                ) : (
                  docPickerFolders.map((folder) => {
                    const isActive = activePickerFolderId === folder.id;
                    return (
                      <button
                        key={folder.id}
                        type="button"
                        onClick={() => setActivePickerFolderId(folder.id)}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-between ${isActive
                          ? 'bg-[#23150F] text-[#ded7cb] shadow-sm font-bold'
                          : 'bg-[#E5D8CB] text-[#23150F] hover:bg-[#E5D8CB]'
                          }`}
                      >
                        <span className="truncate"> {folder.name}</span>
                        <span className="text-[10px] opacity-75 shrink-0 ml-1">
                          {folder.files?.length || 0}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Files Grid / List (Right Content) */}
              <div className="flex-1 overflow-y-auto max-h-[300px] sm:max-h-full pl-1">
                {(() => {
                  const currentFolder = docPickerFolders.find((f) => f.id === activePickerFolderId) || docPickerFolders[0];
                  const files = currentFolder?.files || [];

                  if (!currentFolder) {
                    return (
                      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-xs text-[#7D6855]">
                        <p>No folder selected. Use the buttons above to create a folder or upload a file.</p>
                      </div>
                    );
                  }

                  if (files.length === 0) {
                    return (
                      <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-2">
                        <div className="text-[#7A6756]"><FileDocIcon className="w-8 h-8" /></div>
                        <p className="text-xs font-semibold text-[#23150F]">No files in this folder</p>
                        <p className="text-[11px] text-[#7D6855]">
                          Use "Upload to Vault" above to add documents to this folder.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between pb-1 text-[11px] font-bold text-[#7D6855]">
                        <span>FILES IN {currentFolder.name.toUpperCase()}</span>
                        <span>{files.length} available</span>
                      </div>

                      {files.map((file: any) => {
                        const isSelected = selectedDocPickerFiles.includes(file.id);
                        return (
                          <div
                            key={file.id || file.name}
                            onClick={() => handleToggleSelectDoc(file.id)}
                            className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${isSelected
                              ? 'bg-[#E5D8CB] border-[#C58B3C] shadow-sm text-[#23150F]'
                              : 'bg-[#E8DDD0] border-[#D8C7B5] hover:bg-[#E2D4C3] text-[#34150F]'
                              }`}
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => { }} // handled by parent onClick
                                className="w-4 h-4 rounded text-[#C58B3C] accent-[#C58B3C]"
                              />
                              <FileDocIcon className="w-4 h-4 text-[#7A6756]" />
                              <div className="truncate">
                                <div className="text-xs font-semibold truncate">{file.name}</div>
                                <div className="text-[10px] text-[#7D6855]">
                                  {file.size} • {file.updatedAt || 'Recent'}
                                </div>
                              </div>
                            </div>
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 ${isSelected ? 'bg-[#23150F] text-[#ded7cb]' : 'bg-[#D5C2AB] text-[#5C4535]'
                                }`}
                            >
                              {isSelected ? 'Selected' : 'Select'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-[#D1BEA8]/80">
              <span className="text-xs font-medium text-[#5C4535]">
                {selectedDocPickerFiles.length} file{selectedDocPickerFiles.length === 1 ? '' : 's'} selected
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowDocPickerModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-[#C8B59E] text-xs font-semibold text-[#5C4535] hover:bg-[#E5D8CB]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDocPicker}
                  disabled={selectedDocPickerFiles.length === 0}
                  className="px-6 py-2.5 rounded-xl bg-[#23150F] text-[#ded7cb] text-xs font-bold hover:bg-[#34150F] transition-all shadow-md disabled:opacity-40"
                >
                  Attach Selected ({selectedDocPickerFiles.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Booking Submitted: Pending Confirmation Summary (design1) ─────── */}
      {submittedConsultation && (
        <ConsultationSummaryModal
          data={clientConsultationToSummary(submittedConsultation)}
          onClose={() => setSubmittedConsultation(null)}
        />
      )}
    </div>
  );
}

export default LawyerDetailView;
