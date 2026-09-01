import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { verifyAdminRequest } from "@/lib/supabase/verifyAdmin";

// Lists certification_requests, optionally filtered by ?status=.
// Admins see everything (unlike instructors, who only see their own
// assigned queue) — this is the review surface for pending_admin,
// but also useful for browsing the full history.
export async function GET(request: Request) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status");

  const client = getAdminClient();
  let query = client.from("certification_requests").select("*").order("requested_at", { ascending: false });
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
