import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { verifyAdminRequest } from "@/lib/supabase/verifyAdmin";
import { assertTransition, IllegalTransitionError } from "@/lib/certificates/workflow";
import { logAuditEvent } from "@/lib/certificates/audit";
import { adminDecisionSchema, adminOverrideSchema } from "@/lib/validations/certification-request";
import type { CertificationRequest } from "@/lib/certificates/types";

// Handles TWO distinct admin actions on the same route, disambiguated
// by the request body:
//
//   1. Normal approval: pending_admin -> approved.
//   2. Override: pending_instructor -> pending_admin, skipping the
//      instructor's confirmation. Requires `override: true` and
//      mandatory notes (directive §12/§14). This does NOT itself
//      approve the request — it only moves it into the admin queue;
//      a SEPARATE, subsequent call to this same endpoint (without
//      `override: true`, once the request is at pending_admin) is
//      needed to actually approve it. This keeps "skip the
//      instructor" and "approve" as two distinct, separately audited
//      decisions rather than one action that does both at once.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const client = getAdminClient();

  const { data: reqRow, error: fetchError } = await client
    .from("certification_requests")
    .select("*")
    .eq("id", params.id)
    .single<CertificationRequest>();

  if (fetchError || !reqRow) return NextResponse.json({ error: "Request not found" }, { status: 404 });

  if (body?.override === true) {
    const parsed = adminOverrideSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "notes is required for an override" }, { status: 400 });

    try {
      assertTransition(reqRow.status, "pending_admin");
    } catch (err) {
      if (err instanceof IllegalTransitionError) return NextResponse.json({ error: err.message }, { status: 409 });
      throw err;
    }

    const { data: updated, error } = await client
      .from("certification_requests")
      .update({
        status: "pending_admin",
        admin_notes: parsed.data.notes,
        admin_email: admin.email,
        override_used: true,
      })
      .eq("id", params.id)
      .eq("status", reqRow.status)
      .select("*")
      .single();

    if (error || !updated) return NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 409 });

    await logAuditEvent({
      requestId: params.id,
      actorType: "admin",
      actorEmail: admin.email,
      eventType: "admin_overrode",
      notes: parsed.data.notes,
    });

    return NextResponse.json(updated);
  }

  const parsed = adminDecisionSchema.safeParse(body);
  if (!parsed.success || parsed.data.decision !== "approved") {
    return NextResponse.json({ error: "Invalid payload for approval" }, { status: 400 });
  }

  try {
    assertTransition(reqRow.status, "approved");
  } catch (err) {
    if (err instanceof IllegalTransitionError) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }

  const { data: updated, error } = await client
    .from("certification_requests")
    .update({
      status: "approved",
      admin_decision: "approved",
      admin_notes: parsed.data.notes ?? null,
      admin_email: admin.email,
      admin_decided_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .eq("status", reqRow.status)
    .select("*")
    .single();

  if (error || !updated) return NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 409 });

  await logAuditEvent({
    requestId: params.id,
    actorType: "admin",
    actorEmail: admin.email,
    eventType: "admin_approved",
    notes: parsed.data.notes ?? null,
  });

  return NextResponse.json(updated);
}
