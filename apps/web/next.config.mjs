/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile shared monorepo packages so Next.js can process them
  transpilePackages: ['@repo/types', '@repo/shared', '@repo/config'],

  // Strict mode helps catch React issues early
  reactStrictMode: true,

  // Standalone output for minimal Docker images (copies only required files)
  output: 'standalone',

  // Environment variables exposed to the browser must be prefixed NEXT_PUBLIC_
  env: {
    APP_VERSION: process.env.APP_VERSION ?? '0.1.0',
  },
};

export default nextConfig;
