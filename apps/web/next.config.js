/** @type {import('next').NextConfig} */
const path = require('path');

const isDev = process.env.NODE_ENV !== 'production';

function buildContentSecurityPolicy() {
  const connectSrc = [
    "'self'",
    'https://api.bazionweb.com',
    'https://vercel.live',
    'wss://vercel.live',
  ];

  if (isDev) {
    connectSrc.push(
      'http://localhost:*',
      'http://127.0.0.1:*',
      'ws://localhost:*',
      'ws://127.0.0.1:*',
      'http://localhost:4000',
      'http://localhost:3000',
      'http://127.0.0.1:4000',
      'http://127.0.0.1:3000'
    );
  }

  // Allow connecting to any explicitly configured public or dev API origin
  const configuredUrls = [
    process.env.NEXT_PUBLIC_API_URL,
    process.env.API_DEV_URL,
    process.env.API_INTERNAL_URL,
  ];
  for (const rawUrl of configuredUrls) {
    if (!rawUrl) continue;
    const match = String(rawUrl).match(/https?:\/\/[^\s"'<>]+/i);
    if (!match) continue;
    try {
      const origin = new URL(match[0]).origin;
      if (!connectSrc.includes(origin)) {
        connectSrc.push(origin);
      }
    } catch {
      // Ignore invalid URL
    }
  }

  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://vercel.live",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    `connect-src ${connectSrc.join(' ')}`,
  ].join('; ');
}

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
            value: buildContentSecurityPolicy(),
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
  async rewrites() {
    // Production routes /api/v1 to the api service via vercel.json; mirror
    // that same-origin behaviour in local dev so the browser talks to
    // localhost:3000 and Next proxies to the NestJS dev server on :4000.
    if (process.env.NODE_ENV !== 'development') return [];
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.API_DEV_URL || 'http://localhost:4000'}/api/v1/:path*`,
      },
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
