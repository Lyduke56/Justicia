import Link from 'next/link';

/**
 * Auth Route Group Layout
 *
 * Wraps all authentication pages (/login, /register, /verify-email, /forgot-password)
 * with a centered, minimal dark layout that matches the app's luxury gold-on-dark aesthetic.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 py-12 relative overflow-hidden"
      style={{ background: '#0c0805' }}
    >
      {/* Ambient background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(197,147,65,0.06) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 80% 100%, rgba(197,147,65,0.04) 0%, transparent 70%)',
        }}
      />

      {/* Subtle grid texture */}
      <div
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(#c59341 1px, transparent 1px), linear-gradient(90deg, #c59341 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Content */}
      <div className="relative w-full flex flex-col items-center">
        {children}
      </div>

      {/* Footer note */}
      <p className="relative mt-10 text-[10px] text-[#4a3a2c] text-center">
        © {new Date().getFullYear()} Justicia. All rights reserved.{' '}
        <Link href="/" className="hover:text-[#c59341] transition-colors">
          Return to home
        </Link>
      </p>
    </div>
  );
}
