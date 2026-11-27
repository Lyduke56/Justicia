'use client';

/**
 * Lawyer My Profile → Payment QR: the QR code (GCash, Maya, bank…) clients scan to pay for an
 * approved consultation, with the account details shown under it. Built from the same section
 * card, recessed fields and buttons as the rest of the account pages.
 */
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  getMyPaymentQrAction,
  removeMyPaymentQrAction,
  saveMyPaymentQrAction,
  type LawyerPaymentQr,
} from '@/app/actions/lawyerPaymentQrActions';
import { NeuAlert, NeuButton, QrIcon, InfoIcon } from '@/components/shared/neu';
import { PanelLoader, useScreenLoading } from '@/components/shared/loading';
import { SectionCard } from './ClientAccountSettings';
import { SubmissionOverlay, settle, useSubmission } from '@/components/shared/feedback';

const CHANNELS = ['GCash', 'Maya', 'GoTyme', 'BDO', 'BPI', 'UnionBank', 'Metrobank', 'Landbank', 'Other bank / e-wallet'];

const inputClass =
  'neu-input w-full h-11 rounded-[13px] px-4 font-inter text-[13.5px] text-[#34150F] disabled:cursor-not-allowed disabled:opacity-60';
const labelClass = 'block font-lora text-[12.5px] font-semibold text-[#4A3426] mb-1.5';

