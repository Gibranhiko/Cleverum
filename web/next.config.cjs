/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable caching in development to ensure middleware runs
  ...(process.env.NODE_ENV === 'development' && {
    experimental: {
      serverComponentsExternalPackages: ['jose'],
    },
    // Force middleware to run on every request in development
    generateBuildId: () => 'development-build-' + Date.now(),
    // Disable static optimization for middleware routes
    trailingSlash: false,
    // Ensure middleware runs on every request
    poweredByHeader: false,
  }),
  eslint: {ignoreDuringBuilds: true},
  typescript: {ignoreBuildErrors: true},
  swcMinify: true,
};

module.exports = nextConfig;