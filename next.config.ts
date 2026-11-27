import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  async headers() {
    return [
      {
        // Loading-screen pictures. Files in public/ are served with `max-age=0` by default, which
        // makes the browser re-check them on every page load (and the loader wait for that). These
        // carry a version in their name (bars.v1.webp), so they can be cached for good: to change
        // one, save it under the next version and update LOADING_GIFS in loadingGifs.ts.
        source: '/assets/loading/:file*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default nextConfig;
