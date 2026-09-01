"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/auth/AdminAuthContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { CertificateType } from "@/lib/certificates/types";

export default function CertificateTypesPage() {
  const { authedFetch } = useAdminAuth();
  const [types, setTypes] = useState<CertificateType[] | null>(null);
  const [form, setForm] = useState({ code: "", name: "", description: "" });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const res = await authedFetch("/api/admin/certificate-types");
    if (res.ok) setTypes(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await authedFetch("/api/admin/certificate-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSubmitting(false);
    setForm({ code: "", name: "", description: "" });
    load();
  }

  return (
    <div>
      <PageHeader title="Certificate types" description="Manage the certificate types students can be issued." />

      <Card className="mb-6">
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-3">
          <input
            required
            placeholder="Code (e.g. WD-COMPLETION)"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            required
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-brand-royal px-3 py-2 text-sm font-medium text-white disabled:opacity-60 sm:col-span-3 sm:w-fit"
          >
            Add certificate type
          </button>
        </form>
      </Card>

      {!types ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : types.length === 0 ? (
        <EmptyState title="No certificate types yet" description="Add one above to start issuing certificates." />
      ) : (
        <div className="space-y-3">
          {types.map((t) => (
            <Card key={t.id}>
              <p className="text-sm font-medium text-ink-900">{t.name}</p>
              <p className="font-mono text-xs text-slate-500">{t.code}</p>
              {t.description ? <p className="mt-1 text-sm text-slate-600">{t.description}</p> : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
