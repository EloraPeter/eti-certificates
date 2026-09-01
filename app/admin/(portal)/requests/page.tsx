"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/auth/AdminAuthContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { CertificationRequest } from "@/lib/certificates/types";

// Deliberately minimal: list + inline approve/reject/override
// actions. No client-side routing table, no per-status tabs beyond a
// simple filter — a real admin queue for a program this size doesn't
// need more than this to be usable. Every action here calls a server
// route that independently re-checks authorization and legal
// transitions (lib/certificates/workflow.ts) — this page cannot
// force an illegal state change no matter what it sends.
export default function AdminRequestsPage() {
  const { authedFetch } = useAdminAuth();
  const [requests, setRequests] = useState<CertificationRequest[] | null>(null);
  const [filter, setFilter] = useState<string>("pending_admin");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  async function load() {
    const res = await authedFetch(`/api/admin/requests?status=${filter}`);
    if (res.ok) setRequests(await res.json());
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function approve(id: string) {
    setBusyId(id);
    await authedFetch(`/api/admin/requests/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "approved" }),
    });
    setBusyId(null);
    load();
  }

  async function reject(id: string) {
    const notes = notesDraft[id];
    if (!notes) {
      alert("Notes are required to reject a request.");
      return;
    }
    setBusyId(id);
    await authedFetch(`/api/admin/requests/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    setBusyId(null);
    load();
  }

  async function override(id: string) {
    const notes = notesDraft[id];
    if (!notes) {
      alert("Notes are required to override.");
      return;
    }
    setBusyId(id);
    await authedFetch(`/api/admin/requests/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ override: true, notes }),
    });
    setBusyId(null);
    load();
  }

  return (
    <div>
      <PageHeader
        title="Certification requests"
        description="Review instructor-confirmed requests and authorize certification."
        actions={
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="pending_admin">Awaiting admin</option>
            <option value="pending_instructor">Awaiting instructor</option>
            <option value="approved">Approved</option>
            <option value="issued">Issued</option>
            <option value="rejected">Rejected</option>
          </select>
        }
      />

      {!requests ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : requests.length === 0 ? (
        <EmptyState title="No requests in this state" />
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <Card key={r.id}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-ink-900">Request {r.id.slice(0, 8)}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Student {r.student_id.slice(0, 8)} · Cohort {r.cohort_id.slice(0, 8)} · Origin {r.origin}
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </div>

              {r.status === "pending_admin" && (
                <div className="mt-4 space-y-2">
                  <textarea
                    placeholder="Notes (required to reject)"
                    value={notesDraft[r.id] ?? ""}
                    onChange={(e) => setNotesDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <button
                      disabled={busyId === r.id}
                      onClick={() => approve(r.id)}
                      className="rounded-lg bg-brand-royal px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                    >
                      Approve
                    </button>
                    <button
                      disabled={busyId === r.id}
                      onClick={() => reject(r.id)}
                      className="rounded-lg border border-rose-300 px-3 py-1.5 text-sm font-medium text-rose-700 disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}

              {r.status === "pending_instructor" && (
                <div className="mt-4 space-y-2">
                  <textarea
                    placeholder="Override reason (required)"
                    value={notesDraft[r.id] ?? ""}
                    onChange={(e) => setNotesDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    rows={2}
                  />
                  <button
                    disabled={busyId === r.id}
                    onClick={() => override(r.id)}
                    className="rounded-lg border border-amber-300 px-3 py-1.5 text-sm font-medium text-amber-800 disabled:opacity-60"
                  >
                    Override instructor step
                  </button>
                </div>
              )}

              {r.status === "approved" && <IssueButton requestId={r.id} onIssued={load} />}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function IssueButton({ requestId, onIssued }: { requestId: string; onIssued: () => void }) {
  const { authedFetch } = useAdminAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function issue() {
    setBusy(true);
    setError(null);
    const res = await authedFetch(`/api/admin/certificates/${requestId}/issue`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Issuance failed — safe to retry.");
      return;
    }
    onIssued();
  }

  return (
    <div className="mt-4">
      <button
        disabled={busy}
        onClick={issue}
        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {busy ? "Issuing…" : "Issue certificate"}
      </button>
      {error ? <p className="mt-2 text-xs text-rose-600">{error} You can safely click Issue again.</p> : null}
    </div>
  );
}
