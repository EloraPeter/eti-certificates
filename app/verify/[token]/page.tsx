import { getAdminClient } from "@/lib/supabase/admin";
import type { PublicVerificationResult, Certificate } from "@/lib/certificates/types";

// Server component — queries directly via the service-role client
// rather than fetching its own /api/verify/[token] over HTTP (no
// point round-tripping through the network for an SSR page in the
// same process). The API route still exists separately for external/
// programmatic verification (e.g. an employer's HR system checking a
// certificate by URL). Both share the same "minimal DTO, no internal
// IDs" contract — kept here as its own query rather than importing
// route.ts's handler, since route handlers aren't meant to be called
// as plain functions.
const TOKEN_FORMAT = /^[0-9a-f]{32}$/;

async function lookupCertificate(token: string): Promise<PublicVerificationResult> {
  if (!TOKEN_FORMAT.test(token)) return { valid: false };

  const admin = getAdminClient();
  const { data: certificate } = await admin
    .from("certificates")
    .select("certificate_number, status, issued_at, student_id, cohort_id, certificate_type_id")
    .eq("verification_token", token)
    .maybeSingle<Pick<Certificate, "certificate_number" | "status" | "issued_at" | "student_id" | "cohort_id" | "certificate_type_id">>();

  if (!certificate) return { valid: false };

  const [{ data: student }, { data: cohort }, { data: certType }] = await Promise.all([
    admin.from("students").select("full_name").eq("id", certificate.student_id).single(),
    admin.from("cohorts").select("name").eq("id", certificate.cohort_id).single(),
    admin.from("certificate_types").select("name").eq("id", certificate.certificate_type_id).single(),
  ]);

  return {
    valid: true,
    certificateNumber: certificate.certificate_number,
    recipientName: student?.full_name ?? "",
    certificateType: certType?.name ?? "",
    cohortName: cohort?.name ?? "",
    issuedAt: certificate.issued_at,
    status: certificate.status,
  };
}

export default async function VerifyPage({ params }: { params: { token: string } }) {
  const result = await lookupCertificate(params.token.toLowerCase());

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        {!result.valid ? (
          <>
            <p className="text-lg font-semibold text-rose-600">Not a valid certificate</p>
            <p className="mt-2 text-sm text-slate-500">
              We couldn&apos;t find a certificate matching this link. If you believe this is an error, contact
              Elora Tech Institute.
            </p>
          </>
        ) : (
          <>
            {result.status === "revoked" ? (
              <p className="mb-3 inline-flex items-center rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-800">
                REVOKED
              </p>
            ) : (
              <p className="mb-3 inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
                Valid certificate
              </p>
            )}
            <h1 className="text-xl font-semibold text-ink-900">{result.recipientName}</h1>
            <p className="mt-1 text-sm text-slate-600">{result.certificateType}</p>
            <p className="text-sm text-slate-500">{result.cohortName}</p>
            <p className="mt-4 text-xs text-slate-400">
              Issued {result.issuedAt ? new Date(result.issuedAt).toLocaleDateString() : ""} · {result.certificateNumber}
            </p>
            <a
              href={`/api/verify/${params.token}/pdf`}
              className="mt-6 inline-block rounded-lg bg-brand-royal px-4 py-2 text-sm font-medium text-white"
            >
              View certificate PDF
            </a>
          </>
        )}
      </div>
    </main>
  );
}
