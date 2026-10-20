import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/portal', '/portal/', '/admin', '/admin/', '/checkout', '/checkout/', '/api', '/api/', '/legal/dpa'],
      },
    ],
    sitemap: 'https://bazionwebs.com/sitemap.xml',
    host: 'https://bazionwebs.com',
  };
}
