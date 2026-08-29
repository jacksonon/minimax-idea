/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.API_INTERNAL_URL ||
      'https://dreamreel-api.right-ai.workers.dev',
  },
};

module.exports = nextConfig;
