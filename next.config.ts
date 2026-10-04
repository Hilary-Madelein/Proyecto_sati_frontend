import type { NextConfig } from "next";

const satiApiUrl = (process.env.SATI_API_URL ?? "http://localhost:6000/api/v1").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/sati/:path*", destination: `${satiApiUrl}/:path*` }];
  },
};

export default nextConfig;
