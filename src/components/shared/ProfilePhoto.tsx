'use client';

import React, { useState } from 'react';

/**
 * The app's default profile icon: the person silhouette in a circle used on the dashboard and
 * Find a Lawyer cards. Shown wherever someone has no usable profile photo.
 */
export function DefaultAvatarIcon({
  className = 'w-full h-full',
  strokeWidth = 1.6,
}: {
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
}

/** A photo URL worth trying: not null, blank, or a stringified "null" / "undefined". */
export function usablePhotoUrl(src: string | null | undefined): string | null {
  const value = typeof src === 'string' ? src.trim() : '';
  if (!value || value === 'null' || value === 'undefined') return null;
  return value;
}

/**
 * A person's profile photo, filling the round frame it is placed in. Without a usable photo
 * (missing, empty, or failing to load) the `fallback` shows instead; by default that is the
 * app's profile icon (DefaultAvatarIcon), so every card falls back to the same picture.
 *
 * `ringed` frames a real photo with the same ring the default icon draws: in the text colour
 * (currentColor, so it follows hover colour changes like the icon does) and as thick as the
 * icon's circle stroke at strokeWidth 1.6 (1.6 / 24 of the frame), so it scales with any size.
 */
export function ProfilePhoto({
  src,
  fallback,
  className = '',
  alt = '',
  ringed = false,
}: {
  src: string | null | undefined;
  fallback?: React.ReactNode;
  className?: string;
  alt?: string;
  /** Frame a real photo with the default icon's ring (no effect on the fallback). */
  ringed?: boolean;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const url = usablePhotoUrl(src);
  if (!url || failed === url) return <>{fallback ?? <DefaultAvatarIcon className={className} />}</>;
  const img = (
    // eslint-disable-next-line @next/next/no-img-element -- public avatar from Supabase Storage, any size
    <img
      src={url}
      alt={alt}
      draggable={false}
      onError={() => setFailed(url)}
      className={`block rounded-full object-cover ${ringed ? 'size-full' : className}`}
    />
  );
  if (!ringed) return img;
  // Padding in % is measured against the frame's width, so the ring keeps the icon's proportion.
  return <span className={`block rounded-full bg-current p-[6.67%] transition-colors ${className}`}>{img}</span>;
}

export default ProfilePhoto;
