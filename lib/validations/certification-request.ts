import { z } from "zod";

export const createRequestSchema = z.object({
  studentId: z.string().uuid(),
  cohortId: z.string().uuid(),
  certificateTypeId: z.string().uuid(),
  instructorId: z.string().uuid(), // required for v1 — see README: student self-request (origin='student') is schema-supported but not implemented as a v1 UI path, per directive §4
  notes: z.string().max(2000).optional(),
});

export const instructorDecisionSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("confirmed") }),
  z.object({ decision: z.literal("declined"), notes: z.string().min(1, "Notes are required when declining.").max(2000) }),
]);

export const adminDecisionSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approved"), notes: z.string().max(2000).optional() }),
  z.object({ decision: z.literal("rejected"), notes: z.string().min(1, "Notes are required when rejecting.").max(2000) }),
]);

export const adminOverrideSchema = z.object({
  notes: z.string().min(1, "Notes are required for an override.").max(2000),
});

export const revokeSchema = z.object({
  reason: z.string().min(1, "A reason is required to revoke a certificate.").max(2000),
});

export const certificateTypeSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  curriculumId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
});
