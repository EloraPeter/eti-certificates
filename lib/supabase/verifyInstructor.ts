import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getAdminClient } from "./admin";

// Mirrors ETI-cohort's verifyInstructorRequest: bearer token ->
// Supabase Auth user -> lookup in the SAME `instructors` table
// ETI-cohort already owns (auth_user_id, status). No duplicate
// instructor identity or account system is created here — this
// repo reads the existing row.
export type VerifiedInstructor = {
  instructorId: string;
  authUserId: string;
  email: string;
};

export async function verifyInstructorRequest(
  request: Request
): Promise<VerifiedInstructor | null> {
  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const accessToken = authHeader.slice("Bearer ".length).trim();
  if (!accessToken) return null;

  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data, error } = await authClient.auth.getUser(accessToken);
  if (error || !data.user) return null;

  const admin = getAdminClient();
  const { data: instructor, error: instructorError } = await admin
    .from("instructors")
    .select("id, auth_user_id, email, status")
    .eq("auth_user_id", data.user.id)
    .maybeSingle();

  if (instructorError || !instructor) return null;
  if (instructor.status !== "active") return null;

  return {
    instructorId: instructor.id,
    authUserId: instructor.auth_user_id,
    email: instructor.email,
  };
}

// Confirms the given instructor is (still) assigned to the given
// cohort via ETI-cohort's `instructor_cohorts` table — re-checked at
// action time (confirm/decline), not just trusted from whenever the
// certification_requests row was created, in case an assignment
// changed in the interim.
export async function instructorIsAssignedToCohort(
  instructorId: string,
  cohortId: string
): Promise<boolean> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("instructor_cohorts")
    .select("id")
    .eq("instructor_id", instructorId)
    .eq("cohort_id", cohortId)
    .maybeSingle();

  return !error && !!data;
}
