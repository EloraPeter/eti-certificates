import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { verifyInstructorRequest } from "@/lib/supabase/verifyInstructor";

// Lists requests awaiting THIS instructor's confirmation only —
// never another instructor's queue. Scoped by instructor_id, which
// was set (and re-validated against instructor_cohorts) at request
// creation time.
export async function GET(request: Request) {
  const instructor = await verifyInstructorRequest(request);
  if (!instructor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("certification_requests")
    .select("*")
    .eq("instructor_id", instructor.instructorId)
    .eq("status", "pending_instructor")
    .order("requested_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
