import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { verifyAdminRequest } from "@/lib/supabase/verifyAdmin";

// Read-only list of cohorts, for populating the "nominate a student"
// form's cohort selector. SELECT only — see README "Service-role
// security": this repo never writes to `cohorts`.
export async function GET(request: Request) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = getAdminClient();
  const { data, error } = await client
    .from("cohorts")
    .select("id, name, starts_on")
    .order("starts_on", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
