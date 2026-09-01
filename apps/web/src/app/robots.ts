import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/portal', '/admin', '/api', '/legal/dpa'],
      },
    ],
    sitemap: 'https://bazionweb.com/sitemap.xml',
    host: 'https://bazionweb.com',
  };
}