export function PaymentQrCard() {
  const [qr, setQr] = useState<LawyerPaymentQr | null>(null);
  const [loaded, setLoaded] = useState(false);
  // The My Profile screen's loading screen waits for the payment QR.
  useScreenLoading(!loaded);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  // Saving or removing shows the submission card: loader, then check / X.
  const submission = useSubmission();
  const pending = submission.processing;
  const [removing, setRemoving] = useState(false);
  /** Loading problems, and the last save error once the card is closed. */
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    let cancelled = false;
    getMyPaymentQrAction()
      .then((res) => {
        if (cancelled) return;
        if (res.success) setQr(res.qr);
        else setError(res.error);
      })
      .catch(() => !cancelled && setError('Your payment QR could not be loaded.'))
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // Local preview of a newly chosen image (the old one is released when it is replaced).
  const previewRef = useRef<string | null>(null);
  const choose = (next: File | null) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = next ? URL.createObjectURL(next) : null;
    setFile(next);
    setPreview(previewRef.current);
  };
  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  const shown = preview ?? qr?.imageUrl ?? null;

  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.delete('file');
    if (file) form.set('file', file);
    setError('');
    setRemoving(false);
    void submission
      .run(async () => {
        const result = await settle(async () => {
          const res = await saveMyPaymentQrAction(form);
          if (res.success) {
            setQr(res.qr);
            choose(null);
            if (fileInput.current) fileInput.current.value = '';
          }
          return res;
        }, 'Your payment QR could not be saved. Please try again.');
        return result;
      })
      .then((result) => {
        if (result && !result.ok) setError(result.error);
      });
  };

  const remove = () => {
    setError('');
    setRemoving(true);
    void submission
      .run(() =>
        settle(async () => {
          const res = await removeMyPaymentQrAction();
          if (res.success) {
            setQr(null);
            choose(null);
            formRef.current?.reset();
          }
          return res;
        }, 'Your payment QR could not be removed. Please try again.')
      )
      .then((result) => {
        if (result && !result.ok) setError(result.error);
      });
  };

  return (
    <SectionCard
      labelId="profile-payment-qr"
      icon={<QrIcon className="w-[18px] h-[18px]" />}
      title="Payment QR"
      subtitle="The QR code clients scan to pay you after you approve their consultation. It appears on their payment step with the account details below."
    >
      {!loaded ? (
        <PanelLoader label="Loading your payment QR..." className="py-6!" />
      ) : (
        <form ref={formRef} onSubmit={save} className="space-y-5">
          <fieldset disabled={pending} className="m-0 min-w-0 border-0 p-0 grid grid-cols-1 sm:grid-cols-[190px_minmax(0,1fr)] gap-6 items-start">
            {/* QR preview in a recessed well, with the file picker under it. */}
            <div className="space-y-3">
              <div className="neu-recessed aspect-square w-full max-w-[190px] rounded-[20px] p-3 grid place-items-center">
                {shown ? (
                  <div className="size-full rounded-[12px] bg-white p-2 grid place-items-center overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element -- private signed link or local preview */}
                    <img src={shown} alt="Your payment QR code" className="size-full object-contain" />
                  </div>
                ) : (
                  <span className="flex flex-col items-center gap-2 text-center text-[#9A8270]">
                    <QrIcon className="w-8 h-8" />
                    <span className="font-inter text-[11px] font-medium">No QR code yet</span>
                  </span>
                )}
              </div>
              <input
                ref={fileInput}
                id="payment-qr-file"
                name="file"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="peer sr-only"
                onChange={(e) => {
                  setError('');
                  choose(e.target.files?.[0] ?? null);
                }}
              />
              <label
                htmlFor="payment-qr-file"
                className="neu-raised-sm inline-flex h-9 w-full max-w-[190px] items-center justify-center rounded-xl bg-[#E5D8CB] px-3 font-lora text-[12.5px] font-bold text-[#341512] transition-colors hover:text-[#A8742E] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#C58B3C]/70 cursor-pointer"
              >
                {shown ? 'Choose another image' : 'Choose QR image'}
              </label>
              <p className="font-inter text-[10.5px] text-[#7D6855]">PNG, JPG or WebP, up to 5 MB.</p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label htmlFor="payment-qr-channel" className={labelClass}>Payment channel</label>
                <select
                  id="payment-qr-channel"
                  name="channel"
                  defaultValue={qr?.channel || 'GCash'}
                  key={`channel-${qr?.updatedAt ?? 'new'}`}
                  className={`${inputClass} cursor-pointer`}
                >
                  {[...new Set([...(qr?.channel ? [qr.channel] : []), ...CHANNELS])].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="payment-qr-name" className={labelClass}>Account name</label>
                <input
                  id="payment-qr-name"
                  name="accountName"
                  maxLength={80}
                  defaultValue={qr?.accountName ?? ''}
                  key={`name-${qr?.updatedAt ?? 'new'}`}
                  placeholder="e.g. Maria Santos"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="payment-qr-number" className={labelClass}>Account / mobile number</label>
                <input
                  id="payment-qr-number"
                  name="accountNumber"
                  maxLength={40}
                  defaultValue={qr?.accountNumber ?? ''}
                  key={`number-${qr?.updatedAt ?? 'new'}`}
                  placeholder="e.g. 0917 123 4567"
                  className={inputClass}
                />
              </div>
            </div>
          </fieldset>

          {!qr && !file && (
            <p className="flex items-start gap-2 font-inter text-[11px] text-[#7D6855] leading-relaxed">
              <InfoIcon className="w-3.5 h-3.5 mt-px shrink-0 text-[#C58B3C]" />
              Until you add one, clients see Justicia&apos;s general payment QR instead.
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 border-t border-[#CDBCA8]/60 pt-5 sm:flex-row sm:justify-end">
            {qr && (
              <NeuButton variant="secondary" disabled={pending} onClick={remove}>
                Remove QR
              </NeuButton>
            )}
            <NeuButton type="submit" variant="primary" disabled={pending || (!file && !qr)}>
              {qr ? 'Save Changes' : 'Save Payment QR'}
            </NeuButton>
          </div>
        </form>
      )}

      <AnimatePresence>
        {error && (
          <NeuAlert key="qr-error" tone="error" onDismiss={() => setError('')}>
            {error}
          </NeuAlert>
        )}
      </AnimatePresence>

      <SubmissionOverlay
        submission={submission}
        processing={
          removing
            ? { title: 'Removing your payment QR' }
            : { title: 'Saving your payment QR', message: 'Uploading it securely for your clients.' }
        }
        success={
          removing
            ? { title: 'Payment QR removed', message: "Clients will see Justicia's general payment QR instead." }
            : { title: 'Payment QR saved', message: 'Clients will see it when they pay for a consultation with you.' }
        }
        failure={{ title: removing ? "We couldn't remove your payment QR" : "We couldn't save your payment QR" }}
      />
    </SectionCard>
  );
}

export default PaymentQrCard;
