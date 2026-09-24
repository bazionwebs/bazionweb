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
    sitemap: 'https://bazionweb.com/sitemap.xml',
    host: 'https://bazionweb.com',
  };
}
