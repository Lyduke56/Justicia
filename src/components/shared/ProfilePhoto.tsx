'use client';

import React, { useState } from 'react';

/**
 * A person's profile photo, filling the round frame it is placed in. Without a photo (or if it
 * fails to load) the `fallback` shows instead: the screen's usual person icon or initials.
 */
export function ProfilePhoto({
  src,
  fallback,
  className = '',
  alt = '',
}: {
  src: string | null | undefined;
  fallback: React.ReactNode;
  className?: string;
  alt?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- public avatar from Supabase Storage, any size
    <img src={src} alt={alt} draggable={false} onError={() => setFailed(src)} className={`block rounded-full object-cover ${className}`} />
  );
}

export default ProfilePhoto;
