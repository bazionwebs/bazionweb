import Link from 'next/link';
import { Clock, ArrowRight } from 'lucide-react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Breadcrumbs from '@/components/seo/Breadcrumbs';

// In production these come from Strapi CMS via API
// Static content here for build-time generation and SEO
const posts: Record<string, {
  title: string; category: string; date: string; readTime: string;
  tags: string[]; excerpt: string; content: string;
}> = {
  'why-smes-need-managed-website-services': {
    title:    'Why SMEs Need Managed Website Services (Not Just Hosting)',
    category: 'Managed Services',
    date:     'June 5, 2025',
    readTime: '6 min read',
    tags:     ['Managed Services', 'SME', 'Hosting'],
    excerpt:  'Most small businesses think hosting is the end of website management. Here\'s why the real work starts after you go live — and how managed services change everything.',
    content:  `
When a business owner signs up for a hosting plan, they usually think the hard part is over. The website is live, the invoice is paid, and the domain is pointed at the right server. Job done.

Except it isn't.

## The hosting illusion

Hosting gives you a place for your website to live. It does not maintain it. It does not update your CMS plugins when a critical vulnerability is discovered. It does not monitor your SSL certificate and automatically renew it. It does not scan for malware. It does not answer your support ticket at 8pm on a Friday when your contact form stops working.

Hosting is infrastructure. Infrastructure is a commodity. What growing businesses actually need is *management*.

## What happens after launch

In the first 12 months after a website goes live, a typical SME will need:

**Monthly:** CMS core update, plugin updates, theme updates, security patch review, uptime monitoring check, backup verification, content changes (team member added, pricing updated, blog post published).

**Quarterly:** Performance review, broken link audit, form testing, mobile render check, Google Search Console review.

**Ad-hoc:** Something breaks. A plugin conflict. An SSL expiry. A DDoS spike. A hacked contact form. A Google Core Update that tanked the rankings.

None of this comes with hosting. All of it requires a human being with technical skills, time, and accountability.

## The multi-vendor trap

Most SMEs solve this by hiring:

- A web developer (freelance, Upwork, or agency) for build work
- A hosting provider (cPanel, WP Engine, or a cloud VPS) for infrastructure
- Nobody for ongoing maintenance — hoping nothing breaks

When something breaks, the web developer blames the host. The host says it's a code problem. The business owner is stuck in the middle with a broken website and no clear owner.

## What managed services actually means

A managed web services provider takes full ownership of the lifecycle:

1. **Build** the website to a defined standard
2. **Host** it on reliable, monitored infrastructure
3. **Maintain** it with regular updates and content changes
4. **Secure** it proactively before threats become incidents
5. **Optimise** it for performance continuously
6. **Support** it with SLA-backed response times

One provider. One invoice. One throat to grab if anything goes wrong.

## Is it more expensive?

On a line-item comparison, yes — managed services cost more than raw hosting.

But the real question is: what does it cost when something breaks and nobody owns it?

A site down for 4 hours during a product launch. A hacked website that Google blacklists. An SSL expiry that Chrome marks as "Not Secure" for three days. These are real costs — in lost revenue, in reputation, in the time you spend chasing vendors instead of running your business.

Managed services aren't an upgrade. They're the actual product.
    `.trim(),
  },
  'core-web-vitals-guide-2025': {
    title:    'Core Web Vitals in 2025: What Every Business Website Owner Needs to Know',
    category: 'Performance',
    date:     'May 28, 2025',
    readTime: '8 min read',
    tags:     ['Performance', 'SEO', 'Core Web Vitals'],
    excerpt:  'Google\'s page experience signals directly affect your search rankings. We break down LCP, CLS, and INP — and what you can actually do about them.',
    content:  `
Google's Core Web Vitals have been a ranking signal since 2021. In 2025, they're more important than ever — and more businesses are still failing them than you'd expect.

## What are Core Web Vitals?

Core Web Vitals are three metrics Google uses to measure the real-world experience of your website:

**LCP — Largest Contentful Paint** measures how long it takes for the main content of a page to load. Good: under 2.5 seconds. Poor: over 4 seconds.

**INP — Interaction to Next Paint** (replaced FID in 2024) measures how quickly your page responds to user interaction. Good: under 200ms. Poor: over 500ms.

**CLS — Cumulative Layout Shift** measures visual stability — how much the page "jumps" as it loads. Good: under 0.1. Poor: over 0.25.

## Why they matter beyond rankings

Core Web Vitals aren't just an SEO signal. They directly affect:

- **Conversion rates**: A 1-second improvement in page load time increases mobile conversions by 27% (Google, 2023)
- **Bounce rates**: 53% of mobile users abandon a site that takes more than 3 seconds to load
- **Ad performance**: Google Ads Quality Score is partly based on landing page experience, which includes page speed

## How to diagnose your site

Three free tools give you the full picture:

1. **Google Search Console** → Core Web Vitals report (real-user data from Chrome users)
2. **PageSpeed Insights** → Field data + lab data for any URL
3. **Lighthouse** (in Chrome DevTools) → Detailed technical audit

The most important distinction: *field data* (real users) vs *lab data* (simulated). Field data is what Google uses for rankings. Lab data tells you where to fix things.

## The most common culprits

**For LCP:** Large images not properly sized or formatted. No lazy loading. Render-blocking CSS/JS. Slow server response. Missing CDN.

**For INP:** Heavy JavaScript executing on the main thread. Long tasks blocking input response. Too many third-party scripts (analytics, chat widgets, social embeds).

**For CLS:** Images without explicit width/height attributes. Late-loading web fonts causing text shifts. Dynamically injected content (banners, ads) above the fold.

## What actually moves the needle

After auditing dozens of business websites, the highest-ROI fixes are almost always:

1. Convert images to WebP/AVIF and add explicit dimensions
2. Add proper cache headers and a CDN in front of your server
3. Move non-critical JavaScript to load after the main thread is free
4. Self-host your Google Fonts (or use font-display: optional)
5. Set aspect-ratio on all media elements to prevent layout shifts

None of these require a full rebuild. They require someone who knows what they're doing to implement them correctly.
    `.trim(),
  },
};

