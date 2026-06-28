import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Guest booking flow will post payment-proof screenshots through Server Actions;
  // the 1 MB default is too small for a couple of phone photos.
  experimental: {
    serverActions: { bodySizeLimit: "15mb" },
  },
  images: {
    // Property photos are served from the shared Supabase storage bucket.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },
  // Conservative security headers. A strict CSP is added in the launch hardening
  // pass once all asset origins are pinned.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
