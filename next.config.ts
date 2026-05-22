import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'dcdn-us.mitiendanube.com',
      },
      {
        protocol: 'http',
        hostname: 'dcdn-us.mitiendanube.com',
      },
    ],
  },
};

export default nextConfig;
