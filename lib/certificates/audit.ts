import "server-only";
import { getAdminClient } from "../supabase/admin";
import type { CertificateActorType } from "./types";

// Append-only writer for certificate_audit_log. There is
// deliberately no corresponding update/delete helper — the table's
// own triggers (see migration 001) reject those at the database
// level regardless. The closed set of event_type values below is
// the vocabulary requested in the directive; extend this list
// deliberately, don't invent ad-hoc event_type strings inline at
// call sites.
export type AuditEventType =
  | "request_created"
  | "instructor_confirmed"
  | "instructor_declined"
  | "admin_approved"
  | "admin_rejected"
  | "admin_overrode"
  | "issuance_started"
  | "certificate_issued"
  | "issuance_failed"
  | "certificate_revoked"
  | "certificate_reissued"; // reserved — no code path emits this in v1; reissuance is not implemented (see workflow.ts)

interface LogAuditEventInput {
  requestId?: string | null;
  certificateId?: string | null;
  actorType: CertificateActorType;
  actorId?: string | null;
  actorEmail?: string | null;
  eventType: AuditEventType;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function logAuditEvent(input: LogAuditEventInput): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin.from("certificate_audit_log").insert({
    request_id: input.requestId ?? null,
    certificate_id: input.certificateId ?? null,
    actor_type: input.actorType,
    actor_id: input.actorId ?? null,
    actor_email: input.actorEmail ?? null,
    event_type: input.eventType,
    notes: input.notes ?? null,
    metadata: input.metadata ?? null,
  });

  if (error) {
    // Deliberately does not throw: a failure to write an audit
    // record should never block the underlying workflow action that
    // already succeeded (e.g. don't fail an approval because the
    // audit insert failed). Logged to the server console so it's
    // visible in deployment logs; a production follow-up could also
    // alert on this specifically, since a missing audit row is a
    // real (if secondary) problem.
    console.error("[certificate_audit_log] failed to write audit event", input.eventType, error);
  }
}
