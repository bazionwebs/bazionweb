import { MetadataRoute } from 'next';

const BASE = 'https://bazionweb.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE}/services`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/contact`, lastModified: now, changeFrequency: 'yearly', priority: 0.8 },
    { url: `${BASE}/quote`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/case-studies`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/careers`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${BASE}/faq`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/process`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    // Service sub-pages (active, indexed)
    { url: `${BASE}/services/development`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/services/maintenance`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/services/security`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/services/performance`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/services/support`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    // NOTE: /services/hosting is intentionally omitted — it is a noindex redirect to /services/maintenance
    // Legal (noindex in robots but present for completeness)
    { url: `${BASE}/legal/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/legal/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/legal/sla`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/legal/cookies`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    // Blog posts — seeded static content; sync slugs with blog/[slug]/page.tsx posts record
    { url: `${BASE}/blog/why-smes-need-managed-website-services`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/blog/core-web-vitals-guide-2025`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/blog/ssl-certificate-management-guide`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    // Case studies
    { url: `${BASE}/case-studies/acacia-healthcare`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/case-studies/parkview-law`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/case-studies/grow-africa-ngo`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
  ];

  // TODO: Add dynamic blog post and case study routes from Strapi CMS
  // const cms = await fetch(`${process.env.NEXT_PUBLIC_STRAPI_API_URL}/api/posts?fields[0]=slug&fields[1]=updatedAt`);
  // const { data } = await cms.json();
  // const dynamicRoutes = data.map(p => ({ url: `${BASE}/blog/${p.attributes.slug}`, lastModified: new Date(p.attributes.updatedAt), priority: 0.6 }));

  return staticRoutes;
}
