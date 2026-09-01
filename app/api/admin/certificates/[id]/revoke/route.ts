import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { verifyAdminRequest } from "@/lib/supabase/verifyAdmin";
import { logAuditEvent } from "@/lib/certificates/audit";
import { revokeSchema } from "@/lib/validations/certification-request";

// Revocation is a CERTIFICATE-level status change, not a
// certification_requests transition (see workflow.ts). Never
// deletes the row — status becomes 'revoked', reason + timestamp
// recorded, and it still resolves at its verification URL (directive
// §17). There is no un-revoke endpoint in v1 — see workflow.ts
// comment on why `revoked -> issued` is structurally unreachable.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = revokeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "reason is required to revoke a certificate" },
      { status: 400 }
    );
  }

  const client = getAdminClient();
  const { data: certificate, error: fetchError } = await client
    .from("certificates")
    .select("id, status")
    .eq("id", id)
    .single();

  if (fetchError || !certificate) {
    return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
  }

  if (certificate.status === "revoked") {
    return NextResponse.json(
      { error: "Certificate is already revoked" },
      { status: 409 }
    );
  }

  const { data: updated, error } = await client
    .from("certificates")
    .update({
      status: "revoked",
      revoked_at: new Date().toISOString(),
      revoked_reason: parsed.data.reason,
    })
    .eq("id", id)
    .eq("status", "issued")
    .select("*")
    .single();

  if (error || !updated) {
    return NextResponse.json(
      { error: error?.message ?? "Update failed" },
      { status: 409 }
    );
  }

  await logAuditEvent({
    certificateId: id,
    actorType: "admin",
    actorEmail: admin.email,
    eventType: "certificate_revoked",
    notes: parsed.data.reason,
  });

  return NextResponse.json(updated);
}

