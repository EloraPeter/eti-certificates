"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminAuthProvider, useAdminAuth } from "@/lib/auth/AdminAuthContext";

// Small, purpose-built shell — deliberately NOT a copy of
// ETI-cohort's AdminShell. This app has five nav items total, none
// of the mobile-drawer complexity ETI-cohort's admin sidebar needs
// for nine pages. Building a smaller thing on purpose, per directive
// §24: "do not waste implementation time recreating ETI-cohort's
// entire portal."
const NAV = [
  { href: "/admin/requests", label: "Requests" },
  { href: "/admin/certificates", label: "Certificates" },
  { href: "/admin/certificate-types", label: "Certificate Types" },
];

function Shell({ children }: { children: React.ReactNode }) {
  const { email, loading, signOut } = useAdminAuth();
  const pathname = usePathname();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Loading…</div>;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-ink-900">ETI Certificates — Admin</span>
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

export default function AdminPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <Shell>{children}</Shell>
    </AdminAuthProvider>
  );
}