export async function generateStaticParams() {
  return Object.keys(posts).map(slug => ({ slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = posts[params.slug];
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `https://bazionweb.com/blog/${params.slug}` },
    openGraph: { title: post.title, description: post.excerpt, type: 'article' },
  };
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = posts[params.slug];
  if (!post) notFound();

  // Simple markdown-to-HTML: convert ## headings and **bold**
  const html = post.content
    .replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold text-[#0F172A] mt-10 mb-4">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-[#0F172A]">$1</strong>')
    .split('\n\n')
    .map(para => para.startsWith('<h2') || para.startsWith('<ul') || para.startsWith('<ol')
      ? para
      : `<p class="text-slate-600 leading-relaxed mb-5">${para}</p>`)
    .join('\n');

  return (
    <>
      <section className="bg-[#0F172A] pt-32 pb-16">
        <div className="container-default max-w-3xl">
          <Breadcrumbs trail={[{ name: 'Home', href: '/' }, { name: 'Blog', href: '/blog' }, { name: post.title }]} />
          <span className={`badge mb-4 ${post.category === 'Security' ? 'badge-red' : post.category === 'Performance' ? 'badge-yellow' : 'badge-blue'}`}>
            {post.category}
          </span>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-5 leading-snug">{post.title}</h1>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {post.readTime}</span>
            <span>{post.date}</span>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="container-default max-w-3xl">
          <p className="text-lg text-slate-500 leading-relaxed mb-10 border-l-4 border-[#2563EB] pl-5">{post.excerpt}</p>
          <div dangerouslySetInnerHTML={{ __html: html }} />

          <div className="mt-12 pt-8 border-t border-slate-100">
            <div className="flex flex-wrap gap-2 mb-8">
              {post.tags.map(t => <span key={t} className="badge-slate text-xs">{t}</span>)}
            </div>
            <div className="card p-6 flex flex-col sm:flex-row gap-4 items-start">
              <div className="flex-1">
                <p className="font-bold text-[#0F172A] mb-1">Need help with this?</p>
                <p className="text-sm text-slate-500">BazionWeb handles all of this for managed clients — from performance audits to monthly maintenance. Get a free assessment.</p>
              </div>
              <Link href="/contact" className="btn-primary shrink-0">
                Free assessment <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
