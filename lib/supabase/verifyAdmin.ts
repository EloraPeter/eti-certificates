import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getAdminClient } from "./admin";

// Mirrors the AUTHENTICATION architecture already established by
// ETI-cohort's verifyAdminRequest: a bearer token (the caller's
// Supabase Auth access token, obtained client-side via
// supabase.auth.getSession() and sent as `Authorization: Bearer …`)
// is verified server-side against Supabase Auth, and the resulting
// user's email is checked against a server-side admin allow-list.
//
// Deliberate deviation from ETI-cohort's NEXT_PUBLIC_ADMIN_EMAILS:
// this repo uses a server-only ADMIN_EMAILS variable instead (see
// directive §14 / §23, and the README "Authentication" section for
// the full reasoning). ETI-cohort's own use of a NEXT_PUBLIC_ variable
// for its admin list is not modified by this repo — that's ETI-cohort's
// existing, unrelated decision, left untouched.
export type VerifiedAdmin = {
  email: string;
  userId: string;
};

export async function verifyAdminRequest(
  request: Request
): Promise<VerifiedAdmin | null> {
  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const accessToken = authHeader.slice("Bearer ".length).trim();
  if (!accessToken) return null;

  // Verify the token against Supabase Auth using the anon client —
  // this validates the token's signature/expiry without needing the
  // service-role key, same as ETI-cohort's pattern.
  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data, error } = await authClient.auth.getUser(accessToken);
  if (error || !data.user?.email) return null;

  const email = data.user.email.toLowerCase();
  const allowList = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (!allowList.includes(email)) return null;

  return { email, userId: data.user.id };
}
