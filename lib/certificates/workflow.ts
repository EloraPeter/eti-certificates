import "server-only";
import type { CertificationRequestStatus } from "./types";

// The single source of truth for which certification_requests status
// transitions are legal. Every API route that changes `status` must
// call assertTransition() before writing — never set `status`
// directly from a route handler without going through this.
//
// This is the enforcement point referenced throughout the directive
// as "the API must enforce legal transitions" / "the UI is NOT the
// security boundary." The database CHECK on the enum only constrains
// which values the column can hold, not which sequences of values
// are reachable — that graph lives here.
const ALLOWED_TRANSITIONS: Record<CertificationRequestStatus, CertificationRequestStatus[]> = {
  pending_instructor: ["pending_admin", "rejected", "cancelled"],
  pending_admin: ["approved", "rejected", "cancelled"],
  approved: ["issuing"],
  // Issuance failures do NOT transition back out of 'issuing' — a
  // retry re-attempts PDF generation/upload while status stays
  // 'issuing' (see lib/certificates/issue.ts). The only way out of
  // 'issuing' is forward, to 'issued', once a certificate row
  // genuinely exists.
  issuing: ["issued"],
  // Terminal states. No transitions out via any workflow endpoint —
  // this is what makes `issued -> approved`, `issued -> rejected`,
  // `issued -> pending_admin`, `rejected -> approved`, and
  // `cancelled -> approved` structurally impossible, not just
  // policy: there is no entry in this map that permits them.
  issued: [],
  rejected: [],
  cancelled: [],
};

export class IllegalTransitionError extends Error {
  constructor(from: CertificationRequestStatus, to: CertificationRequestStatus) {
    super(`Illegal certification_requests transition: ${from} -> ${to}`);
    this.name = "IllegalTransitionError";
  }
}

export function assertTransition(
  from: CertificationRequestStatus,
  to: CertificationRequestStatus
): void {
  if (!ALLOWED_TRANSITIONS[from]?.includes(to)) {
    throw new IllegalTransitionError(from, to);
  }
}

// Certificate-level revocation is a SEPARATE lifecycle, not a
// certification_requests transition (see migration 001 comments).
// There is deliberately no un-revoke function in v1 — reactivating a
// revoked certificate is not implemented. A replacement credential,
// if ever needed, should be a NEW certification_requests row and a
// NEW certificates row (audited as 'certificate_reissued'), never a
// mutation of the revoked one. This is what makes
// `revoked -> issued` structurally impossible: no code path sets a
// certificate's status back to 'issued' once it is 'revoked'.
