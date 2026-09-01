import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { isRateLimited, getClientIdentifier } from "@/lib/rateLimit/tokenBucket";
import type { PublicVerificationResult, Certificate } from "@/lib/certificates/types";

// PUBLIC, UNAUTHENTICATED. Accepts ONLY the random verification
// token — never the human-readable certificate number (see directive
// §7/§26). No Authorization header is read or required.
//
// Token format is validated before it ever reaches a database query:
// 32 lowercase hex characters, matching exactly what
// generate_certificate_identifiers() produces (encode(gen_random_bytes(16),'hex')).
// This rejects obviously-malformed input cheaply, before spending a
// DB round-trip on it.
const TOKEN_FORMAT = /^[0-9a-f]{32}$/;

export async function GET(request: Request, { params }: { params: { token: string } }) {
  const identifier = getClientIdentifier(request);
  if (isRateLimited(identifier)) {
    return NextResponse.json({ valid: false } satisfies PublicVerificationResult, { status: 429 });
  }

  const token = params.token?.toLowerCase();
  if (!token || !TOKEN_FORMAT.test(token)) {
    return NextResponse.json({ valid: false } satisfies PublicVerificationResult, { status: 400 });
  }

  const admin = getAdminClient();
  const { data: certificate } = await admin
    .from("certificates")
    .select("id, certificate_number, status, issued_at, student_id, cohort_id, certificate_type_id")
    .eq("verification_token", token)
    .maybeSingle<Pick<Certificate, "id" | "certificate_number" | "status" | "issued_at" | "student_id" | "cohort_id" | "certificate_type_id">>();

  if (!certificate) {
    // Unknown token — genuinely not found, NOT the same as revoked.
    return NextResponse.json({ valid: false } satisfies PublicVerificationResult);
  }

  // A revoked certificate MUST still resolve — never appear as
  // though it never existed (directive §8/§17).
  const [{ data: student }, { data: cohort }, { data: certType }] = await Promise.all([
    admin.from("students").select("full_name").eq("id", certificate.student_id).single(),
    admin.from("cohorts").select("name").eq("id", certificate.cohort_id).single(),
    admin.from("certificate_types").select("name").eq("id", certificate.certificate_type_id).single(),
  ]);

  const result: PublicVerificationResult = {
    valid: true,
    certificateNumber: certificate.certificate_number,
    recipientName: student?.full_name ?? "",
    certificateType: certType?.name ?? "",
    cohortName: cohort?.name ?? "",
    issuedAt: certificate.issued_at,
    status: certificate.status,
  };

  // Deliberately NOT included anywhere in `result`: certificate.id,
  // student_id, cohort_id, certificate_type_id, pdf_path,
  // verification_token, issued_by, or any other internal detail —
  // see directive §8 "never expose internal IDs."
  return NextResponse.json(result);
}
