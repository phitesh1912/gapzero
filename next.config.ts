import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Room for up to two downscaled JPEG pages sent to AI vision (Vercel caps bodies at 4.5 MB).
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
