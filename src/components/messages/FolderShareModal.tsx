'use client';

import React, { useEffect, useState } from 'react';
import { getShareableFoldersAction, shareDocumentFolderAction, type ShareableFolder } from '@/app/actions/messageFolderActions';
import type { ThreadMessage } from '@/app/actions/consultationActions';
import type { MessageExtras } from '@/lib/messaging/types';
import { EmptyState, FolderIcon, NeuAlert, NeuButton, NeuModal, SendIcon } from '@/components/shared/neu';
import { PanelLoader } from '@/components/shared/loading';

/**
 * Messages → + → "Folder from My Documents": pick one of your folders and share it with the
 * other participant (view only), with an optional message. Built from the shared neumorphic
 * modal pieces, like the other conversation dialogs.
 */
export function FolderShareModal({
  threadId,
  counterpartName,
  onClose,
  onShared,
}: {
  threadId: string;
  counterpartName: string;
  onClose: () => void;
  onShared: (message: ThreadMessage, extras: MessageExtras) => void;
}) {
  const [folders, setFolders] = useState<ShareableFolder[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getShareableFoldersAction()
      .then((res) => {
        if (!active) return;
        if (res.success) {
          setFolders(res.folders);
          setSelected(res.folders.find((f) => f.fileCount > 0)?.id ?? null);
        } else {
          setFolders([]);
          setError(res.error);
        }
      })
      .catch(() => {
        if (!active) return;
        setFolders([]);
        setError('Your folders could not be loaded. Please try again.');
      });
    return () => {
      active = false;
    };
  }, []);

  const share = async () => {
    if (!selected || sharing) return;
    setSharing(true);
    setError(null);
    try {
      const res = await shareDocumentFolderAction(threadId, selected, note);
      if ('message' in res && res.message) onShared(res.message, res.extras);
      else setError(('error' in res && res.error) || 'The folder could not be shared.');
    } catch {
      setError('The folder could not be shared. Please try again.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <NeuModal
      onClose={onClose}
      dismissible={!sharing}
      size="md"
      icon={<FolderIcon className="w-5 h-5" />}
      title="Share a folder"
      subtitle={
        <>
          <strong className="font-semibold text-[#341512]">{counterpartName}</strong> can view and download the files in it.
          Files you add to the folder later are not shared.
        </>
      }
      footer={
        <>
          <NeuButton variant="secondary" onClick={onClose} disabled={sharing}>
            Cancel
          </NeuButton>
          <NeuButton variant="primary" onClick={share} loading={sharing} disabled={!selected} icon={<SendIcon className="w-4 h-4" />}>
            Share Folder
          </NeuButton>
        </>
      }
    >
      <div className="space-y-5">
        {folders === null ? (
          <PanelLoader srLabel="Loading your folders" />
        ) : folders.length === 0 ? (
          <div className="neu-recessed rounded-[20px]">
            <EmptyState
              size="sm"
              icon={<FolderIcon />}
              title="No folders yet"
              description="Create a folder in Documents and add files to it, then share it here."
            />
          </div>
        ) : (
          <div role="radiogroup" aria-label="Your folders" className="neu-recessed rounded-[20px] p-2.5 space-y-1.5 max-h-[300px] overflow-y-auto neu-scrollbar-discrete">
            {folders.map((f) => {
              const empty = f.fileCount === 0;
              const isSelected = selected === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={empty || sharing}
                  onClick={() => setSelected(f.id)}
                  className={`w-full flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition ${
                    isSelected
                      ? 'neu-raised-highlight-sm cursor-pointer'
                      : empty
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:bg-[#DECEB8]/55 cursor-pointer'
                  }`}
                >
                  <span className="neu-raised-sm size-9 shrink-0 rounded-[11px] flex items-center justify-center text-[#C58B3C]">
                    <FolderIcon className="w-4 h-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-inter text-[13px] font-semibold text-[#341512] truncate">{f.name}</span>
                    <span className="block font-inter text-[11px] text-[#7D6855] mt-0.5">
                      {empty ? 'Empty folder' : `${f.fileCount} file${f.fileCount === 1 ? '' : 's'}`}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`size-4 shrink-0 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-[#341512]' : 'border-[#341512]/40'}`}
                  >
                    {isSelected && <span className="size-2 rounded-full bg-[#341512]" />}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {folders && folders.length > 0 && (
          <div className="space-y-2">
            <label htmlFor="folder-share-note" className="block font-lora text-[11px] font-bold uppercase tracking-[0.14em] text-[#946525]">
              Message (optional)
            </label>
            <textarea
              id="folder-share-note"
              rows={2}
              maxLength={1000}
              value={note}
              disabled={sharing}
              onChange={(e) => setNote(e.target.value)}
              placeholder={`Add a note for ${counterpartName}`}
              className="neu-input w-full rounded-[16px] py-3 px-4 font-inter text-xs sm:text-sm text-[#23150F] leading-relaxed resize-none"
            />
          </div>
        )}

        {error && <NeuAlert tone="error">{error}</NeuAlert>}
      </div>
    </NeuModal>
  );
}

export default FolderShareModal;
