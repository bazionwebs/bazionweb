import Link from 'next/link';
import { ArrowRight, Clock } from 'lucide-react';
import type { Metadata } from 'next';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import JsonLd from '@/components/seo/JsonLd';

export const metadata: Metadata = {
  title: 'Engineering Blog & Technical Insights | BazionWeb',
  description: 'Actionable guides and technical insights on Core Web Vitals, modern Next.js development, e-commerce optimization, SSL security, and managed website services.',
  alternates: { canonical: 'https://bazionwebs.com/blog' },
};

const posts = [
  {
    slug: 'why-smes-need-managed-website-services',
    title: 'Why SMEs Need Managed Website Services (Not Just Hosting)',
    excerpt: 'Most small businesses think hosting is the end of website management. Here\'s why the real work starts after you go live — and how managed services change everything.',
    category: 'Managed Services',
    readTime: '6 min read',
    date: 'June 5, 2025',
    featured: true,
    published: true,
    tags: ['Managed Services', 'SME', 'Hosting'],
  },
  {
    slug: 'core-web-vitals-guide-2025',
    title: 'Core Web Vitals in 2025: What Every Business Website Owner Needs to Know',
    excerpt: 'Google\'s page experience signals directly affect your search rankings. We break down LCP, CLS, and INP — and what you can actually do about them.',
    category: 'Performance',
    readTime: '8 min read',
    date: 'May 28, 2025',
    featured: false,
    published: true,
    tags: ['Performance', 'SEO', 'Core Web Vitals'],
  },
  {
    slug: 'ssl-certificate-management-guide',
    title: 'SSL Certificate Management: The Complete Guide for Non-Technical Business Owners',
    excerpt: 'SSL expiry is one of the most avoidable causes of website downtime. Here\'s everything you need to know — without the technical jargon.',
    category: 'Security',
    readTime: '5 min read',
    date: 'May 15, 2025',
    featured: false,
    published: true,
    tags: ['Security', 'SSL', 'Uptime'],
  },
  {
    slug: 'website-maintenance-checklist',
    title: 'The 12-Point Monthly Website Maintenance Checklist',
    excerpt: 'Neglecting monthly maintenance is how websites go from fast and secure to slow and vulnerable. Here\'s what should happen every single month.',
    category: 'Maintenance',
    readTime: '7 min read',
    date: 'May 2, 2025',
    featured: false,
    published: false,
    tags: ['Maintenance', 'Checklist', 'Best Practices'],
  },
  {
    slug: 'waf-explained',
    title: 'What is a WAF and Why Does Your Website Need One?',
    excerpt: 'Web Application Firewalls are standard on enterprise sites — yet most SME websites have zero protection. We explain what a WAF does and how we deploy one for every client.',
    category: 'Security',
    readTime: '5 min read',
    date: 'April 18, 2025',
    featured: false,
    published: false,
    tags: ['Security', 'WAF', 'Infrastructure'],
  },
  {
    slug: 'choosing-managed-web-services-provider',
    title: '7 Questions to Ask Before Choosing a Managed Web Services Provider',
    excerpt: 'Not all managed services are created equal. These are the questions that separate a genuine managed provider from a basic hosting reseller.',
    category: 'Managed Services',
    readTime: '6 min read',
    date: 'April 5, 2025',
    featured: false,
    published: false,
    tags: ['Managed Services', 'Buying Guide'],
  },
];


const categories = ['All', 'Managed Services', 'Security', 'Performance', 'Maintenance'];

