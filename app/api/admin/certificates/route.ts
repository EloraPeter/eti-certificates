import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { verifyAdminRequest } from "@/lib/supabase/verifyAdmin";

// Lists issued certificates. Per directive §7: "Do not include raw
// verification tokens in generic admin list responses unless
// genuinely required" — this list view excludes verification_token
// entirely. A detail view (if built) that genuinely needs the token
// (e.g. to show the admin the verify URL/QR for support purposes)
// should fetch it explicitly, not via this list.
export async function GET(request: Request) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = getAdminClient();
  const { data, error } = await client
    .from("certificates")
    .select(
      "id, certification_request_id, student_id, cohort_id, certificate_type_id, certificate_number, status, issued_at, issued_by, revoked_at, revoked_reason"
    )
    .order("issued_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
