import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getSignedCertificateUrl } from "@/lib/certificates/pdf/access";
import {
  isRateLimited,
  getClientIdentifier,
} from "@/lib/rateLimit/tokenBucket";

const TOKEN_FORMAT = /^[0-9a-f]{32}$/;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const identifier = getClientIdentifier(request);

  if (isRateLimited(identifier)) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 }
    );
  }

  const { token: rawToken } = await params;
  const token = rawToken?.toLowerCase();

  if (!token || !TOKEN_FORMAT.test(token)) {
    return NextResponse.json(
      { error: "Invalid token" },
      { status: 400 }
    );
  }

  const admin = getAdminClient();

  const { data: certificate } = await admin
    .from("certificates")
    .select("pdf_path, status")
    .eq("verification_token", token)
    .maybeSingle<{ pdf_path: string | null; status: string }>();

  if (!certificate?.pdf_path) {
    return NextResponse.json(
      { error: "Certificate PDF not available" },
      { status: 404 }
    );
  }

  const signedUrl = await getSignedCertificateUrl(certificate.pdf_path);

  if (!signedUrl) {
    return NextResponse.json(
      { error: "Could not generate a download link" },
      { status: 500 }
    );
  }

  return NextResponse.redirect(signedUrl);
}
