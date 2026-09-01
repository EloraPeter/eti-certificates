import type { ReactNode } from "react";

// Small, dependency-free — vendored to match ETI-cohort's Card
// styling convention rather than published as a shared package.
// See the architecture plan's note on why a shared component
// package isn't worth the coupling for ~5 tiny files.
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}>
      {children}
    </div>
  );
}
