import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  isRateLimited,
  getClientIdentifier,
} from "@/lib/rateLimit/tokenBucket";
import type {
  PublicVerificationResult,
  Certificate,
} from "@/lib/certificates/types";

const TOKEN_FORMAT = /^[0-9a-f]{32}$/;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const identifier = getClientIdentifier(request);

  if (isRateLimited(identifier)) {
    return NextResponse.json(
      { valid: false } satisfies PublicVerificationResult,
      { status: 429 }
    );
  }

  const { token: rawToken } = await params;
  const token = rawToken?.toLowerCase();

  if (!token || !TOKEN_FORMAT.test(token)) {
    return NextResponse.json(
      { valid: false } satisfies PublicVerificationResult,
      { status: 400 }
    );
  }

  const admin = getAdminClient();

  const { data: certificate } = await admin
    .from("certificates")
    .select(
      "id, certificate_number, status, issued_at, student_id, cohort_id, certificate_type_id"
    )
    .eq("verification_token", token)
    .maybeSingle<
      Pick<
        Certificate,
        | "id"
        | "certificate_number"
        | "status"
        | "issued_at"
        | "student_id"
        | "cohort_id"
        | "certificate_type_id"
      >
    >();

  if (!certificate) {
    return NextResponse.json(
      { valid: false } satisfies PublicVerificationResult
    );
  }

  const [{ data: student }, { data: cohort }, { data: certType }] =
    await Promise.all([
      admin
        .from("students")
        .select("full_name")
        .eq("id", certificate.student_id)
        .single(),
      admin
        .from("cohorts")
        .select("name")
        .eq("id", certificate.cohort_id)
        .single(),
      admin
        .from("certificate_types")
        .select("name")
        .eq("id", certificate.certificate_type_id)
        .single(),
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

  return NextResponse.json(result);
}
