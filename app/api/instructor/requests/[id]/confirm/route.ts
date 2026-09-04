import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  verifyInstructorRequest,
  instructorIsAssignedToCohort,
} from "@/lib/supabase/verifyInstructor";
import {
  assertTransition,
  IllegalTransitionError,
} from "@/lib/certificates/workflow";
import { logAuditEvent } from "@/lib/certificates/audit";
import type { CertificationRequest } from "@/lib/certificates/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const instructor = await verifyInstructorRequest(request);
  if (!instructor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const admin = getAdminClient();
  const { data: reqRow, error: fetchError } = await admin
    .from("certification_requests")
    .select("*")
    .eq("id", id)
    .single<CertificationRequest>();

  if (fetchError || !reqRow) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (reqRow.instructor_id !== instructor.instructorId) {
    return NextResponse.json(
      { error: "This request is not assigned to you." },
      { status: 403 }
    );
  }

  const stillAssigned = await instructorIsAssignedToCohort(
    instructor.instructorId,
    reqRow.cohort_id
  );

  if (!stillAssigned) {
    return NextResponse.json(
      { error: "You are no longer assigned to this cohort." },
      { status: 403 }
    );
  }

  try {
    assertTransition(reqRow.status, "pending_admin");
  } catch (err) {
    if (err instanceof IllegalTransitionError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }

  const { data: updated, error } = await admin
    .from("certification_requests")
    .update({
      status: "pending_admin",
      instructor_decision: "confirmed",
      instructor_decided_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", reqRow.status)
    .single();

  if (error || !updated) {
    return NextResponse.json(
      { error: error?.message ?? "Update failed" },
      { status: 409 }
    );
  }

  await logAuditEvent({
    requestId: id,
    actorType: "instructor",
    actorId: instructor.instructorId,
    actorEmail: instructor.email,
    eventType: "instructor_confirmed",
  });

  return NextResponse.json(updated);
}
