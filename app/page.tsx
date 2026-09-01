import Link from "next/link";

// Minimal landing — this app is a tool, not a marketing site. Real
// traffic lands on /verify/[token] via QR scans; admins/instructors
// go straight to their own login.
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold text-ink-900">ETI Certificates</h1>
      <p className="max-w-md text-sm text-slate-500">
        Certificate issuance and public verification for Elora Tech Institute.
      </p>
      <div className="flex gap-3">
        <Link href="/admin" className="rounded-lg bg-brand-royal px-4 py-2 text-sm font-medium text-white">
          Admin sign in
        </Link>
        <Link href="/instructor/login" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium">
          Instructor sign in
        </Link>
      </div>
    </main>
  );
}
