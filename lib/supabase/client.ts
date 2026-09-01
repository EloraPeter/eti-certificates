"use client";

// Browser Supabase client — anon key only. Used for the admin and
// instructor sign-in forms (supabase.auth.signInWithPassword /
// getSession), exactly mirroring how ETI-cohort's client-side auth
// works. This client is never used to read/write certificate tables
// directly — RLS has no anon/authenticated policies on those tables
// (see supabase/migrations/001), so a direct client-side query
// would just return zero rows. All certificate data access goes
// through the API routes using the session's access token as a
// bearer credential.
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
