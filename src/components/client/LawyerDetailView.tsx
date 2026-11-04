'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { PublicLawyerProfile } from './LawyerGrid';
import {
  bookConsultationAction,
  getBookedSlotsForLawyer,
  getUserDocumentsDataAction,
  createDocumentFolderAction,
  uploadDocumentFileAction,
} from '@/app/actions/consultationActions';
import { useRef } from 'react';

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

export function LawyerDetailView({
  lawyer,
  onBack,
  defaultTab = 'about',
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

  useEffect(() => {
    if (activeTab === 'booking') {
      const t = getTodayPH();
      setCurrentYear(t.year);
      setCurrentMonth(t.month);
      setSelectedDay(t.day);
    }
  }, [activeTab]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('2:00 PM - 3:00 PM • PST, GMT+8');
  const [communicationMode, setCommunicationMode] = useState<'video' | 'audio'>('video');
  const [subject, setSubject] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [agreedToTerms, setAgreedToTerms] = useState<boolean>(false);

  // ─── Documents Vault Picker Modal State ───
  const [showDocPickerModal, setShowDocPickerModal] = useState<boolean>(false);
  const [docPickerFolders, setDocPickerFolders] = useState<any[]>([]);
  const [loadingDocPicker, setLoadingDocPicker] = useState<boolean>(false);
  const [selectedDocPickerFiles, setSelectedDocPickerFiles] = useState<string[]>([]);
  const [activePickerFolderId, setActivePickerFolderId] = useState<string | null>(null);
  const [pickerNewFolderName, setPickerNewFolderName] = useState<string>('');
  const [isCreatingPickerFolder, setIsCreatingPickerFolder] = useState<boolean>(false);
  const [isUploadingPickerFile, setIsUploadingPickerFile] = useState<boolean>(false);
  const [pickerNotice, setPickerNotice] = useState<string | null>(null);
  const pickerFileInputRef = useRef<HTMLInputElement>(null);
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);
  const [bookingStatus, setBookingStatus] = useState<'idle' | 'saved' | 'submitted'>('idle');
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'gcash' | 'maya' | 'bank_transfer'>('gcash');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [payerName, setPayerName] = useState<string>('');
  const [paymentReceiptName, setPaymentReceiptName] = useState<string>('');
  const [paymentReceiptBase64, setPaymentReceiptBase64] = useState<string>('');
  const [submittingBooking, setSubmittingBooking] = useState<boolean>(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // ─── Document Vault Picker Handlers ──────────────────────────────────────────
  const handleOpenDocPicker = async () => {
    setShowDocPickerModal(true);
    setLoadingDocPicker(true);
    setPickerNotice(null);
    try {
      const data = await getUserDocumentsDataAction('client');
      let combined = Array.isArray(data) ? [...data] : [];

      try {
        const custom = localStorage.getItem('justicia_client_custom_folders');
        if (custom) {
          const parsed = JSON.parse(custom);
          if (Array.isArray(parsed)) {
            const existingIds = new Set(combined.map((f: any) => f.id));
            const extra = parsed.filter((f: any) => !existingIds.has(f.id));
            combined = [...extra, ...combined];
          }
        }
      } catch {
        // ignore
      }

      setDocPickerFolders(combined);
      if (combined.length > 0) {
        setActivePickerFolderId(combined[0].id);
      }
    } catch (err) {
      console.error('Error fetching documents for picker:', err);
    } finally {
      setLoadingDocPicker(false);
    }
  };

  const handleToggleSelectDoc = (fileName: string) => {
    setSelectedDocPickerFiles((prev) =>
      prev.includes(fileName) ? prev.filter((n) => n !== fileName) : [...prev, fileName]
    );
  };

  const handleCreatePickerFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickerNewFolderName.trim() || isCreatingPickerFolder) return;
    setIsCreatingPickerFolder(true);
    setPickerNotice(null);
    try {
      const res = await createDocumentFolderAction(pickerNewFolderName.trim(), 'client');
      const newFolder = (res && 'folder' in res && res.folder) ? res.folder : {
        id: `fld-${Date.now()}`,
        name: pickerNewFolderName.trim(),
        isRecentlyCreated: true,
        files: [],
      };
      setDocPickerFolders((prev) => [newFolder, ...prev]);
      setActivePickerFolderId(newFolder.id);

      try {
        const custom = localStorage.getItem('justicia_client_custom_folders');
        const parsed = custom ? JSON.parse(custom) : [];
        localStorage.setItem('justicia_client_custom_folders', JSON.stringify([newFolder, ...parsed]));
      } catch {
        // ignore
      }

      setPickerNewFolderName('');
      setPickerNotice(`Created folder "${newFolder.name}" successfully.`);
    } catch (err: any) {
      setPickerNotice(err?.message || 'Failed to create folder');
    } finally {
      setIsCreatingPickerFolder(false);
    }
  };

  const handlePickerFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isUploadingPickerFile) return;

    setIsUploadingPickerFile(true);
    setPickerNotice(null);

    const ext = file.name.split('.').pop()?.toLowerCase();
    let fType = 'pdf';
    if (ext === 'doc' || ext === 'docx') fType = 'doc';
    else if (ext === 'xls' || ext === 'xlsx') fType = 'excel';
    else if (ext === 'csv') fType = 'csv';
    else if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') fType = 'png';

    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    const sizeStr = file.size > 1024 * 1024 ? `${sizeMb} MB` : `${Math.round(file.size / 1024)} KB`;

    const targetFolderId = activePickerFolderId || (docPickerFolders[0]?.id || null);

    try {
      const res = await uploadDocumentFileAction(targetFolderId, file.name, fType, sizeStr);
      const newFileItem = (res && 'file' in res && res.file) ? res.file : {
        id: `file-${Date.now()}`,
        name: file.name,
        size: sizeStr,
        type: fType,
        updatedAt: 'Just now',
      };

      setDocPickerFolders((prev) => {
        let matched = false;
        const updated = prev.map((f) => {
          if (f.id === targetFolderId || (!targetFolderId && f.name.includes('Vault'))) {
            matched = true;
            return { ...f, files: [newFileItem, ...f.files] };
          }
          return f;
        });
        if (!matched) {
          if (updated.length > 0) {
            updated[0] = { ...updated[0], files: [newFileItem, ...updated[0].files] };
          } else {
            updated.push({
              id: 'uploaded-records',
              name: 'Client Vault & Uploaded Records',
              isRecentlyCreated: false,
              files: [newFileItem],
            });
          }
        }
        return updated;
      });

      // Auto-select the newly uploaded file
      setSelectedDocPickerFiles((prev) => Array.from(new Set([...prev, file.name])));
      setPickerNotice(`Uploaded "${file.name}" and added to selection.`);
    } catch (err: any) {
      setPickerNotice(err?.message || 'Failed to upload document');
    } finally {
      setIsUploadingPickerFile(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleConfirmDocPicker = () => {
    setAttachedFiles((prev) => Array.from(new Set([...prev, ...selectedDocPickerFiles])));
    setSelectedDocPickerFiles([]);
    setShowDocPickerModal(false);
  };

  // ─── Reviews State ────────────────────────────────────────────────────────────
  const initialReviews: ReviewItem[] = [
    {
      id: 0,
      name: 'Clyde Justine Rosal',
      stars: 5,
      date: '10/17/2026',
      content:
        'Atty. provided crystal clear guidance on our Makati lease deposit recovery. We drafted a formal demand letter that settled the matter amicably within 10 days. Very professional, responsive, and thorough in explaining our legal rights under the Civil Code.',
      reply: 'Thank you Clyde! Glad we were able to resolve your lease refund promptly without the expense of prolonged court litigation.',
    },
    {
      id: 1,
      name: 'Benideck Longakit',
      stars: 5,
      date: '10/15/2026',
      content:
        'Exceptional knowledge of DOLE and NLRC labor standards. Guided our team through the mandatory conciliation process smoothly and protected our position on separation pay.',
    },
    {
      id: 2,
      name: 'Christopher John Rubio',
      stars: 4,
      date: '10/12/2026',
      content:
        'Prompt and insightful consultation regarding property boundary questions. Delivered actionable advice and clear statutory citations for Land Registration Act compliance.',
      reply: 'Much appreciated Christopher. Ensuring Torrens title clean chain of custody is always the safest course.',
    },
    {
      id: 3,
      name: 'Axziel Jay A. Bartolabac',
      stars: 5,
      date: '10/08/2026',
      content:
        'Very reassuring and articulate counsel. Handled our family estate settlement inquiry with utmost competence and sensitivity. Highly recommended attorney.',
    },
    {
      id: 4,
      name: 'Patricia Mae Santos',
      stars: 4,
      date: '09/28/2026',
      content:
        'Detailed contract review for our business partnership. Caught two potential ambiguous liability clauses before we signed. Worth every peso.',
    },
    {
      id: 5,
      name: 'Rafael D. Mercado',
      stars: 5,
      date: '09/19/2026',
      content:
        'Superb attorney. Extremely fast response time and explained Philippine jurisprudence in a way that is easy to understand for non-lawyers.',
    },
  ];

  const [reviewsList, setReviewsList] = useState<ReviewItem[]>(initialReviews);
  const [selectedReviewStar, setSelectedReviewStar] = useState<number | 'all'>('all');
  const [reviewPage, setReviewPage] = useState<number>(1);
  const [helpfulCounts, setHelpfulCounts] = useState<{ [id: string | number]: number }>({
    0: 12,
    1: 8,
    2: 15,
    3: 6,
    4: 9,
    5: 11,
  });
  const [userVotedHelpful, setUserVotedHelpful] = useState<{ [id: string | number]: boolean }>({});

  const [showWriteReview, setShowWriteReview] = useState<boolean>(false);
  const [newReviewStars, setNewReviewStars] = useState<number>(5);
  const [newReviewHoverStars, setNewReviewHoverStars] = useState<number | null>(null);
  const [newReviewName, setNewReviewName] = useState<string>('');
  const [newReviewContent, setNewReviewContent] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);
  const [reviewSuccessNotice, setReviewSuccessNotice] = useState<boolean>(false);

  const [replyingToId, setReplyingToId] = useState<string | number | null>(null);
  const [replyText, setReplyText] = useState<string>('');


  // Fetch booked slots for the selected day to prevent duplicate appointments
  useEffect(() => {
    if (!lawyer.userId) return;
    const dateStr = `${monthNames[currentMonth]} ${selectedDay}, ${currentYear}`;
    getBookedSlotsForLawyer(lawyer.userId, dateStr).then((slots) => {
      setBookedSlots(slots || []);
      if (slots && slots.includes(selectedTimeSlot)) {
        const available = timeSlots.find((s) => !slots.includes(s));
        if (available) setSelectedTimeSlot(available);
      }
    });
  }, [lawyer.userId, selectedDay, currentMonth, currentYear]);

  // Fetch live reviews from database if available
  useEffect(() => {
    async function fetchReviews() {
      if (!lawyer.userId) return;
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('reviews')
          .select('id, rating, comment, created_at')
          .eq('lawyer_id', lawyer.userId)
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          const dbItems: ReviewItem[] = data.map((r, i) => ({
            id: r.id || `db-${i}`,
            name: 'Verified Client',
            stars: r.rating,
            date: new Date(r.created_at).toLocaleDateString(),
            content: r.comment || 'Client left a rating without comment.',
          }));
          setReviewsList((prev) => [...dbItems, ...prev]);
        }
      } catch {
        // fallback to initialReviews
      }
    }
    fetchReviews();
  }, [lawyer.userId]);

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
  const formattedDateStr = `${selectedMonthName} ${selectedDay}, ${currentYear}`;
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

  const handleClearInputs = () => {
    setSubject('');
    setDescription('');
    setAttachedFiles([]);
    setAgreedToTerms(false);
    setBookingStatus('idle');
  };

  const handleSaveDraft = () => {
    setBookingStatus('saved');
    setTimeout(() => setBookingStatus('idle'), 4000);
  };

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPaymentReceiptName(file.name);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 800;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.7);
            setPaymentReceiptBase64(compressed);
          } else {
            setPaymentReceiptBase64(event.target?.result as string);
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    } else {
      setPaymentReceiptBase64('');
    }
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError(null);

    if (!subject.trim()) {
      setBookingError('Please enter a consultation subject.');
      return;
    }
    if (!paymentReference.trim()) {
      setBookingError('Please enter your payment reference number / transaction hash.');
      return;
    }
    if (!agreedToTerms) {
      setBookingError('Please agree to the attorney-client privilege review terms.');
      return;
    }

    setSubmittingBooking(true);
    const dateStr = `${selectedMonthName} ${selectedDay}, ${currentYear}`;

    try {
      const res = await bookConsultationAction({
        lawyerId: lawyer.userId,
        lawyerName: lawyer.fullName,
        day: selectedDay,
        month: selectedMonthName,
        year: currentYear,
        dateStr,
        timeSlot: selectedTimeSlot,
        communicationMode,
        subject,
        description,
        attachedFiles: attachedFiles.map((name) => ({ name })),
        payment: {
          method: paymentMethod,
          referenceNumber: paymentReference,
          payerName: payerName || 'Verified Client',
          amount: lawyer.feeStandard60min ?? 1500,
          receiptFileName: paymentReceiptName,
          receiptBase64: paymentReceiptBase64,
        },
      });

      if (res?.error) {
        setBookingError(res.error);
        setSubmittingBooking(false);
        return;
      }

      // Automatically create a folder in client's MyDocuments
      const folderId = `consultation-${Date.now()}`;
      const newFolder = {
        id: folderId,
        name: subject || 'Consultation Intake Documents',
        isRecentlyCreated: true,
        files: [
          ...attachedFiles.map((f, i) => ({
            id: `f-${Date.now()}-${i}`,
            name: f,
            size: '1.8 MB',
            type: 'pdf' as const,
            updatedAt: 'Today',
          })),
          ...(paymentReceiptName
            ? [
              {
                id: `f-receipt-${Date.now()}`,
                name: paymentReceiptName || `Payment_Receipt_${paymentReference}.png`,
                size: '520 KB',
                type: 'png' as const,
                updatedAt: 'Today',
              },
            ]
            : []),
        ],
      };

      try {
        const existing = JSON.parse(localStorage.getItem('justicia_client_custom_folders') || '[]');
        localStorage.setItem('justicia_client_custom_folders', JSON.stringify([newFolder, ...existing]));
      } catch {
        // ignore
      }

      setBookingStatus('submitted');
      setBookedSlots((prev) => Array.from(new Set([...prev, selectedTimeSlot])));
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

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReviewContent.trim()) {
      alert('Please enter your review feedback.');
      return;
    }
    setSubmittingReview(true);
    const newRev: ReviewItem = {
      id: `rev-${Date.now()}`,
      name: newReviewName.trim() || 'Verified Client',
      stars: newReviewStars,
      date: new Date().toLocaleDateString(),
      content: newReviewContent.trim(),
    };

    setReviewsList((prev) => [newRev, ...prev]);

    try {
      const supabase = createClient();
      await supabase.from('reviews').insert({
        lawyer_id: lawyer.userId,
        rating: newReviewStars,
        comment: newReviewContent.trim(),
      } as any);
    } catch {
      // offline / demo fallback
    }

    setSubmittingReview(false);
    setShowWriteReview(false);
    setNewReviewContent('');
    setNewReviewName('');
    setReviewSuccessNotice(true);
    setTimeout(() => setReviewSuccessNotice(false), 5000);
  };

  const handleSendReply = (reviewId: string | number) => {
    if (!replyText.trim()) return;
    setReviewsList((prev) =>
      prev.map((r) => (r.id === reviewId ? { ...r, reply: replyText.trim() } : r))
    );
    setReplyingToId(null);
    setReplyText('');
  };

  // Filtered reviews and dynamic rating metrics
  const filteredReviews = reviewsList.filter((rev) => {
    if (selectedReviewStar === 'all') return true;
    return rev.stars === selectedReviewStar;
  });

  const averageRating =
    reviewsList.length > 0
      ? reviewsList.reduce((acc, r) => acc + r.stars, 0) / reviewsList.length
      : 4.9;

  const REVIEWS_PER_PAGE = 3;
  const totalReviewPages = Math.ceil(filteredReviews.length / REVIEWS_PER_PAGE) || 1;
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
    <div className="max-w-[1180px] mx-auto px-2 sm:px-6 py-4 space-y-6">
      {/* ─── Back Navigation Link ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pb-1">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#5C4535] hover:text-[#23150F] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Lawyers Directory</span>
          </button>
        ) : (
          <Link
            href="/client/lawyers"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#5C4535] hover:text-[#23150F] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Lawyers Directory</span>
          </Link>
        )}
      </div>

      {/* ─── Lawyer Banner Header Card (Matches Figma Plate Exactly) ───────── */}
      <div
        className="w-full rounded-[26px] p-6 sm:p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 transition-all"
        style={{
          backgroundColor: '#DFC5A4',
          boxShadow: '10px 12px 28px rgba(165, 135, 105, 0.45), 3px 4px 8px rgba(165, 135, 105, 0.25), -10px -10px 24px rgba(255, 255, 255, 0.95), -3px -3px 6px #FFFFFF',
        }}
      >
        <div className="flex items-center gap-5 sm:gap-6">
          {/* Avatar circle with dark brown border */}
          <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-full border-[2.75px] border-[#362519] flex items-center justify-center shrink-0">
            <svg
              className="w-12 h-12 sm:w-14 sm:h-14 text-[#362519]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M5.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6" />
            </svg>
          </div>

          {/* Lawyer Info */}
          <div className="space-y-0.5">
            <h1 className="font-cormorant text-2xl sm:text-3xl font-bold text-[#23150F] leading-tight">
              {lawyer.fullName}, Ll.B.
            </h1>
            <p className="text-xs sm:text-[13px] text-[#5C4535] font-medium leading-tight">
              Roll No. {lawyer.rollNumber || '58942'} | IBP {lawyer.ibpChapter?.toUpperCase() || 'MAKATI'}
            </p>
            <p className="text-xs text-[#5C4535] font-medium">
              ★ {averageRating.toFixed(1)} ({reviewsList.length} Reviews) • {lawyer.experienceYears ?? 9} years of practice
            </p>
            <p className="text-xs text-[#5C4535] font-medium">
              {lawyer.practiceAreas && lawyer.practiceAreas.length > 0
                ? lawyer.practiceAreas.join(' • ')
                : 'Labor & Employment • Corporate • Civil Law'}
            </p>
          </div>
        </div>

        {/* Rate on right side */}
        <div className="md:text-right shrink-0">
          <div className="flex items-baseline md:justify-end">
            <span className="font-cormorant text-3xl sm:text-4xl font-bold text-[#23150F]">
              ₱{standardFee.toLocaleString()}
            </span>
            <span className="text-sm sm:text-base text-[#23150F] font-normal ml-1">/per hour</span>
          </div>
        </div>
      </div>

      {/* ─── Navigation Tabs (Exact Figma Layout & Soft Drop Shadow Pill) ───── */}
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-6 pt-2 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('about')}
          className={`font-cormorant text-base sm:text-lg font-semibold transition-all ${activeTab === 'about'
            ? 'bg-[#DFC5A4] text-[#23150F] font-bold px-7 sm:px-8 py-2 rounded-full shadow-[3px_4px_10px_rgba(165,135,105,0.4),-2px_-2px_6px_rgba(255,255,255,0.85)]'
            : 'text-[#4A3525] hover:text-[#23150F] px-5 py-2'
            }`}
        >
          About
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reviews')}
          className={`font-cormorant text-base sm:text-lg font-semibold transition-all ${activeTab === 'reviews'
            ? 'bg-[#DFC5A4] text-[#23150F] font-bold px-7 sm:px-8 py-2 rounded-full shadow-[3px_4px_10px_rgba(165,135,105,0.4),-2px_-2px_6px_rgba(255,255,255,0.85)]'
            : 'text-[#4A3525] hover:text-[#23150F] px-5 py-2'
            }`}
        >
          Reviews
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('booking')}
          className={`font-cormorant text-base sm:text-lg font-semibold transition-all ${activeTab === 'booking'
            ? 'bg-[#DFC5A4] text-[#23150F] font-bold px-7 sm:px-8 py-2 rounded-full shadow-[3px_4px_10px_rgba(165,135,105,0.4),-2px_-2px_6px_rgba(255,255,255,0.85)]'
            : 'text-[#4A3525] hover:text-[#23150F] px-5 py-2'
            }`}
        >
          Consultation Booking
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('cases')}
          className={`font-cormorant text-base sm:text-lg font-semibold transition-all ${activeTab === 'cases'
            ? 'bg-[#DFC5A4] text-[#23150F] font-bold px-7 sm:px-8 py-2 rounded-full shadow-[3px_4px_10px_rgba(165,135,105,0.4),-2px_-2px_6px_rgba(255,255,255,0.85)]'
            : 'text-[#4A3525] hover:text-[#23150F] px-5 py-2'
            }`}
        >
          Cases Handled
        </button>
      </div>

      {/* ─── TAB 1: ABOUT (Matches Image 4) ─────────────────────────────────── */}
      {activeTab === 'about' && (
        <div className="space-y-8 animate-in fade-in duration-150">
          {/* Top Row: Bio (Left) & Consultation Rates (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Bio Card (8 cols) */}
            <div
              className="lg:col-span-8 rounded-[28px] p-7 sm:p-8 bg-[#ECE1D2] flex flex-col justify-center"
              style={{
                boxShadow:
                  '12px 12px 30px rgba(182, 155, 130, 0.4), -12px -12px 30px #FFFFFF, 3px 3px 8px rgba(182, 155, 130, 0.2), -3px -3px 8px #FFFFFF',
              }}
            >
              <p className="text-xs sm:text-[13px] text-[#3E2A1E] leading-relaxed text-justify">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
              </p>
            </div>

            {/* Consultation Rates Card (4 cols) */}
            <div
              className="lg:col-span-4 rounded-[28px] p-6 sm:p-7 flex flex-col justify-center space-y-4"
              style={{
                backgroundColor: '#DFC5A4',
                boxShadow:
                  '10px 12px 28px rgba(165, 135, 105, 0.45), 3px 4px 8px rgba(165, 135, 105, 0.25), -10px -10px 24px rgba(255, 255, 255, 0.95), -3px -3px 6px #FFFFFF',
              }}
            >
              <h3 className="font-cormorant text-xl sm:text-2xl font-bold text-[#23150F] text-center">
                Consultation Rates:
              </h3>

              <div className="space-y-3 pt-1">
                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-xs sm:text-[13px] text-[#4A3525] font-medium">Initial Consultation (30 mins)</span>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-xs sm:text-sm text-[#23150F]">₱{initialFee.toLocaleString()}</span>
                    <span className="text-[11px] text-[#5C4535] ml-1">/per hour</span>
                  </div>
                </div>

                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-xs sm:text-[13px] text-[#4A3525] font-medium">Standard Consultation (1 hr)</span>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-xs sm:text-sm text-[#23150F]">₱{standardFee.toLocaleString()}</span>
                    <span className="text-[11px] text-[#5C4535] ml-1">/per hour</span>
                  </div>
                </div>

                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-xs sm:text-[13px] text-[#4A3525] font-medium">Extended Consultation (2 hrs)</span>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-xs sm:text-sm text-[#23150F]">₱{extendedFee.toLocaleString()}</span>
                    <span className="text-[11px] text-[#5C4535] ml-1">/per hour</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Professional Background Section */}
          <div className="space-y-4">
            <h2 className="font-cormorant text-2xl font-bold text-[#23150F]">Professional Background</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Areas of Practice */}
              <div
                className="rounded-[24px] p-6 bg-[#ECE1D2] space-y-2.5"
                style={{
                  boxShadow:
                    '8px 8px 20px rgba(182, 155, 130, 0.35), -8px -8px 20px #FFFFFF, 2px 2px 6px rgba(182, 155, 130, 0.15)',
                }}
              >
                <h4 className="font-cormorant font-bold text-base text-[#23150F]">Areas of Practice</h4>
                <ul className="space-y-1.5 text-xs text-[#3E2A1E] leading-relaxed">
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0">●</span>
                    <span>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0">●</span>
                    <span>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0">●</span>
                    <span>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</span>
                  </li>
                </ul>
              </div>

              {/* Legal Experience */}
              <div
                className="rounded-[24px] p-6 bg-[#ECE1D2] space-y-2.5"
                style={{
                  boxShadow:
                    '8px 8px 20px rgba(182, 155, 130, 0.35), -8px -8px 20px #FFFFFF, 2px 2px 6px rgba(182, 155, 130, 0.15)',
                }}
              >
                <h4 className="font-cormorant font-bold text-base text-[#23150F]">Legal Experience</h4>
                <ul className="space-y-1.5 text-xs text-[#3E2A1E] leading-relaxed">
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0">●</span>
                    <span>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0">●</span>
                    <span>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0">●</span>
                    <span>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</span>
                  </li>
                </ul>
              </div>

              {/* Consultation Services */}
              <div
                className="rounded-[24px] p-6 bg-[#ECE1D2] space-y-2.5"
                style={{
                  boxShadow:
                    '8px 8px 20px rgba(182, 155, 130, 0.35), -8px -8px 20px #FFFFFF, 2px 2px 6px rgba(182, 155, 130, 0.15)',
                }}
              >
                <h4 className="font-cormorant font-bold text-base text-[#23150F]">Consultation Services</h4>
                <ul className="space-y-1.5 text-xs text-[#3E2A1E] leading-relaxed">
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0">●</span>
                    <span>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0">●</span>
                    <span>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0">●</span>
                    <span>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</span>
                  </li>
                </ul>
              </div>

              {/* Philippine Bar Examination Passer */}
              <div
                className="rounded-[24px] p-6 bg-[#ECE1D2] space-y-2.5"
                style={{
                  boxShadow:
                    '8px 8px 20px rgba(182, 155, 130, 0.35), -8px -8px 20px #FFFFFF, 2px 2px 6px rgba(182, 155, 130, 0.15)',
                }}
              >
                <h4 className="font-cormorant font-bold text-base text-[#23150F]">
                  Philippine Bar Examination Passer ({lawyer.barPasserYear ?? 2022})
                </h4>
                <ul className="space-y-1.5 text-xs text-[#3E2A1E] leading-relaxed">
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0">●</span>
                    <span>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0">●</span>
                    <span>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0">●</span>
                    <span>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Educational Background Section */}
          <div className="space-y-4">
            <h2 className="font-cormorant text-2xl font-bold text-[#23150F]">Educational Background</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Card 1: Juris Doctor */}
              <div
                className="rounded-[24px] p-6 bg-[#ECE1D2] space-y-3"
                style={{
                  boxShadow:
                    '8px 8px 20px rgba(182, 155, 130, 0.35), -8px -8px 20px #FFFFFF, 2px 2px 6px rgba(182, 155, 130, 0.15)',
                }}
              >
                <div className="flex items-center gap-3.5">
                  {/* Scales of Justice Icon */}
                  <svg className="w-8 h-8 text-[#23150F] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 3v18M7 21h10M3 7h18" />
                    <path d="M6 7l-3 7c0 1.5 1.5 2.5 3 2.5s3-1 3-2.5L6 7z" />
                    <path d="M18 7l-3 7c0 1.5 1.5 2.5 3 2.5s3-1 3-2.5L18 7z" />
                  </svg>
                  <div>
                    <h4 className="font-cormorant font-bold text-base sm:text-lg text-[#23150F] leading-tight">
                      Juris Doctor (2017 - 2021)
                    </h4>
                    <p className="text-xs text-[#7D6855]">University of the Philippines - Cebu</p>
                  </div>
                </div>

                <ul className="space-y-1.5 text-xs text-[#3E2A1E] leading-relaxed pt-1">
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0">●</span>
                    <span>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0">●</span>
                    <span>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0">●</span>
                    <span>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</span>
                  </li>
                </ul>
              </div>

              {/* Card 2: Bachelor of Arts in Political Science */}
              <div
                className="rounded-[24px] p-6 bg-[#ECE1D2] space-y-3"
                style={{
                  boxShadow:
                    '8px 8px 20px rgba(182, 155, 130, 0.35), -8px -8px 20px #FFFFFF, 2px 2px 6px rgba(182, 155, 130, 0.15)',
                }}
              >
                <div className="flex items-center gap-3.5">
                  {/* Graduation Cap / Diploma Icon */}
                  <svg className="w-8 h-8 text-[#23150F] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                    <path d="M6 12v5c3 3 9 3 12 0v-5" />
                  </svg>
                  <div>
                    <h4 className="font-cormorant font-bold text-base sm:text-lg text-[#23150F] leading-tight">
                      Bachelor of Arts in Political Science (2013 - 2017)
                    </h4>
                    <p className="text-xs text-[#7D6855]">University of San Carlos - Main Campus</p>
                  </div>
                </div>

                <ul className="space-y-1.5 text-xs text-[#3E2A1E] leading-relaxed pt-1">
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0">●</span>
                    <span>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0">●</span>
                    <span>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0">●</span>
                    <span>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: REVIEWS (Matches Image 1) ───────────────────────────────── */}
      {activeTab === 'reviews' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Main Large Reviews Outer Container */}
          <div
            className="rounded-[28px] p-6 sm:p-9 bg-[#ECE1D2] space-y-6"
            style={{
              boxShadow:
                '14px 14px 32px rgba(182, 155, 130, 0.4), -14px -14px 32px #FFFFFF, 3px 3px 8px rgba(182, 155, 130, 0.2), -3px -3px 8px #FFFFFF',
            }}
          >
            {/* Score header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-cormorant text-5xl sm:text-6xl font-bold text-[#23150F] leading-none">
                  {averageRating.toFixed(1)}
                </span>
                <span className="font-cormorant text-2xl sm:text-3xl font-semibold text-[#23150F]">
                  /5
                </span>

                {/* Stars */}
                <div className="flex items-center gap-1.5 text-[#C58B3C] text-2xl sm:text-3xl ml-3 sm:ml-5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <span key={s}>{s <= Math.round(averageRating) ? '★' : '☆'}</span>
                  ))}
                </div>

                <span className="font-sans text-xs sm:text-sm font-medium text-[#4A3525] ml-2">
                  ({reviewsList.length} Reviews)
                </span>
              </div>

              {/* Write a Review Button */}
              <button
                type="button"
                onClick={() => setShowWriteReview((prev) => !prev)}
                className="px-5 py-2.5 rounded-xl bg-[#C58B3C] hover:bg-[#B3792E] active:scale-95 text-white text-xs font-semibold shadow-md transition-all flex items-center gap-2"
              >
                <span>★</span> {showWriteReview ? 'Close Form' : 'Write a Review'}
              </button>
            </div>

            {/* Write a Review Form Card */}
            {showWriteReview && (
              <form
                onSubmit={handleAddReview}
                className="rounded-[22px] p-5 sm:p-6 bg-[#E5D5C1] border border-[#C58B3C]/40 space-y-4 shadow-[inset_1px_1px_4px_rgba(0,0,0,0.06),2px_2px_8px_rgba(255,255,255,0.8)]"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-cormorant font-bold text-lg text-[#23150F]">
                    Write a Review for {lawyer.fullName}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowWriteReview(false)}
                    className="text-[#5C4535] hover:text-[#23150F] text-sm"
                  >
                    ✕
                  </button>
                </div>

                {/* Rating Stars Picker */}
                <div>
                  <label className="text-xs font-medium text-[#4A3525] block mb-1">
                    Your Rating:
                  </label>
                  <div className="flex items-center gap-1.5 text-2xl text-[#C58B3C]">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onMouseEnter={() => setNewReviewHoverStars(star)}
                        onMouseLeave={() => setNewReviewHoverStars(null)}
                        onClick={() => setNewReviewStars(star)}
                        className="transition-transform hover:scale-110 focus:outline-none"
                      >
                        {star <= (newReviewHoverStars ?? newReviewStars) ? '★' : '☆'}
                      </button>
                    ))}
                    <span className="text-xs font-medium text-[#5C4535] ml-2">
                      ({newReviewHoverStars ?? newReviewStars} out of 5 stars)
                    </span>
                  </div>
                </div>

                {/* Reviewer Name */}
                <div>
                  <label className="text-xs font-medium text-[#4A3525] block mb-1">
                    Your Name:
                  </label>
                  <input
                    type="text"
                    value={newReviewName}
                    onChange={(e) => setNewReviewName(e.target.value)}
                    placeholder="e.g. Juan dela Cruz (Leave blank for 'Verified Client')"
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-[#ECE1D2] border border-[#D5C2AB] text-[#23150F] placeholder-[#8E7E70] focus:outline-none focus:ring-1 focus:ring-[#C58B3C]"
                  />
                </div>

                {/* Review Feedback */}
                <div>
                  <label className="text-xs font-medium text-[#4A3525] block mb-1">
                    Feedback &amp; Experience:
                  </label>
                  <textarea
                    rows={3}
                    value={newReviewContent}
                    onChange={(e) => setNewReviewContent(e.target.value)}
                    placeholder="Describe your consultation experience, professionalism, and advice received..."
                    required
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-[#ECE1D2] border border-[#D5C2AB] text-[#23150F] placeholder-[#8E7E70] focus:outline-none focus:ring-1 focus:ring-[#C58B3C]"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowWriteReview(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-[#5C4535] hover:text-[#23150F]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="px-5 py-2 rounded-xl bg-[#C58B3C] hover:bg-[#B3792E] text-white text-xs font-semibold shadow-md disabled:opacity-50"
                  >
                    {submittingReview ? 'Submitting…' : 'Publish Review'}
                  </button>
                </div>
              </form>
            )}

            {/* Review Success Confirmation Toast */}
            {reviewSuccessNotice && (
              <div className="p-3.5 rounded-xl bg-[#DFC5A4] border border-[#C58B3C]/60 text-xs text-[#23150F] flex items-center gap-2">
                <span>✓</span>
                <span className="font-semibold">Thank you! Your rating &amp; review has been recorded.</span>
              </div>
            )}

            {/* Filter pills */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedReviewStar('all');
                  setReviewPage(1);
                }}
                className={`px-5 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all ${selectedReviewStar === 'all'
                  ? 'bg-[#DFC5A4] text-[#23150F] font-bold shadow-[inset_1px_1px_3px_rgba(0,0,0,0.15)]'
                  : 'bg-[#E5D5C1] hover:bg-[#DFC5A4] text-[#4A3525] shadow-[2px_2px_5px_rgba(182,155,130,0.25)]'
                  }`}
              >
                All ({reviewsList.length})
              </button>

              {[5, 4, 3, 2, 1].map((s) => {
                const countForStar = reviewsList.filter((r) => r.stars === s).length;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setSelectedReviewStar(s);
                      setReviewPage(1);
                    }}
                    className={`px-4 sm:px-5 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all ${selectedReviewStar === s
                      ? 'bg-[#DFC5A4] text-[#23150F] font-bold shadow-[inset_1px_1px_3px_rgba(0,0,0,0.15)]'
                      : 'bg-[#E5D5C1] hover:bg-[#DFC5A4] text-[#4A3525] shadow-[2px_2px_5px_rgba(182,155,130,0.25)]'
                      }`}
                  >
                    ★{s} ({countForStar})
                  </button>
                );
              })}
            </div>

            {/* Review Cards Stack */}
            <div className="space-y-4 pt-1">
              {pagedReviews.map((rev) => (
                <div
                  key={rev.id}
                  className="rounded-[22px] p-5 sm:p-6 space-y-3"
                  style={{
                    backgroundColor: '#DFC5A4',
                    boxShadow:
                      '6px 8px 18px rgba(165, 135, 105, 0.4), 2px 2px 5px rgba(165, 135, 105, 0.2), -6px -6px 16px rgba(255, 255, 255, 0.9), -2px -2px 4px #FFFFFF',
                  }}
                >
                  {/* Header: Avatar, Name, Stars, Date */}
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full border-2 border-[#362519] flex items-center justify-center shrink-0">
                      <svg
                        className="w-5 h-5 text-[#362519]"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="8" r="4" />
                        <path d="M5.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6" />
                      </svg>
                    </div>

                    <div>
                      <h4 className="font-sans font-bold text-xs sm:text-sm text-[#23150F] leading-tight">
                        {rev.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex items-center text-[#C58B3C] text-xs">
                          {'★'.repeat(rev.stars)}{'☆'.repeat(5 - rev.stars)}
                        </div>
                        <span className="text-[10px] sm:text-[11px] text-[#5C4535] font-medium">
                          {rev.date}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Body Text */}
                  <p className="text-xs sm:text-[13px] text-[#34150F] leading-relaxed text-justify">
                    {rev.content}
                  </p>

                  {/* Attorney Reply Bubble if present */}
                  {rev.reply && (
                    <div className="p-3 rounded-xl bg-[#ECE1D2]/90 border border-[#D5C2AB] text-xs space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#23150F]">
                        <span>⚖️</span>
                        <span>Response from {lawyer.fullName}</span>
                      </div>
                      <p className="text-[#4A3525] text-xs leading-relaxed">{rev.reply}</p>
                    </div>
                  )}

                  {/* Inline reply form when replyingToId === rev.id */}
                  {replyingToId === rev.id && (
                    <div className="p-3 rounded-xl bg-[#ECE1D2] border border-[#C58B3C]/50 space-y-2">
                      <label className="text-[11px] font-semibold text-[#23150F] block">
                        Write a response to {rev.name}:
                      </label>
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Type response as counsel or verified client..."
                        rows={2}
                        className="w-full p-2.5 rounded-lg text-xs bg-[#F5EDE2] border border-[#D5C2AB] text-[#23150F] focus:outline-none focus:ring-1 focus:ring-[#C58B3C]"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setReplyingToId(null);
                            setReplyText('');
                          }}
                          className="px-3 py-1 text-xs text-[#5C4535] hover:text-[#23150F]"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendReply(rev.id)}
                          className="px-3.5 py-1 rounded-lg bg-[#C58B3C] hover:bg-[#B3792E] text-white text-xs font-semibold"
                        >
                          Post Response
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Footer Action Links */}
                  <div className="flex items-center gap-5 pt-1 text-[11px] font-medium text-[#5C4535]">
                    <button
                      type="button"
                      onClick={() => {
                        setReplyingToId(replyingToId === rev.id ? null : rev.id);
                        setReplyText('');
                      }}
                      className="inline-flex items-center gap-1.5 hover:text-[#23150F] transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9 17 4 12 9 7" />
                        <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                      </svg>
                      <span>Reply</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleHelpful(rev.id)}
                      className="inline-flex items-center gap-1.5 hover:text-[#23150F] transition-colors"
                    >
                      <svg
                        className={`w-3.5 h-3.5 ${userVotedHelpful[rev.id] ? 'fill-current text-[#C58B3C]' : ''}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                      </svg>
                      <span>Helpful? ({helpfulCounts[rev.id] || 0})</span>
                    </button>
                  </div>
                </div>
              ))}

              {filteredReviews.length === 0 && (
                <div className="py-10 text-center text-xs text-[#7D6855]">
                  No reviews found for this star filter rating.
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
                className="w-9 h-9 rounded-full bg-[#ECE1D2] flex items-center justify-center text-[#5C4535] hover:text-[#23150F] disabled:opacity-30 transition-all"
                style={{
                  boxShadow:
                    '4px 4px 10px rgba(182, 155, 130, 0.35), -4px -4px 10px #FFFFFF',
                }}
                aria-label="Previous reviews page"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div className="flex items-center gap-2">
                {Array.from({ length: totalReviewPages }).map((_, idx) => {
                  const p = idx + 1;
                  const isActive = p === reviewPage;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setReviewPage(p)}
                      className={`w-2.5 h-2.5 rounded-full transition-all ${isActive ? 'bg-[#362519] scale-125' : 'bg-[#C58B3C]/80 hover:bg-[#362519]'
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
                className="w-9 h-9 rounded-full bg-[#ECE1D2] flex items-center justify-center text-[#5C4535] hover:text-[#23150F] disabled:opacity-30 transition-all"
                style={{
                  boxShadow:
                    '4px 4px 10px rgba(182, 155, 130, 0.35), -4px -4px 10px #FFFFFF',
                }}
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

          {bookingStatus === 'submitted' && (
            <div className="p-6 rounded-3xl bg-emerald-100/95 border border-emerald-300 text-emerald-950 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">✅</span>
                <h3 className="font-cormorant font-bold text-lg">Consultation Request Confirmed</h3>
              </div>
              <p className="text-xs sm:text-sm">
                Your booking request for <strong>{lawyer.fullName}</strong> on <strong>{formattedDateStr} ({selectedTimeSlot})</strong> has been received under confidential attorney-client privilege.
              </p>
              <div className="flex items-center gap-4 pt-2">
                <Link
                  href="/client/consultations"
                  className="px-5 py-2.5 rounded-xl bg-[#23150F] text-[#ded7cb] text-xs font-semibold hover:bg-[#352219]"
                >
                  View My Consultations
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setBookingStatus('idle');
                    setBookingError(null);
                    setPaymentReference('');
                    setPaymentReceiptName('');
                    setPaymentReceiptBase64('');
                    const dateStr = `${selectedMonthName} ${selectedDay}, ${currentYear}`;
                    getBookedSlotsForLawyer(lawyer.userId, dateStr).then((slots) => {
                      const allSlots = Array.from(new Set([...(slots || []), selectedTimeSlot]));
                      setBookedSlots(allSlots);
                      const nextSlot = timeSlots.find((s) => !allSlots.includes(s));
                      if (nextSlot) setSelectedTimeSlot(nextSlot);
                    });
                  }}
                  className="text-xs text-[#5C4535] underline font-semibold hover:text-[#23150F] cursor-pointer"
                >
                  Book Another Session
                </button>
              </div>
            </div>
          )}

          {/* Calendar & Time Slots Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Calendar Card (Left - 8 cols) */}
            <div
              className="lg:col-span-8 rounded-[28px] p-6 sm:p-8 bg-[#ECE1D2] flex flex-col justify-between"
              style={{
                boxShadow:
                  '12px 12px 30px rgba(182, 155, 130, 0.4), -12px -12px 30px #FFFFFF, 3px 3px 8px rgba(182, 155, 130, 0.2), -3px -3px 8px #FFFFFF',
              }}
            >
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6 sm:gap-10">
                {/* Big Date Highlight */}
                <div className="text-center sm:text-left sm:pr-8 sm:border-r border-[#D1BEA8]/80 shrink-0 min-w-[120px]">
                  <div className="font-cormorant text-base font-bold uppercase tracking-widest text-[#4A3525]">
                    {selectedMonthShort}
                  </div>
                  <div className="font-cormorant text-6xl sm:text-7xl font-bold text-[#C58B3C] leading-none my-1">
                    {selectedDay}
                  </div>
                  <div className="font-cormorant text-xs sm:text-sm font-bold tracking-widest uppercase text-[#4A3525]">
                    {selectedDayOfWeek}
                  </div>
                </div>

                {/* Mini Calendar Grid with Month Switcher Controls */}
                <div className="flex-1 w-full max-w-sm sm:max-w-none">
                  {/* Month Navigation Bar */}
                  <div className="flex items-center justify-between pb-3 px-1">
                    <span className="font-cormorant text-base sm:text-lg font-bold text-[#4A3525] tracking-wide">
                      {selectedMonthName} {currentYear}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleGoToToday}
                        className="px-2.5 py-0.5 rounded-full bg-[#E5D5C1] hover:bg-[#D5C2AB] text-[#34150F] text-[10px] font-bold uppercase tracking-wider transition-colors shadow-xs"
                        title="Snap to Today"
                      >
                        Today
                      </button>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handlePrevMonth}
                          className="w-7 h-7 rounded-full bg-[#E5D5C1] hover:bg-[#D5C2AB] text-[#34150F] flex items-center justify-center font-bold text-sm transition-colors shadow-xs active:scale-95"
                          title="Previous Month"
                          aria-label="Previous Month"
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          onClick={handleNextMonth}
                          className="w-7 h-7 rounded-full bg-[#E5D5C1] hover:bg-[#D5C2AB] text-[#34150F] flex items-center justify-center font-bold text-sm transition-colors shadow-xs active:scale-95"
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
                            ? 'bg-[#DFC5A4] text-[#C58B3C] font-bold shadow-[inset_1px_1px_3px_rgba(0,0,0,0.18)] scale-105'
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
              className="lg:col-span-4 rounded-[28px] p-6 bg-[#ECE1D2] flex flex-col justify-center space-y-3"
              style={{
                boxShadow:
                  '12px 12px 30px rgba(182, 155, 130, 0.4), -12px -12px 30px #FFFFFF, 3px 3px 8px rgba(182, 155, 130, 0.2), -3px -3px 8px #FFFFFF',
              }}
            >
              {timeSlots.map((slot) => {
                const isSelected = selectedTimeSlot === slot;
                const isBooked = bookedSlots.includes(slot);
                return (
                  <button
                    key={slot}
                    type="button"
                    disabled={isBooked}
                    onClick={() => !isBooked && setSelectedTimeSlot(slot)}
                    className={`w-full py-2.5 px-3 rounded-full text-xs font-medium transition-all text-center relative ${isBooked
                      ? 'opacity-40 cursor-not-allowed bg-stone-300 text-stone-500 line-through'
                      : isSelected
                        ? 'bg-[#DFC5A4] text-[#23150F] font-bold shadow-[inset_2px_2px_4px_rgba(0,0,0,0.14),inset_-2px_-2px_4px_rgba(255,255,255,0.7)]'
                        : 'bg-[#E6D7C3] hover:bg-[#DFC5A4]/60 text-[#5C4535] shadow-[2px_2px_5px_rgba(182,155,130,0.25)]'
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
            <h2 className="font-cormorant text-2xl font-bold text-[#23150F]">Mode of Communication</h2>
            <div
              className="rounded-[28px] p-5 sm:p-6 bg-[#ECE1D2] space-y-3"
              style={{
                boxShadow:
                  '12px 12px 30px rgba(182, 155, 130, 0.4), -12px -12px 30px #FFFFFF, 3px 3px 8px rgba(182, 155, 130, 0.2), -3px -3px 8px #FFFFFF',
              }}
            >
              {/* Option 1: Video Consultation */}
              <div
                onClick={() => setCommunicationMode('video')}
                className={`flex items-start gap-3.5 p-4 rounded-[20px] cursor-pointer transition-all ${communicationMode === 'video'
                  ? 'bg-[#DFC5A4] shadow-[4px_5px_12px_rgba(165,135,105,0.35),-3px_-3px_8px_rgba(255,255,255,0.85)]'
                  : 'bg-transparent hover:bg-[#E5D5C1]/50'
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
                    <span className="text-[9px] uppercase tracking-wider font-bold bg-[#ECE1D2] text-[#9E6C28] px-2 py-0.5 rounded-full ml-1">
                      Recommended
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-[#5C4535] leading-relaxed">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                  </p>
                </div>
              </div>

              {/* Option 2: Audio Call */}
              <div
                onClick={() => setCommunicationMode('audio')}
                className={`flex items-start gap-3.5 p-4 rounded-[20px] cursor-pointer transition-all ${communicationMode === 'audio'
                  ? 'bg-[#DFC5A4] shadow-[4px_5px_12px_rgba(165,135,105,0.35),-3px_-3px_8px_rgba(255,255,255,0.85)]'
                  : 'bg-transparent hover:bg-[#E5D5C1]/50'
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
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Purpose of Consultation Section */}
          <div className="space-y-3">
            <h2 className="font-cormorant text-2xl font-bold text-[#23150F]">Purpose of Consultation</h2>
            <div
              className="rounded-[28px] p-6 sm:p-8 bg-[#ECE1D2] space-y-5"
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
                  className="w-full py-9 px-6 rounded-2xl bg-[#E4D5C2] flex flex-col items-center justify-center text-center cursor-pointer hover:bg-[#DECDBA] transition-all block relative"
                  style={{
                    boxShadow:
                      'inset 3px 3px 6px rgba(165, 140, 115, 0.45), inset -3px -3px 6px rgba(255, 255, 255, 0.85)',
                  }}
                >
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (!files || files.length === 0) return;
                      const fileNames = Array.from(files).map((f) => f.name);
                      setAttachedFiles((prev) => Array.from(new Set([...prev, ...fileNames])));
                    }}
                  />
                  <svg className="w-9 h-9 text-[#7D6855] mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span className="text-xs text-[#5C4535] font-semibold mt-2.5 block">
                    Click to browse files or Drag & Drop case documents
                  </span>
                  <span className="text-[10px] text-[#8C7A6B] mt-0.5 block">
                    Attach contracts, demand letters, or evidence (PDF, DOCX, XLSX, Images)
                  </span>
                </label>

                {/* Attached Files List */}
                {attachedFiles.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {attachedFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#DFC5A4]/60 text-xs text-[#23150F]">
                        <span className="truncate">📎 {file}</span>
                        <button
                          type="button"
                          onClick={() => setAttachedFiles(attachedFiles.filter((_, i) => i !== idx))}
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
                  className="px-8 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-[#23150F] hover:bg-[#D4B892] transition-all mx-auto block"
                  style={{
                    backgroundColor: '#DFC5A4',
                    boxShadow:
                      '4px 5px 12px rgba(165, 135, 105, 0.35), -3px -3px 8px rgba(255, 255, 255, 0.85)',
                  }}
                >
                  Share Uploaded Files from your Documents
                </button>
              </div>

              {/* Payment & Proof of Payment Section */}
              <div className="space-y-4 pt-3 border-t border-[#D1BEA8]/60">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="font-cormorant text-xl font-bold text-[#23150F]">
                      Consultation Retainer & Proof of Payment
                    </h3>
                    <p className="text-[11px] text-[#5C4535]">
                      Upload your payment confirmation so counsel can verify and accept your appointment.
                    </p>
                  </div>
                  <div className="px-3.5 py-1.5 rounded-full bg-[#DFC5A4] text-xs font-bold text-[#23150F] self-start sm:self-auto shadow-xs">
                    ₱{(lawyer.feeStandard60min ?? 1500).toLocaleString()}.00 (60-Min Session)
                  </div>
                </div>

                {/* Channel Selector */}
                <div className="grid grid-cols-3 gap-2">
                  {(['gcash', 'maya', 'bank_transfer'] as const).map((method) => {
                    const label = method === 'gcash' ? 'GCash' : method === 'maya' ? 'Maya' : 'Bank Transfer';
                    const isSelected = paymentMethod === method;
                    return (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(method)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${isSelected
                          ? 'bg-[#23150F] text-[#ded7cb] shadow-sm'
                          : 'bg-[#E5D5C1] text-[#5C4535] hover:bg-[#DECDBA]'
                          }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* Account Details Box */}
                <div className="p-3.5 rounded-2xl bg-[#E4D5C2]/80 border border-[#D5C2AB] text-xs text-[#3E2A1E] space-y-1">
                  <div className="font-bold text-[#23150F] flex items-center justify-between">
                    <span>
                      {paymentMethod === 'gcash' && 'GCash Account:'}
                      {paymentMethod === 'maya' && 'Maya Account:'}
                      {paymentMethod === 'bank_transfer' && 'Bank Transmittal (BDO / BPI):'}
                    </span>
                    <span className="font-mono text-[#C58B3C]">
                      {paymentMethod === 'gcash' && '0917-889-1234'}
                      {paymentMethod === 'maya' && '0918-992-5678'}
                      {paymentMethod === 'bank_transfer' && 'Acct: 0049-2819-3829'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#5C4535]">
                    Account Name: <strong>{lawyer.fullName}</strong> • Reference format: <code>JUSTICIA-{selectedDay}</code>
                  </p>
                </div>

                {/* Payment Form Fields Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-[#5C4535]">
                      Reference / Transaction Number: <span className="text-red-700">*</span>
                    </label>
                    <input
                      type="text"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      placeholder="e.g. 10023491823"
                      className="w-full rounded-xl py-2 px-3 bg-[#E4D5C2] text-xs text-[#23150F] placeholder:text-[#9E8E7D] focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-[#5C4535]">
                      Sender / Payer Full Name:
                    </label>
                    <input
                      type="text"
                      value={payerName}
                      onChange={(e) => setPayerName(e.target.value)}
                      placeholder="e.g. Clyde Justine Rosal"
                      className="w-full rounded-xl py-2 px-3 bg-[#E4D5C2] text-xs text-[#23150F] placeholder:text-[#9E8E7D] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Upload Receipt File Input */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-[#5C4535]">
                    Proof of Payment (Screenshot Receipt / Deposit Slip):
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer px-4 py-2 rounded-xl bg-[#DFC5A4] hover:bg-[#D4B892] text-xs font-semibold text-[#23150F] transition shadow-xs">
                      <span>Upload Receipt (PNG, JPG, PDF)</span>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={handleReceiptUpload}
                      />
                    </label>
                    {paymentReceiptName ? (
                      <span className="text-xs text-emerald-800 font-semibold truncate flex items-center gap-1">
                        ✓ {paymentReceiptName}
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentReceiptName('');
                            setPaymentReceiptBase64('');
                          }}
                          className="text-red-700 hover:text-red-900 ml-1 font-bold"
                        >
                          ✕
                        </button>
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#7D6855]">No file chosen yet</span>
                    )}
                  </div>
                </div>
              </div>

              {bookingError && (
                <div className="p-3 rounded-xl bg-rose-100 border border-rose-300 text-rose-900 text-xs font-semibold">
                  ⚠ {bookingError}
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
              className="w-full sm:w-auto px-6 py-2 rounded-xl border border-[#C8B59E] text-xs font-medium text-[#5C4535] hover:bg-[#E5D5C1] transition-colors"
            >
              Clear All Inputs
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              className="w-full sm:w-auto px-8 py-2 rounded-xl text-xs font-semibold text-[#23150F] hover:bg-[#D4B892] transition-all"
              style={{
                backgroundColor: '#DFC5A4',
                boxShadow:
                  '3px 4px 8px rgba(165, 135, 105, 0.3), -2px -2px 6px rgba(255, 255, 255, 0.85)',
              }}
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
              className="w-full max-w-xs mx-auto block py-3 px-10 rounded-2xl text-sm sm:text-base font-bold text-[#23150F] text-center transition-all hover:brightness-105"
              style={{
                backgroundColor: '#DFC5A4',
                boxShadow:
                  '6px 8px 18px rgba(165, 135, 105, 0.45), -4px -4px 12px rgba(255, 255, 255, 0.85)',
              }}
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
              className="rounded-[28px] p-6 sm:p-8 bg-[#ECE1D2] space-y-2.5"
              style={{
                boxShadow:
                  '12px 12px 30px rgba(182, 155, 130, 0.4), -12px -12px 30px #FFFFFF, 3px 3px 8px rgba(182, 155, 130, 0.2), -3px -3px 8px #FFFFFF',
              }}
            >
              <div className="font-bold text-[10px] sm:text-[11px] text-[#C58B3C] uppercase tracking-wider">
                {caseItem.docket}
              </div>
              <h3 className="font-cormorant text-lg sm:text-xl font-bold text-[#23150F] leading-tight">
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
              className="w-9 h-9 rounded-full bg-[#ECE1D2] flex items-center justify-center text-[#5C4535] hover:text-[#23150F] disabled:opacity-30 transition-all"
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
              className="w-9 h-9 rounded-full bg-[#ECE1D2] flex items-center justify-center text-[#5C4535] hover:text-[#23150F] disabled:opacity-30 transition-all"
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
            className="w-full max-w-3xl rounded-[32px] p-6 sm:p-8 bg-[#ECE1D2] space-y-5 max-h-[90vh] flex flex-col"
            style={{
              boxShadow: '16px 16px 40px rgba(0,0,0,0.35), -8px -8px 24px #FFFFFF',
            }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#D1BEA8]/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#DFC5A4] flex items-center justify-center text-xl shadow-xs">
                  📁
                </div>
                <div>
                  <h3 className="font-cormorant text-2xl font-bold text-[#23150F] leading-tight">
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
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#5C4535] hover:text-[#23150F] hover:bg-[#DFC5A4]/40 font-bold transition-colors"
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
                  className="px-3 py-1.5 rounded-xl bg-[#DFC5A4] text-xs font-bold text-[#23150F] hover:bg-[#D4B892] disabled:opacity-50 transition-all shadow-xs"
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
                          : 'bg-[#E5D5C1] text-[#23150F] hover:bg-[#DFC5A4]'
                          }`}
                      >
                        <span className="truncate">📁 {folder.name}</span>
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
                        <div className="text-3xl">📄</div>
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
                        const isSelected = selectedDocPickerFiles.includes(file.name);
                        return (
                          <div
                            key={file.id || file.name}
                            onClick={() => handleToggleSelectDoc(file.name)}
                            className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${isSelected
                              ? 'bg-[#DFC5A4] border-[#C58B3C] shadow-sm text-[#23150F]'
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
                              <span className="text-sm">📄</span>
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
                  className="px-5 py-2.5 rounded-xl border border-[#C8B59E] text-xs font-semibold text-[#5C4535] hover:bg-[#E5D5C1]"
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
    </div>
  );
}

export default LawyerDetailView;
