import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import React from "react";
import { CertificatePdfDocument } from "./template";

export interface GenerateCertificatePdfInput {
  recipientName: string;
  certificateTypeName: string;
  cohortName: string;
  certificateNumber: string;
  issuedAt: string; // ISO timestamp
  verificationToken: string;
}

// Generates the PDF entirely server-side — no external QR-generation
// service (per directive §11): the `qrcode` npm package renders the
// QR code locally as a data URL, embedded directly in the PDF.
//
// The QR code encodes the verification URL built from the RANDOM
// token, never the certificate number — see buildVerificationUrl().
export async function generateCertificatePdf(input: GenerateCertificatePdfInput): Promise<Buffer> {
  const verificationUrl = buildVerificationUrl(input.verificationToken);
  const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
    margin: 1,
    width: 256,
    color: { dark: "#0F172A", light: "#FFFFFF" },
  });

  const issuedAtDisplay = new Date(input.issuedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const document = React.createElement(CertificatePdfDocument, {
    recipientName: input.recipientName,
    certificateTypeName: input.certificateTypeName,
    cohortName: input.cohortName,
    certificateNumber: input.certificateNumber,
    issuedAtDisplay,
    qrDataUrl,
  }) as React.ReactElement;

  const buffer = await renderToBuffer(document);

  return buffer;
}

export function buildVerificationUrl(verificationToken: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://certificates.eloratechinstitute.com";
  return `${base.replace(/\/$/, "")}/verify/${verificationToken}`;
}
