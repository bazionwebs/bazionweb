import Link from 'next/link';
import { Clock, ArrowRight } from 'lucide-react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import JsonLd from '@/components/seo/JsonLd';

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
  'ssl-certificate-management-guide': {
    title:    'SSL Certificate Management: The Complete Guide for Non-Technical Business Owners',
    category: 'Security',
    date:     'May 15, 2025',
    readTime: '5 min read',
    tags:     ['Security', 'SSL', 'HTTPS'],
    excerpt:  'SSL expiry is one of the most avoidable causes of website downtime. Here\'s everything you need to know — without the technical jargon.',
    content:  `
Every day, thousands of business websites go dark or display terrifying browser security warnings because of a single overlooked detail: an expired SSL certificate.

When your SSL expires, modern browsers like Google Chrome and Safari don't gently suggest that something might be wrong. They present full-screen, red warnings saying **"Your connection is not private"** or **"Potential Security Risk Ahead"**. For an e-commerce store or corporate brand, this instantly destroys conversion and trust.

## What is an SSL Certificate?

SSL (Secure Sockets Layer), now technically TLS, is a cryptographic protocol that creates an encrypted link between a visitor's web browser and your website's server.

It ensures that sensitive information — credit card details, passwords, contact forms, and client enquiries — cannot be intercepted by eavesdroppers on public Wi-Fi or compromised networks.

## Why Certificates Expire

Certificates are deliberately given short lifespans (currently 90 days for Let's Encrypt certificates, and typically 1 year for commercial paid certificates) to ensure that cryptographic keys are rotated regularly and rogue certificates can be revoked.

The problem isn't the lifespan; it's **manual management**. When businesses rely on someone remembering a calendar reminder 12 months down the road, failure is practically guaranteed.

## How to Guarantee Zero SSL Downtime

To ensure your website never drops its HTTPS lock icon:

1. **Automate Certificate Issuance**: Use ACME protocol bots (such as Let's Encrypt with Certbot or cloud providers) that automatically request and renew certificates 30 days before expiration.
2. **Dual-Layer CDN Termination**: Employing Cloudflare Universal SSL in front of your origin server provides seamless SSL termination with zero manual certificate swapping.
3. **Continuous 24/7 Certificate Telemetry**: Automated monitoring tools should check certificate expiration dates every 24 hours and trigger alerts if a renewal hasn't registered 14 days prior to expiration.
4. **Enforce Strict Transport Security (HSTS)**: Configure HTTP Strict Transport Security headers so browsers never attempt an insecure connection.

## Complete Peace of Mind

At BazionWeb, SSL management is never an optional extra or manual task. Every client site under our care is provisioned with automated renewal, redundant SSL termination, and proactive uptime alerts.
    `.trim(),
  },
  'how-much-does-a-website-cost-in-kenya': {
    title:    'How Much Does a Website Cost in Kenya? (2026 Comprehensive Price Guide)',
    category: 'Buying Guide',
    date:     'January 15, 2026',
    readTime: '9 min read',
    tags:     ['Website Cost', 'Pricing', 'Web Design Kenya', 'SME'],
    excerpt:  'Looking to build a website in Kenya? Here is a transparent breakdown of real market costs in 2026 — from basic launch sites to corporate portals and e-commerce stores.',
    content:  `
One of the most common questions Kenyan business owners ask is: **"How much should a website cost in Kenya?"**

If you have ever requested quotes from three different web design agencies in Nairobi, you probably received three vastly different answers: one person quoted KSh 10,000, another quoted KSh 80,000, and an established agency quoted KSh 400,000.

Why does pricing vary so wildly? And more importantly: what are you actually paying for?

## The 4 Tiers of Website Development in Kenya

In the Kenyan market, website development projects generally fall into four tiers:

### 1. The Budget / Freelance Tier (KSh 10,000 – KSh 20,000)
Often offered by solo freelancers or computer college students using pirated WordPress themes.
- **What you get:** A basic 3-page template populated with your text.
- **The hidden risks:** Poor mobile responsiveness, no security hardening, pirated plugins that get hacked within 6 months, and the dreaded "ghosting developer" who disappears when updates are required.
- **Best for:** Personal hobby projects with zero commercial dependency.

### 2. The Professional Launch Tier (KSh 25,000 – KSh 45,000)
Engineered for startups, sole practitioners, consultants, and new businesses needing credibility and immediate lead generation.
- **What you get:** Up to 5 custom-designed pages built on high-performance frameworks (like Next.js), SSL encryption, WhatsApp direct integration, contact forms, mobile-first design, and Google indexing.
- **Turnaround:** 5 to 10 business days.
- **BazionWeb package:** Our **Launch Package** (KSh 25,000) includes complete asset handover, 14-day warranty, and zero vendor lock-in.

### 3. The Established Business Tier (KSh 80,000 – KSh 160,000)
For registered SMEs, professional services firms (law firms, medical clinics, accounting practices), and multi-service organizations.
- **What you get:** 10 to 25 structured pages, dynamic CMS (allowing your staff to publish blog articles and announcements without coding), technical Schema.org SEO for Google ranking, high-speed CDN deployment, and conversion-optimized sales funnels.
- **Turnaround:** 2 to 4 weeks.
- **BazionWeb package:** Our **Business Package** (KSh 90,000) and **Professional Package** (KSh 160,000).

### 4. Custom Systems & E-Commerce (KSh 90,000 – KSh 500,000+)
For online shops selling physical or digital goods, schools needing student portals, churches handling tithes/givings, or logistics firms tracking shipments.
- **What you get:** Automated Safaricom M-Pesa STK Push integration, inventory tracking, role-based client logins, automated PDF invoicing, and bespoke database architectures.
- **Turnaround:** 4 to 12 weeks with milestone reviews.

## Recurring Costs You Need to Factor In

Building the website is only the initial phase. Every business website requires ongoing infrastructure:

1. **Domain Name Registration (.co.ke or .com):** KSh 1,000 to KSh 2,500 per year.
2. **Cloud Hosting & CDN:** KSh 5,000 to KSh 30,000 per year depending on traffic and compute requirements.
3. **Maintenance, Security & Backups:** KSh 4,500 to KSh 25,000 per month. Websites that neglect monthly CMS patches and database backups invariably crash or succumb to automated bot attacks.

## 4 Questions to Ask Any Developer Before Signing a Contract

Before paying a deposit to any agency or freelancer in Kenya, demand clear written answers to these four questions:

- **Do I own the code, domain, and assets 100%?** (Many agencies register the domain in their own name and hold clients hostage).
- **Is the website built on a modern, fast framework?** (Slow websites lose 50%+ of mobile visitors before the page even finishes loading).
- **Is automated M-Pesa STK Push supported?** (For e-commerce, forcing customers to manually copy a Paybill number leads to high cart abandonment).
- **What happens after launch?** (Always ensure you receive a written defect warranty).

## The Bottom Line

A website shouldn't be an expense that sits on your balance sheet doing nothing. Engineered properly, it is your highest-performing sales representative—working 24/7/365 to attract prospects and capture qualified leads.
    `.trim(),
  },
  'how-to-accept-mpesa-payments-on-your-website': {
    title:    'Accepting M-Pesa on Your Website: The Complete Daraja STK Push Guide',
    category: 'E-Commerce',
    date:     'February 3, 2026',
    readTime: '10 min read',
    tags:     ['M-Pesa', 'Daraja API', 'E-Commerce', 'Next.js', 'Payments'],
    excerpt:  'Stop losing customers at checkout. Learn how Safaricom Daraja 2.0 STK Push works, how it compares to manual Paybill, and how to implement it on modern web apps.',
    content:  `
In Kenya and East Africa, mobile money is not an alternative payment method — it **is** the default payment method. Over 85% of online retail and service transactions in Kenya occur via Safaricom M-Pesa.

Yet, hundreds of e-commerce websites still ask buyers to:
1. Leave the checkout screen.
2. Open the SIM toolkit or M-Pesa app.
3. Type in a Paybill or Till number manually.
4. Enter the exact order total.
5. Wait for an SMS confirmation.
6. Copy-paste the transaction code (e.g. \`SKD91X29A\`) into a contact form or WhatsApp.

**This clunky workflow causes up to 60% of buyers to abandon their carts.**

## The Solution: Automated Daraja 2.0 STK Push

With modern M-Pesa integration using Safaricom's **Daraja API (Lipa Na M-Pesa Online / STK Push)**, the checkout experience becomes effortless:

1. The customer enters their Safaricom phone number on your website.
2. An instant prompt pops up on their smartphone screen with your business name and the exact amount pre-filled.
3. The customer simply enters their secret M-Pesa PIN.
4. Safaricom sends an encrypted callback webhook directly to your website server.
5. The order status automatically switches to **"Paid"**, inventory is updated, and an automated PDF receipt is dispatched to the client's email.

Zero typing of Paybill numbers. Zero transcribing 10-digit transaction codes. Total transaction time: **under 15 seconds**.

## Paybill vs Till (Buy Goods): Which One Do You Need?

When applying for your Safaricom Daraja API credentials, you have two primary options:

### Buy Goods (Till Number)
- **Best for:** Retail shops, physical merchandise, and direct e-commerce sales.
- **Customer experience:** Free for the customer (the merchant pays the standard transaction fee).
- **Recommended for:** Consumer e-commerce where you don't want buyers deterred by customer-side fees.

### Paybill Number
- **Best for:** B2B services, subscriptions, school fees, utilities, and invoices requiring specific account reference tracking.
- **Account Number feature:** Supports passing an invoice number, client ID, or order code dynamically.

## Key Technical Considerations for Modern Websites

If your engineering team or web development partner is implementing Daraja STK Push (especially in modern serverless frameworks like Next.js 14/15 or NestJS), keep these critical rules in mind:

### 1. Secure Webhook Architecture
Never trust client-side confirmations. Your backend server must provide an encrypted HTTPS callback endpoint that verifies the Safaricom payload signature before marking an order as fulfilled.

### 2. Idempotency & Reconciliation
Mobile network glitches can cause webhook retries. Your database must enforce idempotent transaction processing so duplicate callback requests never charge a customer twice or deliver duplicate orders.

### 3. Graceful Timeout Handling
If a customer's phone is unreachable or they cancel the prompt, your frontend should poll or listen to WebSocket updates to gently prompt the customer to retry without resetting their cart.

## Ready to Supercharge Your E-Commerce Store?

At BazionWeb, all of our e-commerce platforms and client portals come pre-engineered with full Safaricom Daraja 2.0 STK Push integration alongside global card gateways (Stripe & Visa/Mastercard).

Contact our engineering team today to review your store and integrate automated checkout.
    `.trim(),
  },
};

export async function generateStaticParams() {
  return Object.keys(posts).map(slug => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = posts[slug];
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `https://bazionweb.com/blog/${slug}` },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      url: `https://bazionweb.com/blog/${slug}`,
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: ['/og-image.png'],
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = posts[slug];
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
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          description: post.excerpt,
          image: 'https://bazionweb.com/og-image.png',
          datePublished: new Date(post.date).toISOString(),
          author: {
            '@type': 'Organization',
            '@id': 'https://bazionweb.com/#organization',
            name: 'BazionWeb',
            url: 'https://bazionweb.com/',
          },
          publisher: {
            '@type': 'Organization',
            '@id': 'https://bazionweb.com/#organization',
            name: 'BazionWeb',
            url: 'https://bazionweb.com/',
            logo: 'https://bazionweb.com/brand/logo.png',
          },
          mainEntityOfPage: `https://bazionweb.com/blog/${slug}`,
          keywords: post.tags.join(', '),
        }}
      />
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