export default function BlogPage() {
  const [featured, ...rest] = posts;
  const staticPosts = posts.filter(p =>
    ['why-smes-need-managed-website-services', 'core-web-vitals-guide-2025', 'ssl-certificate-management-guide'].includes(p.slug)
  );

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Blog',
          '@id': 'https://bazionwebs.com/blog',
          name: 'BazionWeb Engineering Blog',
          description: 'Practical guides on website maintenance, security, performance, and managed web services for business owners in Kenya and worldwide.',
          url: 'https://bazionwebs.com/blog',
          publisher: {
            '@type': 'Organization',
            '@id': 'https://bazionwebs.com/#organization',
            name: 'BazionWeb',
          },
          blogPost: staticPosts.map(p => ({
            '@type': 'BlogPosting',
            headline: p.title,
            description: p.excerpt,
            url: `https://bazionwebs.com/blog/${p.slug}`,
            keywords: p.tags.join(', '),
          })),
        }}
      />
      {/* Header */}
      <section className="section bg-[#0F172A] pt-32">
        <div className="container-default">
          <div className="max-w-2xl">
            <Breadcrumbs trail={[{ name: 'Home', href: '/' }, { name: 'Blog' }]} />
            <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#14B8A6] mb-4">
              Blog
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-5">
              Insights on managed web services
            </h1>
            <p className="text-lg text-slate-400">
              Practical guides for business owners who want to stop worrying about their website.
            </p>
          </div>
        </div>
      </section>

      <section className="section bg-[#F8FAFC]">
        <div className="container-default">
          {/* Category filters */}
          <div className="flex flex-wrap gap-2 mb-12">
            {categories.map(c => (
              <button
                key={c}
                className={c === 'All'
                  ? 'badge bg-[#2563EB] text-white text-xs px-4 py-1.5'
                  : 'badge-slate text-xs px-4 py-1.5 cursor-pointer hover:bg-slate-200 transition-colors'
                }
              >
                {c}
              </button>
            ))}
          </div>

          {/* Featured post */}
          <div className="card-interactive p-8 md:p-10 mb-10 grid grid-cols-1 lg:grid-cols-5 gap-8">
            <div className="lg:col-span-3">
              <div className="flex items-center gap-2 mb-4">
                <span className="badge-blue">{featured.category}</span>
                <span className="badge-slate">Featured</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-[#0F172A] mb-3 leading-snug">
                {featured.title}
              </h2>
              <p className="text-slate-500 leading-relaxed mb-6">{featured.excerpt}</p>
              <div className="flex items-center gap-4 text-xs text-slate-400 mb-6">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> {featured.readTime}
                </span>
                <span>{featured.date}</span>
              </div>
              <Link href={`/blog/${featured.slug}`} className="btn-primary inline-flex">
                Read article <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="lg:col-span-2 bg-gradient-to-br from-[#0F172A] to-[#1e3a5f] rounded-2xl flex items-center justify-center min-h-[200px]">
              <div className="text-center px-6">
                <div className="text-5xl font-black text-white/10 mb-2">01</div>
                <div className="text-white/40 text-sm">Featured Post</div>
              </div>
            </div>
          </div>

          {/* Post grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rest.map(post =>
              post.published ? (
                <Link key={post.slug} href={`/blog/${post.slug}`} className="card-interactive p-6 flex flex-col">
                  <div className="flex items-center gap-2 mb-4">
                    <span className={`badge ${
                      post.category === 'Security' ? 'badge-red' :
                      post.category === 'Performance' ? 'badge-yellow' :
                      post.category === 'Maintenance' ? 'badge-teal' : 'badge-blue'
                    }`}>
                      {post.category}
                    </span>
                  </div>
                  <h3 className="font-bold text-[#0F172A] mb-2 leading-snug group-hover:text-[#2563EB] transition-colors">
                    {post.title}
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed mb-5 flex-1">{post.excerpt}</p>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {post.readTime}
                    </span>
                    <span>{post.date}</span>
                  </div>
                </Link>
              ) : (
                <div key={post.slug} className="card p-6 flex flex-col opacity-60">
                  <div className="flex items-center gap-2 mb-4">
                    <span className={`badge ${
                      post.category === 'Security' ? 'badge-red' :
                      post.category === 'Performance' ? 'badge-yellow' :
                      post.category === 'Maintenance' ? 'badge-teal' : 'badge-blue'
                    }`}>{post.category}</span>
                    <span className="badge-slate text-xs">Coming soon</span>
                  </div>
                  <h3 className="font-bold text-[#0F172A] mb-2 leading-snug">{post.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed mb-5 flex-1">{post.excerpt}</p>
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {post.readTime}</span>
                    <span>{post.date}</span>
                  </div>
                </div>
              )
            )}
          </div>


          {/* CMS note */}
          <p className="text-center text-xs text-slate-400 mt-10">
            Content powered by Strapi CMS — articles managed without code deployments (FR-11)
          </p>
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="section-sm bg-[#0F172A]">
        <div className="container-default max-w-xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Get practical web insights monthly</h2>
          <p className="text-slate-400 text-sm mb-6">No spam. One email a month with actionable tips for business website owners.</p>
          <div className="flex gap-3">
            <input type="email" placeholder="your@email.com" className="input flex-1 bg-white/5 border-white/10 text-white placeholder-slate-500" />
            <button className="btn-primary shrink-0">Subscribe</button>
          </div>
        </div>
      </section>
    </>
  );
}
