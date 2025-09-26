/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.NODE_ENV === 'development' && {
    experimental: { serverComponentsExternalPackages: ['jose'] },
    generateBuildId: () => 'development-build-' + Date.now(),
    trailingSlash: false,
    poweredByHeader: false,
  }),
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  swcMinify: true
};
module.exports = nextConfig;
