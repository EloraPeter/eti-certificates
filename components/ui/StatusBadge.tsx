const STYLES: Record<string, string> = {
  pending_instructor: "bg-amber-100 text-amber-800",
  pending_admin: "bg-sky-100 text-sky-800",
  approved: "bg-indigo-100 text-indigo-800",
  issuing: "bg-indigo-100 text-indigo-800",
  issued: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-800",
  cancelled: "bg-slate-100 text-slate-600",
  revoked: "bg-rose-100 text-rose-800",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STYLES[status] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
