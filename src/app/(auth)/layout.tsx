import React from 'react';

/**
 * Auth Route Group Layout
 *
 * Full-width canvas allowing split-screen auth pages (/register, /login)
 * to render edge-to-edge with gavel imagery and neumorphic panels.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-[#0c0805]">
      {children}
    </div>
  );
}
