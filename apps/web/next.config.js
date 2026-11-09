/** @type {import('next').NextConfig} */
const path = require('path');

const isDev = process.env.NODE_ENV !== 'production';

function buildContentSecurityPolicy() {
  const isDev = process.env.NODE_ENV !== 'production';
  const connectSrc = [
    "'self'",
    'https://api.bazionweb.com',
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
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://www.googletagmanager.com https://js.paystack.co https://embed.tawk.to https://*.tawk.to https://cdn.jsdelivr.net https://www.clarity.ms https://*.clarity.ms https://static.cloudflareinsights.com https://cloudflareinsights.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.tawk.to",
    "font-src 'self' https://fonts.gstatic.com data: https://*.tawk.to",
    "img-src 'self' data: https: blob: https://*.tawk.to https://tawk.link https://www.clarity.ms https://*.clarity.ms https://c.clarity.ms",
    `connect-src ${connectSrc.join(' ')} https://api.paystack.co https://*.tawk.to wss://*.tawk.to https://www.clarity.ms https://*.clarity.ms https://c.clarity.ms https://cloudflareinsights.com https://static.cloudflareinsights.com`,
    "frame-src https://js.paystack.co https://checkout.paystack.com https://*.tawk.to https://embed.tawk.to",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion', 'recharts', 'date-fns'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
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
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
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
    // Same-origin API gateway: the browser always talks to /api/v1 on the web
    // origin — Traefik/Dokploy delivers it to the NestJS service either at the
    // edge or through the runtime catch-all proxy route. In local dev mirror
    // that same-origin behaviour so the browser talks to localhost:3000 and
    // Next proxies to the NestJS dev server on :4000.
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
