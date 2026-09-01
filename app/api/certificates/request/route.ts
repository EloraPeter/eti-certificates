import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { verifyAdminRequest } from "@/lib/supabase/verifyAdmin";
import { verifyInstructorRequest, instructorIsAssignedToCohort } from "@/lib/supabase/verifyInstructor";
import { createRequestSchema } from "@/lib/validations/certification-request";
import { logAuditEvent } from "@/lib/certificates/audit";

// Creates a certification_requests row. Callable by an admin
// (origin='admin') or an instructor (origin='instructor'); student
// self-request (origin='student') is schema-supported (see migration
// 001 / types.ts) but intentionally not wired up to an endpoint in
// v1 — see README "What was deliberately not built."
//
// A withdrawn student is a hard block (directive §2), enforced here
// before any row is created.
export async function POST(request: Request) {
  const admin = getAdminClient();

  const adminCaller = await verifyAdminRequest(request);
  const instructorCaller = adminCaller ? null : await verifyInstructorRequest(request);

  if (!adminCaller && !instructorCaller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { studentId, cohortId, certificateTypeId, instructorId, notes } = parsed.data;

  // Hard gate: withdrawn students cannot be certified. This is the
  // ONE automatic eligibility rule in the whole system (directive
  // §2) — everything else is human attestation.
  const { data: student } = await admin
    .from("students")
    .select("id, status, cohort_id")
    .eq("id", studentId)
    .maybeSingle();

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }
  if (student.status === "withdrawn") {
    return NextResponse.json({ error: "This student has withdrawn and cannot be certified." }, { status: 409 });
  }
  if (student.cohort_id !== cohortId) {
    return NextResponse.json({ error: "Student does not belong to the given cohort." }, { status: 400 });
  }

  // The target instructor must genuinely be assigned to this cohort
  // — re-verified here regardless of who's creating the request.
  const assigned = await instructorIsAssignedToCohort(instructorId, cohortId);
  if (!assigned) {
    return NextResponse.json({ error: "That instructor is not assigned to this cohort." }, { status: 400 });
  }

  const isInstructorSelfRequest = instructorCaller && instructorCaller.instructorId === instructorId;

  const { data: created, error } = await admin
    .from("certification_requests")
    .insert({
      student_id: studentId,
      cohort_id: cohortId,
      certificate_type_id: certificateTypeId,
      origin: instructorCaller ? "instructor" : "admin",
      requested_by_email: adminCaller?.email ?? instructorCaller?.email ?? null,
      instructor_id: instructorId,
      // Instructor-originated requests for the instructor's own
      // student are auto-confirmed at creation (directive §5: "their
      // confirmation is implicit") — this is the one place `status`
      // is set to something other than the table default at insert
      // time, and it's a valid starting state, not a transition
      // through workflow.ts (there's nothing to transition from yet).
      status: isInstructorSelfRequest ? "pending_admin" : "pending_instructor",
      instructor_decision: isInstructorSelfRequest ? "confirmed" : null,
      instructor_decided_at: isInstructorSelfRequest ? new Date().toISOString() : null,
      instructor_notes: notes ?? null,
    })
    .select("*")
    .single();

  if (error) {
    // Most likely cause: the partial unique index on
    // (student_id, certificate_type_id) for non-terminal-negative
    // statuses — i.e. a live request already exists.
    return NextResponse.json({ error: error.message }, { status: 409 });
  }

  await logAuditEvent({
    requestId: created.id,
    actorType: adminCaller ? "admin" : "instructor",
    actorId: instructorCaller?.instructorId ?? null,
    actorEmail: adminCaller?.email ?? instructorCaller?.email ?? null,
    eventType: "request_created",
    notes: notes ?? null,
  });

  return NextResponse.json(created, { status: 201 });
}
