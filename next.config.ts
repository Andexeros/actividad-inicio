import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // "central" se dividió en central1/2/3: los links y QR viejos van a Central 1
  async redirects() {
    return [
      { source: "/central", destination: "/central1", permanent: false },
      { source: "/central/:resto*", destination: "/central1/:resto*", permanent: false },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
