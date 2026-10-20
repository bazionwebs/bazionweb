/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cms.bazionweb.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https:",
              "connect-src 'self' https://api.bazionweb.com",
            ].join('; '),
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: '/www', destination: '/', permanent: true },
    ];
  },
  webpack(config) {
    if (config.cache && config.cache.type === 'filesystem') {
      const cacheDirectory = path.join(__dirname, 'node_modules', '.cache', 'next-webpack');
      if (Array.isArray(config.cache)) {
        config.cache.forEach((cacheOptions) => {
          if (cacheOptions.type === 'filesystem') {
            cacheOptions.cacheDirectory = cacheDirectory;
          }
        });
      } else {
        config.cache.cacheDirectory = cacheDirectory;
      }
    }
    return config;
  },
};

module.exports = nextConfig;
