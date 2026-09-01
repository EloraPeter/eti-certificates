/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @react-pdf/renderer and qrcode are only ever imported from
  // server-side files (API routes, lib/certificates/pdf/*) — never
  // from a client component. No special webpack config required for
  // that reason, but flagged here for future maintainers: if either
  // package is ever imported from a "use client" file, the build
  // will pull server-only dependencies into the browser bundle.
};

module.exports = nextConfig;
