'use client';

/**
 * Lawyer Settings → Payment QR: the QR code (GCash, Maya, bank…) clients scan to pay for an
 * approved consultation, with the account details shown under it. Same card, input and button
 * styles as the rest of the lawyer Settings page.
 */
import { useEffect, useRef, useState, useTransition } from 'react';
import {
  getMyPaymentQrAction,
  removeMyPaymentQrAction,
  saveMyPaymentQrAction,
  type LawyerPaymentQr,
} from '@/app/actions/lawyerPaymentQrActions';
import { accountButtonClass, accountInputClass } from './PersonalProfileCard';

const cardClass = 'rounded-2xl p-6 bg-[#EFE5D8] shadow-[5px_5px_12px_rgba(0,0,0,0.06),-5px_-5px_12px_rgba(255,255,255,0.85)] border border-[#E8DCCB]/60 space-y-4';
const quietButtonClass = 'rounded-lg border border-[#D6C4AE] px-4 py-2 text-xs font-medium text-[#34150F] hover:bg-[#E5D7C5] disabled:opacity-50';
const CHANNELS = ['GCash', 'Maya', 'GoTyme', 'BDO', 'BPI', 'UnionBank', 'Metrobank', 'Landbank', 'Other bank / e-wallet'];

export function PaymentQrCard() {
  const [qr, setQr] = useState<LawyerPaymentQr | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
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
    setMessage('');
    start(async () => {
      try {
        const res = await saveMyPaymentQrAction(form);
        if (!res.success) {
          setError(res.error);
          return;
        }
        setQr(res.qr);
        choose(null);
        if (fileInput.current) fileInput.current.value = '';
        setMessage('Your payment QR is saved. Clients will see it when they pay for a consultation with you.');
      } catch {
        setError('Your payment QR could not be saved. Please try again.');
      }
    });
  };

  const remove = () =>
    start(async () => {
      setError('');
      setMessage('');
      const res = await removeMyPaymentQrAction();
      if (!res.success) {
        setError(res.error);
        return;
      }
      setQr(null);
      choose(null);
      formRef.current?.reset();
      setMessage('Your payment QR was removed.');
    });

  return (
    <div className={cardClass}>
      <div>
        <h3 className="font-cormorant font-bold text-lg text-[#34150F]">Payment QR</h3>
        <p className="text-xs text-[#7D6855] mt-1">
          The QR code clients scan to pay you after you approve their consultation. It appears on their payment step together
          with the account details below.
        </p>
      </div>

      {!loaded ? (
        <p className="text-xs text-[#7D6855]" aria-busy="true">Loading your payment QR…</p>
      ) : (
        <form ref={formRef} onSubmit={save} className="space-y-4">
          <fieldset disabled={pending} className="grid grid-cols-1 sm:grid-cols-[180px_minmax(0,1fr)] gap-5 items-start">
            <div className="space-y-2">
              <div className="aspect-square w-full max-w-[180px] rounded-xl bg-white p-2.5 border border-[#E5D7C5] flex items-center justify-center overflow-hidden">
                {shown ? (
                  // eslint-disable-next-line @next/next/no-img-element -- private signed link or local preview
                  <img src={shown} alt="Your payment QR code" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-[11px] text-[#7D6855] text-center px-3">No QR code yet</span>
                )}
              </div>
              <input
                ref={fileInput}
                id="payment-qr-file"
                name="file"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(e) => {
                  setError('');
                  setMessage('');
                  choose(e.target.files?.[0] ?? null);
                }}
              />
              <label htmlFor="payment-qr-file" className={`${quietButtonClass} inline-block cursor-pointer`}>
                {shown ? 'Choose another image' : 'Choose QR image'}
              </label>
              <p className="text-[10.5px] text-[#7D6855]">PNG, JPG or WebP, up to 5 MB.</p>
            </div>

            <div className="grid grid-cols-1 gap-4 text-xs text-[#7D6855]">
              <label>
                Payment channel
                <select name="channel" defaultValue={qr?.channel || 'GCash'} key={`channel-${qr?.updatedAt ?? 'new'}`} className={accountInputClass}>
                  {[...new Set([...(qr?.channel ? [qr.channel] : []), ...CHANNELS])].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                Account name
                <input name="accountName" maxLength={80} defaultValue={qr?.accountName ?? ''} key={`name-${qr?.updatedAt ?? 'new'}`} placeholder="e.g. Maria Santos" className={accountInputClass} />
              </label>
              <label>
                Account / mobile number
                <input name="accountNumber" maxLength={40} defaultValue={qr?.accountNumber ?? ''} key={`number-${qr?.updatedAt ?? 'new'}`} placeholder="e.g. 0917 123 4567" className={accountInputClass} />
              </label>
            </div>
          </fieldset>

          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={pending || (!file && !qr)} className={accountButtonClass}>
              {pending ? 'Saving…' : qr ? 'Save changes' : 'Save payment QR'}
            </button>
            {qr && (
              <button type="button" disabled={pending} onClick={remove} className={quietButtonClass}>
                Remove QR
              </button>
            )}
          </div>
          {!qr && !file && (
            <p className="text-[11px] text-[#7D6855]">Until you add one, clients see Justicia&apos;s general payment QR instead.</p>
          )}
        </form>
      )}

      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      {message && <p className="text-xs text-[#5C4535]">{message}</p>}
    </div>
  );
}

export default PaymentQrCard;
