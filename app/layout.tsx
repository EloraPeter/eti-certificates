import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ETI Certificates",
  description: "Elora Tech Institute — certificate issuance and verification",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900">{children}</body>
    </html>
  );
}
