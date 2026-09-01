// Shared types for certificate_* tables. Hand-written rather than
// generated from `supabase gen types` because this repo's Supabase
// CLI isn't wired up in this environment — regenerate these for
// real once the project is linked (see README "Still needs human
// follow-up").

export type CertificationRequestStatus =
  | "pending_instructor"
  | "pending_admin"
  | "approved"
  | "issuing"
  | "issued"
  | "rejected"
  | "cancelled";

export type CertificationRequestOrigin = "student" | "instructor" | "admin";

export type CertificateStatus = "issued" | "revoked";

export type CertificateActorType = "student" | "instructor" | "admin" | "system" | "public";

export interface CertificateType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  curriculum_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CertificationRequest {
  id: string;
  student_id: string;
  cohort_id: string;
  certificate_type_id: string;
  origin: CertificationRequestOrigin;
  requested_by_email: string | null;
  status: CertificationRequestStatus;
  requested_at: string;
  instructor_id: string | null;
  instructor_decision: "confirmed" | "declined" | null;
  instructor_notes: string | null;
  instructor_decided_at: string | null;
  admin_email: string | null;
  admin_decision: "approved" | "rejected" | null;
  admin_notes: string | null;
  admin_decided_at: string | null;
  override_used: boolean;
  created_at: string;
  updated_at: string;
}

export interface Certificate {
  id: string;
  certification_request_id: string;
  student_id: string;
  cohort_id: string;
  certificate_type_id: string;
  certificate_number: string;
  verification_token: string;
  pdf_path: string | null;
  status: CertificateStatus;
  issued_at: string;
  issued_by: string;
  revoked_at: string | null;
  revoked_reason: string | null;
  created_at: string;
}

// The ONLY shape ever returned by the public verification endpoint.
// Deliberately excludes every internal id, every field not listed
// here, and the verification_token itself.
export interface PublicVerificationResult {
  valid: boolean;
  certificateNumber?: string;
  recipientName?: string;
  certificateType?: string;
  cohortName?: string;
  issuedAt?: string;
  status?: CertificateStatus;
}
