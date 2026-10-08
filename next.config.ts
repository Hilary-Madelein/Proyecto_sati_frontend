import type { NextConfig } from "next";

// Las llamadas del navegador al backend pasan por src/app/api/sati/[...path]/route.ts,
// que lee SATI_API_URL (en .env.local) en cada petición.
const nextConfig: NextConfig = {};

export default nextConfig;
