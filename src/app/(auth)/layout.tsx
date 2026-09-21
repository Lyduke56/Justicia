/**
 * Auth Route Group Layout
 *
 * Wraps all authentication pages (/login, /register, /verify-email, /forgot-password)
 * with a centered, minimal layout.
 *
 * TODO: Add brand logo/header
 * TODO: Add language switcher (EN / Filipino)
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/40">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">Justicia</h1>
          <p className="text-sm text-muted-foreground mt-1">Philippine Legal Assistance Platform</p>
        </div>
        {children}
      </div>
    </div>
  );
}
