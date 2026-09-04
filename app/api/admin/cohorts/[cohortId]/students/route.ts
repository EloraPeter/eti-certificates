import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { verifyAdminRequest } from "@/lib/supabase/verifyAdmin";

// Read-only. Deliberately filters out withdrawn students here so the
// nomination form never offers an ineligible student.
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
    .from("students")
    .select("id, full_name, email, status")
    .eq("cohort_id", cohortId)
    .eq("status", "active")
    .order("full_name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
