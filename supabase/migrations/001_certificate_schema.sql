-- ============================================================
-- ETI Certificate System — Schema
--
-- ⚠️ DEPENDENCY: this migration must be run against the SAME
-- Supabase project/database as `ETI-cohort`, AFTER ETI-cohort's
-- own migrations (001–014 as of milestone-2-onboarding) already
-- exist there. Specifically, this migration assumes the following
-- already exist in the database and does NOT create them:
--
--   - extension "pgcrypto"                         (ETI-cohort 001)
--   - function  set_updated_at()                    (ETI-cohort 001)
--   - table     cohorts (id uuid, ...)               (ETI-cohort 001)
--   - table     students (id uuid, status text, ...)  (ETI-cohort 002/003)
--   - table     instructors (id uuid, status instructor_status, ...) (ETI-cohort 009)
--   - table     instructor_cohorts (instructor_id, cohort_id, ...)   (ETI-cohort 010)
--   - table     curricula (id uuid, ...)              (ETI-cohort 011)
--
-- This migration does NOT create, alter, or drop any of the tables
-- above. It only references them via foreign key. If any of the
-- referenced tables/columns do not exist when this is run, it will
-- fail loudly at the `references` clause — that is intentional; do
-- not weaken a reference to work around a missing dependency.
--
-- pgcrypto is declared here too (idempotent) so this migration file
-- is self-contained/readable on its own, even though ETI-cohort's
-- 001_initial_schema.sql already enables it in this database.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- certificate_types
-- ------------------------------------------------------------
create table if not exists certificate_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,              -- e.g. 'WD-COMPLETION'
  name text not null,                     -- e.g. 'Certificate of Completion — Web Development'
  description text,

  -- Optional, meaningful link to an ETI-cohort curriculum: when set,
  -- this certificate type is understood to correspond to completing
  -- that specific curriculum (used to select the default certificate
  -- type when creating a request for a cohort whose `cohorts.curriculum_id`
  -- matches, and to show curriculum-relevant context on the request
  -- detail screen). Not required — a certificate type can also stand
  -- alone (e.g. a participation certificate not tied to any curriculum).
  curriculum_id uuid references curricula (id) on delete set null,

  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists certificate_types_curriculum_id_idx on certificate_types (curriculum_id);

drop trigger if exists certificate_types_set_updated_at on certificate_types;
create trigger certificate_types_set_updated_at
  before update on certificate_types
  for each row
  execute function set_updated_at();   -- reuses the function ETI-cohort already created

alter table certificate_types enable row level security;

-- ------------------------------------------------------------
-- certification_requests — the workflow table
--
-- State machine (enforced in application code, see
-- lib/certificates/workflow.ts — this is documented here as SQL
-- comments only; the enum below intentionally does NOT constrain
-- transitions itself, since Postgres enums can't express a
-- transition graph. The API layer is the enforcement point, per
-- the directive: "The UI is NOT the security boundary" applies
-- equally to "the enum is not the security boundary.")
--
--   pending_instructor -> pending_admin -> approved -> issuing -> issued
--   pending_instructor -> rejected
--   pending_instructor -> cancelled
--   pending_admin      -> rejected
--   pending_admin      -> cancelled
--
-- Admin override: pending_instructor -> pending_admin directly,
-- application-enforced to require admin_notes when taken.
--
-- Explicitly, permanently impossible via the API (see workflow.ts):
--   issued -> approved | rejected | pending_admin
--   rejected -> approved
--   cancelled -> approved
-- Revocation is a CERTIFICATE-level action (see `certificates.status`
-- below), not a certification_requests transition — an issued
-- request stays 'issued' forever; the certificate it produced can
-- separately become 'revoked'.
-- ------------------------------------------------------------
create type certification_request_status as enum (
  'pending_instructor',
  'pending_admin',
  'approved',
  'issuing',
  'issued',
  'rejected',
  'cancelled'
);

create type certification_request_origin as enum ('student', 'instructor', 'admin');

