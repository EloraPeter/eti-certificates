import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getSignedCertificateUrl } from "@/lib/certificates/pdf/access";
import { isRateLimited, getClientIdentifier } from "@/lib/rateLimit/tokenBucket";

// PUBLIC, but gated by knowledge of the same random token as the
// verification endpoint — this is the "View Certificate PDF" action
// referenced in directive §9. It never returns a permanent public
// URL: it looks up the certificate by token, then asks Storage for a
// short-lived signed URL and redirects to that. The underlying
// object path (pdf_path) is never sent to the client directly.
const TOKEN_FORMAT = /^[0-9a-f]{32}$/;

export async function GET(request: Request, { params }: { params: { token: string } }) {
  const identifier = getClientIdentifier(request);
  if (isRateLimited(identifier)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const token = params.token?.toLowerCase();
  if (!token || !TOKEN_FORMAT.test(token)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const admin = getAdminClient();
  const { data: certificate } = await admin
    .from("certificates")
    .select("pdf_path, status")
    .eq("verification_token", token)
    .maybeSingle<{ pdf_path: string | null; status: string }>();

  if (!certificate?.pdf_path) {
    return NextResponse.json({ error: "Certificate PDF not available" }, { status: 404 });
  }

  const signedUrl = await getSignedCertificateUrl(certificate.pdf_path);
  if (!signedUrl) {
    return NextResponse.json({ error: "Could not generate a download link" }, { status: 500 });
  }

  return NextResponse.redirect(signedUrl);
}
