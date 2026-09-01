"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/auth/AdminAuthContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface CertificateListItem {
  id: string;
  certificate_number: string;
  status: "issued" | "revoked";
  issued_at: string;
  issued_by: string;
  revoked_reason: string | null;
}

export default function AdminCertificatesPage() {
  const { authedFetch } = useAdminAuth();
  const [certificates, setCertificates] = useState<CertificateListItem[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const res = await authedFetch("/api/admin/certificates");
    if (res.ok) setCertificates(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function revoke(id: string) {
    const reason = prompt("Reason for revocation (required):");
    if (!reason) return;
    setBusyId(id);
    await authedFetch(`/api/admin/certificates/${id}/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    setBusyId(null);
    load();
  }

  return (
    <div>
      <PageHeader title="Issued certificates" description="Search, review, and revoke issued certificates." />
      {!certificates ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : certificates.length === 0 ? (
        <EmptyState title="No certificates issued yet" />
      ) : (
        <div className="space-y-3">
          {certificates.map((c) => (
            <Card key={c.id}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-sm text-ink-900">{c.certificate_number}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Issued {new Date(c.issued_at).toLocaleDateString()} by {c.issued_by}
                  </p>
                  {c.revoked_reason ? <p className="mt-1 text-xs text-rose-600">Revoked: {c.revoked_reason}</p> : null}
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={c.status} />
                  {c.status === "issued" && (
                    <button
                      disabled={busyId === c.id}
                      onClick={() => revoke(c.id)}
                      className="text-sm font-medium text-rose-600 disabled:opacity-60"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
