import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service-role client. NEVER import this file from a "use client"
// component or from anything that could end up in a browser bundle
// — the `server-only` import above makes any such attempt a build
// error, not just a lint warning.
//
// ⚠️ This key has full read/write access to the ENTIRE shared
// Supabase project, not just the certificate_* tables — see
// README.md "Service-role security" for the operational discipline
// this requires. Application code in this repo must never write to
// students / cohorts / instructors / instructor_cohorts / curricula /
// curriculum_classes / class_completions. Reads of those tables are
// fine and expected (displaying student/cohort/instructor names,
// cohort curriculum progress as context).
let cached: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
        "This client must only ever be constructed on the server."
    );
  }

  cached = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return cached;
}