create table if not exists certification_requests (
  id uuid primary key default gen_random_uuid(),

  student_id uuid not null references students (id) on delete restrict,
  cohort_id uuid not null references cohorts (id) on delete restrict,
  certificate_type_id uuid not null references certificate_types (id) on delete restrict,

  origin certification_request_origin not null,
  requested_by_email text,                 -- admin/instructor email; null for student self-request
  status certification_request_status not null default 'pending_instructor',
  requested_at timestamptz not null default now(),

  -- The instructor who must confirm (or who originated the request).
  -- Set at creation time; re-validated against instructor_cohorts at
  -- confirm-time in application code (see verifyInstructorRequest +
  -- workflow.ts), not just trusted from creation.
  instructor_id uuid references instructors (id) on delete set null,
  instructor_decision text check (instructor_decision in ('confirmed', 'declined')),
  instructor_notes text,
  instructor_decided_at timestamptz,

  -- Set when an admin approves/rejects/overrides. Free-text email
  -- rather than an FK, matching ETI-cohort's own convention for
  -- recording "which admin did this" (see payments.reviewed_by in
  -- ETI-cohort 002) — admins are an email allow-list, not a table
  -- with a stable id in this schema.
  admin_email text,
  admin_decision text check (admin_decision in ('approved', 'rejected')),
  admin_notes text,
  admin_decided_at timestamptz,

  -- Required when instructor_decision = 'declined' or admin_decision
  -- = 'rejected', and required whenever an admin override skips the
  -- instructor step. Enforced in application code (see validations/),
  -- not by a CHECK constraint, because the requirement is conditional
  -- on which field changed, which is awkward to express safely as a
  -- single-row CHECK across nullable columns that get set at
  -- different times.
  override_used boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One live (non-terminal-negative) request per student+type at a time.
-- 'rejected' and 'cancelled' are excluded so a student can be
-- re-requested for the same certificate type after a decline/withdrawal.
create unique index if not exists certification_requests_active_unique
  on certification_requests (student_id, certificate_type_id)
  where status not in ('rejected', 'cancelled');

create index if not exists certification_requests_status_idx on certification_requests (status);
create index if not exists certification_requests_student_id_idx on certification_requests (student_id);
create index if not exists certification_requests_cohort_id_idx on certification_requests (cohort_id);
create index if not exists certification_requests_instructor_id_idx on certification_requests (instructor_id);

drop trigger if exists certification_requests_set_updated_at on certification_requests;
create trigger certification_requests_set_updated_at
  before update on certification_requests
  for each row
  execute function set_updated_at();

alter table certification_requests enable row level security;

-- ------------------------------------------------------------
-- Year-scoped certificate number counter.
--
-- One row per calendar year. `allocate_certificate_number()` below
-- performs a single atomic upsert (INSERT ... ON CONFLICT DO UPDATE
-- ... RETURNING) per call, which Postgres serializes at the row
-- level — concurrent issuance requests in the same year cannot
-- receive the same sequence value, without needing an explicit
-- SELECT ... FOR UPDATE. This is a deliberate choice over a single
-- global sequence: a global sequence would keep incrementing across
-- year boundaries (ETI-CERT-2027-00042 the first certificate of
-- 2027), which is the opposite of what "year-scoped" means. Each
-- year restarts at 00001.
-- ------------------------------------------------------------
create table if not exists certificate_number_counters (
  year integer primary key,
  last_value integer not null default 0
);

alter table certificate_number_counters enable row level security;

create or replace function allocate_certificate_number(p_year integer)
returns integer as $$
declare
  v_next integer;
begin
  insert into certificate_number_counters (year, last_value)
  values (p_year, 1)
  on conflict (year) do update
    set last_value = certificate_number_counters.last_value + 1
  returning last_value into v_next;

  return v_next;
end;
$$ language plpgsql;

-- ------------------------------------------------------------
-- certificates — issued credentials
--
-- certificate_number and verification_token are deliberately two
-- separate columns with two separate generation strategies (see
-- generate_certificate_identifiers() below) — see directive §5/§6/§26.
-- Never derive one from the other.
-- ------------------------------------------------------------
create table if not exists certificates (
  id uuid primary key default gen_random_uuid(),
  certification_request_id uuid not null unique references certification_requests (id) on delete restrict,

  student_id uuid not null references students (id) on delete restrict,
  cohort_id uuid not null references cohorts (id) on delete restrict,
  certificate_type_id uuid not null references certificate_types (id) on delete restrict,

  certificate_number text not null unique,   -- ETI-CERT-{year}-{00001}, year-scoped, human-readable, NOT secret
  verification_token text not null unique,   -- 32 hex chars, cryptographically random, the ONLY verification credential

  pdf_path text,                             -- object path in the private `certificates` storage bucket
  status text not null default 'issued' check (status in ('issued', 'revoked')),

  issued_at timestamptz not null default now(),
  issued_by text not null,                   -- admin email
  revoked_at timestamptz,
  revoked_reason text,

  created_at timestamptz not null default now()
);

create index if not exists certificates_student_id_idx on certificates (student_id);
create index if not exists certificates_cohort_id_idx on certificates (cohort_id);
create index if not exists certificates_status_idx on certificates (status);
-- Note: verification_token already has a UNIQUE constraint, which
-- Postgres backs with an index automatically — no separate index
-- needed for the verify-by-token lookup path.

alter table certificates enable row level security;

create or replace function generate_certificate_identifiers()
returns trigger as $$
declare
  v_year integer;
  v_seq integer;
begin
  if new.certificate_number is null then
    v_year := extract(year from now())::integer;
    v_seq := allocate_certificate_number(v_year);
    new.certificate_number := 'ETI-CERT-' || v_year::text || '-' || lpad(v_seq::text, 5, '0');
  end if;

  if new.verification_token is null then
    -- 16 random bytes -> 32 hex characters. Cryptographically secure
    -- (pgcrypto's gen_random_bytes uses the OS CSPRNG), not derived
    -- from certificate_number, student_id, or email in any way.
    new.verification_token := encode(gen_random_bytes(16), 'hex');
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists certificates_generate_identifiers on certificates;
create trigger certificates_generate_identifiers
  before insert on certificates
  for each row
  execute function generate_certificate_identifiers();

-- ------------------------------------------------------------
-- certificate_audit_log — required, append-only audit trail.
--
-- Enforced append-only at the DATABASE level (not just by
-- convention): the triggers below reject any UPDATE or DELETE on
-- this table outright, including from the service-role connection.
-- This is deliberately stronger than the "no anon policy" RLS
-- convention used elsewhere — an audit log that could be quietly
-- edited by the same key that writes it isn't a meaningful audit
-- log. If a mistaken row is ever written, correct it with a new
-- row referencing the same request/certificate, never by touching
-- the original.
-- ------------------------------------------------------------
create type certificate_actor_type as enum ('student', 'instructor', 'admin', 'system', 'public');

create table if not exists certificate_audit_log (
  id uuid primary key default gen_random_uuid(),

  request_id uuid references certification_requests (id) on delete set null,
  certificate_id uuid references certificates (id) on delete set null,

  actor_type certificate_actor_type not null,
  actor_id uuid,          -- instructors.id when actor_type = 'instructor'; null otherwise (admins have no stable id in this schema — see admin_email)
  actor_email text,       -- admin or instructor email where applicable

  event_type text not null,   -- see lib/certificates/audit.ts for the closed set of event_type values in use
  notes text,
  metadata jsonb,

  created_at timestamptz not null default now()
);

create index if not exists certificate_audit_log_request_id_idx on certificate_audit_log (request_id);
create index if not exists certificate_audit_log_certificate_id_idx on certificate_audit_log (certificate_id);
create index if not exists certificate_audit_log_event_type_idx on certificate_audit_log (event_type);
create index if not exists certificate_audit_log_created_at_idx on certificate_audit_log (created_at desc);

alter table certificate_audit_log enable row level security;

create or replace function prevent_audit_log_mutation()
returns trigger as $$
begin
  raise exception 'certificate_audit_log is append-only: % is not permitted', TG_OP;
end;
$$ language plpgsql;

drop trigger if exists certificate_audit_log_no_update on certificate_audit_log;
create trigger certificate_audit_log_no_update
  before update on certificate_audit_log
  for each row
  execute function prevent_audit_log_mutation();

drop trigger if exists certificate_audit_log_no_delete on certificate_audit_log;
create trigger certificate_audit_log_no_delete
  before delete on certificate_audit_log
  for each row
  execute function prevent_audit_log_mutation();

-- ------------------------------------------------------------
-- RLS — same convention as every table in ETI-cohort: RLS enabled,
-- ZERO anon/authenticated policies on any of the six tables above.
-- All reads/writes — including public certificate verification —
-- go through server API routes using the service-role key, which
-- independently verify the caller before touching a row. See
-- lib/supabase/admin.ts and lib/supabase/verify*.ts.
--
-- No anon SELECT policy is added on `certificates` for public
-- verification, even though that endpoint is intentionally
-- unauthenticated at the HTTP level — the lookup and response
-- shaping happen in application code (app/api/verify/[token]/route.ts),
-- not via a database policy, so revocation handling, DTO shaping,
-- and rate limiting all live in one reviewable place instead of
-- being split between SQL and application code.
-- ------------------------------------------------------------
