/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
    },
    // serverActions: true, // Enabled by default in 15
  },
  images: {
    // Optimize for server performance
    deviceSizes: [640, 750, 828, 1080],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    formats: ['image/webp'], // Settle for WebP (faster/compatible) vs AVIF (slower encode)
  },
  serverExternalPackages: ['mongoose', 'sharp'], // Ensure sharp is treated correctly
};

export default nextConfig;
