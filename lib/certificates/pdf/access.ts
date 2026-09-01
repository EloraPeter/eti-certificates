import "server-only";
import { getAdminClient } from "../../supabase/admin";

// Storage is PRIVATE (see migration 002). The only way to view/
// download a certificate PDF is a short-lived signed URL generated
// here, server-side. Nothing in this repo ever constructs or returns
// a permanent public storage URL, and pdf_path (the raw storage
// object path) is never included in the public verification
// response — see app/api/verify/[token]/route.ts.
const SIGNED_URL_TTL_SECONDS = 5 * 60; // 5 minutes — long enough for a real download, short enough to not be a durable link

export async function getSignedCertificateUrl(pdfPath: string): Promise<string | null> {
  const admin = getAdminClient();
  const { data, error } = await admin.storage
    .from("certificates")
    .createSignedUrl(pdfPath, SIGNED_URL_TTL_SECONDS);

  if (error || !data) return null;
  return data.signedUrl;
}
