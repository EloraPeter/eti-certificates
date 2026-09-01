import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { verifyAdminRequest } from "@/lib/supabase/verifyAdmin";
import { assertTransition, IllegalTransitionError } from "@/lib/certificates/workflow";
import { logAuditEvent } from "@/lib/certificates/audit";
import { adminDecisionSchema } from "@/lib/validations/certification-request";
import type { CertificationRequest } from "@/lib/certificates/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = adminDecisionSchema.safeParse({
    decision: "rejected",
    ...body,
  });

  if (!parsed.success || parsed.data.decision !== "rejected") {
    return NextResponse.json(
      { error: "notes is required when rejecting" },
      { status: 400 }
    );
  }

  const client = getAdminClient();

  const { data: reqRow, error: fetchError } = await client
    .from("certification_requests")
    .select("*")
    .eq("id", id)
    .single<CertificationRequest>();

  if (fetchError || !reqRow) {
    return NextResponse.json(
      { error: "Request not found" },
      { status: 404 }
    );
  }

  try {
    assertTransition(reqRow.status, "rejected");
  } catch (err) {
    if (err instanceof IllegalTransitionError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }

  const { data: updated, error } = await client
    .from("certification_requests")
    .update({
      status: "rejected",
      admin_decision: "rejected",
      admin_notes: parsed.data.notes,
      admin_email: admin.email,
      admin_decided_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", reqRow.status)
    .select("*")
    .single();

  if (error || !updated) {
    return NextResponse.json(
      { error: error?.message ?? "Update failed" },
      { status: 409 }
    );
  }

  await logAuditEvent({
    requestId: id,
    actorType: "admin",
    actorEmail: admin.email,
    eventType: "admin_rejected",
    notes: parsed.data.notes,
  });

  return NextResponse.json(updated);
}
