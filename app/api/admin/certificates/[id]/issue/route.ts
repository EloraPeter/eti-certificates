import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/supabase/verifyAdmin";
import { issueCertificate } from "@/lib/certificates/issue";

// [id] here is the certification_requests.id, not a certificates.id
// — a certificate may not exist yet when this is first called.
// Idempotent and safely retryable — see lib/certificates/issue.ts.
// This is the only route that ever creates a `certificates` row.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const certificate = await issueCertificate(id, admin.email);
    return NextResponse.json(certificate);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Issuance failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
