-- ============================================================
-- ETI Certificate System — Storage
--
-- FINAL DECISION (per directive, supersedes the earlier planning
-- doc's recommendation of a public bucket): the certificate PDF
-- bucket is PRIVATE. A certificate being "shareable" is a product
-- decision handled by exposing a controlled, signed-URL download
-- path (see lib/certificates/pdf/access.ts and
-- app/api/verify/[token]/route.ts) — it does not require the
-- underlying storage object itself to be publicly enumerable or
-- permanently linkable. Never make this bucket public.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('certificates', 'certificates', false)
on conflict (id) do update set public = false;

-- No storage.objects policies are added for anon/authenticated
-- roles — same convention as ETI-cohort's `payment-proofs` bucket.
-- All uploads and all signed-URL generation happen server-side via
-- the service-role key (lib/supabase/admin.ts), which bypasses
-- storage RLS by design. No client ever uploads to or reads from
-- this bucket directly.
