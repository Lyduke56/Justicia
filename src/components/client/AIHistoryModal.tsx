'use client';

import React, { useState } from 'react';
import { EmptyState, NeuAlert, NeuButton, NeuModal, TrashIcon } from '@/components/shared/neu';
import { PanelLoader } from '@/components/shared/loading';
import type { AiConversationSummary } from '@/lib/ai/history';
import { AIAssistantIcon, ClockIcon } from './ClientIcons';

/** "Today, 3:15 PM" · "Yesterday, 9:02 AM" · "Nov 24, 2026" */
export function formatHistoryDate(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (d.getTime() >= startOfToday) return `Today, ${time}`;
  if (d.getTime() >= startOfToday - 86_400_000) return `Yesterday, ${time}`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

interface AIHistoryModalProps {
  conversations: AiConversationSummary[];
  loading: boolean;
  error: string | null;
  /** The conversation open on screen, if it has been saved. */
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => Promise<string | null>;
  onRetry: () => void;
  onNewQuestion: () => void;
  onClose: () => void;
}

/**
 * The AI Legal Assistant's saved conversations, newest first. Opening one loads it into the chat;
 * the trash button asks once more before deleting.
 */
export function AIHistoryModal({
  conversations,
  loading,
  error,
  activeId,
  onSelect,
  onDelete,
  onRetry,
  onNewQuestion,
  onClose,
}: AIHistoryModalProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setDeleteError(null);
    const failed = await onDelete(id);
    setDeletingId(null);
    setConfirmId(null);
    if (failed) setDeleteError(failed);
  };

  return (
    <NeuModal
      onClose={onClose}
      size="md"
      title="Conversation History"
      subtitle="Your past questions to Justicia AI"
      icon={<ClockIcon className="w-5 h-5" />}
      bodyClassName="space-y-4"
      footer={
        <>
          <NeuButton variant="secondary" onClick={onClose}>
            Close
          </NeuButton>
          <NeuButton variant="primary" onClick={onNewQuestion}>
            New Question
          </NeuButton>
        </>
      }
    >
      {deleteError && (
        <NeuAlert tone="error" onDismiss={() => setDeleteError(null)}>
          {deleteError}
        </NeuAlert>
      )}

      {loading && conversations.length === 0 ? (
        <PanelLoader label="Loading conversations..." className="min-h-[12rem]" />
      ) : error && conversations.length === 0 ? (
        <NeuAlert
          tone="error"
          action={
            <NeuButton size="sm" onClick={onRetry}>
              Retry
            </NeuButton>
          }
        >
          {error}
        </NeuAlert>
      ) : conversations.length === 0 ? (
        <EmptyState
          size="sm"
          icon={<AIAssistantIcon className="w-6 h-6" />}
          title="No conversations yet"
          description="Questions you ask the AI Legal Assistant are saved here so you can return to them."
        />
      ) : (
        <ul className="space-y-3 max-h-[min(26rem,55vh)] overflow-y-auto neu-scrollbar-discrete -mx-2 px-2 py-1.5">
          {conversations.map((c) => {
            const isActive = c.id === activeId;
            const confirming = confirmId === c.id;
            return (
              <li
                key={c.id}
                className="neu-raised-sm bg-[#E5D8CB] rounded-[14px] flex items-center gap-2 pl-4 pr-2 py-2.5"
              >
                {confirming ? (
                  <>
                    <p className="flex-1 min-w-0 font-inter text-xs text-[#5C4535]">
                      Delete <span className="font-semibold text-[#34150F]">“{c.title}”</span>? This can’t be undone.
                    </p>
                    <NeuButton size="sm" variant="secondary" disabled={deletingId === c.id} onClick={() => setConfirmId(null)}>
                      Keep
                    </NeuButton>
                    <NeuButton size="sm" variant="danger" loading={deletingId === c.id} onClick={() => handleDelete(c.id)}>
                      Delete
                    </NeuButton>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onSelect(c.id)}
                      className="group flex-1 min-w-0 text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B9833C]/50 rounded-[10px] py-0.5"
                    >
                      <span className="flex items-center gap-2">
                        <span className="truncate font-lora text-sm font-semibold text-[#34150F] group-hover:text-[#C58B3C] transition-colors">
                          {c.title}
                        </span>
                        {isActive && (
                          <span className="neu-raised-sm bg-[#E5D8CB] px-2 py-0.5 rounded-full font-lora text-[9.5px] font-semibold text-[#D39758] tracking-wide shrink-0 select-none">
                            Open
                          </span>
                        )}
                      </span>
                      <span className="block mt-0.5 font-inter text-[11px] text-[#7A6756]">
                        {formatHistoryDate(c.updatedAt, now)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(c.id)}
                      className="size-9 rounded-full flex items-center justify-center text-[#7A6756] hover:text-[#B42318] transition-colors cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B9833C]/50"
                      aria-label={`Delete conversation “${c.title}”`}
                      title="Delete conversation"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </NeuModal>
  );
}
