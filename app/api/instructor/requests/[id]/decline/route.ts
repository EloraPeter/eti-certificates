import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { verifyInstructorRequest } from "@/lib/supabase/verifyInstructor";
import { assertTransition, IllegalTransitionError } from "@/lib/certificates/workflow";
import { logAuditEvent } from "@/lib/certificates/audit";
import { instructorDecisionSchema } from "@/lib/validations/certification-request";
import type { CertificationRequest } from "@/lib/certificates/types";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const instructor = await verifyInstructorRequest(request);
  if (!instructor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = instructorDecisionSchema.safeParse({ decision: "declined", ...body });
  if (!parsed.success || parsed.data.decision !== "declined") {
    // Notes are REQUIRED when declining — enforced by the schema
    // (directive §13).
    return NextResponse.json({ error: "notes is required when declining" }, { status: 400 });
  }

  const admin = getAdminClient();
  const { data: reqRow, error: fetchError } = await admin
    .from("certification_requests")
    .select("*")
    .eq("id", params.id)
    .single<CertificationRequest>();

  if (fetchError || !reqRow) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (reqRow.instructor_id !== instructor.instructorId) {
    return NextResponse.json({ error: "This request is not assigned to you." }, { status: 403 });
  }

  try {
    assertTransition(reqRow.status, "rejected");
  } catch (err) {
    if (err instanceof IllegalTransitionError) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }

  const { data: updated, error } = await admin
    .from("certification_requests")
    .update({
      status: "rejected",
      instructor_decision: "declined",
      instructor_notes: parsed.data.notes,
      instructor_decided_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .eq("status", reqRow.status)
    .select("*")
    .single();

  if (error || !updated) return NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 409 });

  await logAuditEvent({
    requestId: params.id,
    actorType: "instructor",
    actorId: instructor.instructorId,
    actorEmail: instructor.email,
    eventType: "instructor_declined",
    notes: parsed.data.notes,
  });

  return NextResponse.json(updated);
}
