"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/auth/AdminAuthContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import type { CertificateType } from "@/lib/certificates/types";

interface Cohort {
  id: string;
  name: string;
  starts_on: string | null;
}
interface StudentOption {
  id: string;
  full_name: string;
  email: string;
}
interface InstructorOption {
  id: string;
  full_name: string;
  email: string;
}

// The "create a certification_requests row" UI referenced in the
// testing walkthrough — previously only reachable via a raw curl
// call to POST /api/certificates/request. This form does exactly
// what that curl call did, with dropdowns instead of hand-typed
// UUIDs. Every dependent list (students, instructors) is scoped to
// the chosen cohort via the new read-only /api/admin/cohorts/[id]/*
// endpoints, so this form can't even offer a combination the create
// route would reject — though the create route re-validates
// everything itself regardless (this form is UX, not the security
// boundary, same as everywhere else in this repo).
export default function NewCertificationRequestPage() {
  const { authedFetch } = useAdminAuth();
  const router = useRouter();

  const [cohorts, setCohorts] = useState<Cohort[] | null>(null);
  const [certificateTypes, setCertificateTypes] = useState<CertificateType[] | null>(null);
  const [students, setStudents] = useState<StudentOption[] | null>(null);
  const [instructors, setInstructors] = useState<InstructorOption[] | null>(null);

  const [cohortId, setCohortId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [instructorId, setInstructorId] = useState("");
  const [certificateTypeId, setCertificateTypeId] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authedFetch("/api/admin/cohorts").then(async (r) => r.ok && setCohorts(await r.json()));
    authedFetch("/api/admin/certificate-types").then(async (r) => r.ok && setCertificateTypes(await r.json()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setStudentId("");
    setInstructorId("");
    setStudents(null);
    setInstructors(null);
    if (!cohortId) return;
    authedFetch(`/api/admin/cohorts/${cohortId}/students`).then(async (r) => r.ok && setStudents(await r.json()));
    authedFetch(`/api/admin/cohorts/${cohortId}/instructors`).then(async (r) => r.ok && setInstructors(await r.json()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cohortId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await authedFetch("/api/certificates/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, cohortId, certificateTypeId, instructorId, notes: notes || undefined }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(typeof body.error === "string" ? body.error : "Could not create the request.");
      return;
    }

    router.push("/admin/requests");
  }

  const ready = cohortId && studentId && instructorId && certificateTypeId;

  return (
    <div>
      <PageHeader title="Nominate a student" description="Start a certification request on a student's behalf." />
      <Card className="max-w-xl">
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm">
            Cohort
            <select
              required
              value={cohortId}
              onChange={(e) => setCohortId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="" disabled>
                {cohorts === null ? "Loading…" : "Select a cohort"}
              </option>
              {cohorts?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            Student
            <select
              required
              disabled={!cohortId}
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
            >
              <option value="" disabled>
                {!cohortId ? "Pick a cohort first" : students === null ? "Loading…" : students.length === 0 ? "No active students in this cohort" : "Select a student"}
              </option>
              {students?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} — {s.email}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            Instructor
            <select
              required
              disabled={!cohortId}
              value={instructorId}
              onChange={(e) => setInstructorId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
            >
              <option value="" disabled>
                {!cohortId ? "Pick a cohort first" : instructors === null ? "Loading…" : instructors.length === 0 ? "No instructors assigned to this cohort" : "Select an instructor"}
              </option>
              {instructors?.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.full_name} — {i.email}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-slate-400">
              This instructor must confirm the request before it reaches you for approval.
            </span>
          </label>

          <label className="block text-sm">
            Certificate type
            <select
              required
              value={certificateTypeId}
              onChange={(e) => setCertificateTypeId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="" disabled>
                {certificateTypes === null ? "Loading…" : certificateTypes.length === 0 ? "No certificate types yet — add one first" : "Select a type"}
              </option>
              {certificateTypes?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            Notes (optional)
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <button
            type="submit"
            disabled={!ready || submitting}
            className="rounded-lg bg-brand-royal px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {submitting ? "Creating…" : "Create request"}
          </button>
        </form>
      </Card>
    </div>
  );
}
