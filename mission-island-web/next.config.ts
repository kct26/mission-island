import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false, // the dev badge sits on top of the CAPCOM button
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
