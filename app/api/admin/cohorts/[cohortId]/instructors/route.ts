import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { verifyAdminRequest } from "@/lib/supabase/verifyAdmin";

// Read-only. Joins instructor_cohorts -> instructors to list only
// instructors actually assigned to this cohort.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ cohortId: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { cohortId } = await params;

  const client = getAdminClient();
  const { data, error } = await client
    .from("instructor_cohorts")
    .select("instructors ( id, full_name, email, status )")
    .eq("cohort_id", cohortId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const instructors = (data ?? [])
    .map((row: any) => row.instructors)
    .filter((i: any) => i && i.status === "active");

  return NextResponse.json(instructors);
}

