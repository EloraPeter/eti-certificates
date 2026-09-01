"use client";

import { useEffect, useState } from "react";
import { useInstructorAuth } from "@/lib/auth/InstructorAuthContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { CertificationRequest } from "@/lib/certificates/types";

export default function InstructorConfirmationsPage() {
  const { authedFetch } = useInstructorAuth();
  const [requests, setRequests] = useState<CertificationRequest[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  async function load() {
    const res = await authedFetch("/api/instructor/requests");
    if (res.ok) setRequests(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function confirm(id: string) {
    setBusyId(id);
    await authedFetch(`/api/instructor/requests/${id}/confirm`, { method: "POST" });
    setBusyId(null);
    load();
  }

  async function decline(id: string) {
    const notes = notesDraft[id];
    if (!notes) {
      alert("Notes are required to decline.");
      return;
    }
    setBusyId(id);
    await authedFetch(`/api/instructor/requests/${id}/decline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    setBusyId(null);
    load();
  }

  return (
    <div>
      <PageHeader title="Pending confirmations" description="Students awaiting your confirmation for certification." />
      {!requests ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : requests.length === 0 ? (
        <EmptyState title="Nothing pending" description="You're all caught up." />
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <Card key={r.id}>
              <p className="text-sm font-medium text-ink-900">Student {r.student_id.slice(0, 8)}</p>
              <p className="mt-1 text-xs text-slate-500">Requested {new Date(r.requested_at).toLocaleDateString()}</p>
              <div className="mt-4 space-y-2">
                <textarea
                  placeholder="Notes (required to decline)"
                  value={notesDraft[r.id] ?? ""}
                  onChange={(e) => setNotesDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  rows={2}
                />
                <div className="flex gap-2">
                  <button
                    disabled={busyId === r.id}
                    onClick={() => confirm(r.id)}
                    className="rounded-lg bg-brand-royal px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                  >
                    Confirm
                  </button>
                  <button
                    disabled={busyId === r.id}
                    onClick={() => decline(r.id)}
                    className="rounded-lg border border-rose-300 px-3 py-1.5 text-sm font-medium text-rose-700 disabled:opacity-60"
                  >
                    Decline
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
