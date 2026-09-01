"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { InstructorAuthProvider, useInstructorAuth } from "@/lib/auth/InstructorAuthContext";

// Purpose-built, minimal instructor shell for this app only — NOT
// ETI-cohort's InstructorShell (which the other Claude session may
// still be building in Phase C). This repo does not depend on that
// component existing; it has its own, much smaller one (a single
// nav item), per directive §24.
const NAV = [
  { href: "/instructor/confirmations", label: "Confirmations" },
];

function Shell({ children }: { children: React.ReactNode }) {
  const { email, loading, signOut } = useInstructorAuth();
  const pathname = usePathname();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Loading…</div>;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-ink-900">ETI Certificates — Instructor</span>
            <nav className="flex gap-4 text-sm">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={pathname?.startsWith(item.href) ? "font-medium text-brand-royal" : "text-slate-500"}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span>{email}</span>
            <button onClick={signOut} className="text-rose-600">
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}

export default function InstructorPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <InstructorAuthProvider>
      <Shell>{children}</Shell>
    </InstructorAuthProvider>
  );
}
