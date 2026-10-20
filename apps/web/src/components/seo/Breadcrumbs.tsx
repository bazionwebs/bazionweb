import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import JsonLd from './JsonLd';

export type Crumb = { name: string; href?: string };

const SITE = 'https://bazionwebs.com';

/** Accessible breadcrumb trail with matching BreadcrumbList structured data. */
export default function Breadcrumbs({ trail, tone = 'dark' }: { trail: Crumb[]; tone?: 'light' | 'dark' }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      ...(c.href ? { item: `${SITE}${c.href}` } : {}),
    })),
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
          {trail.map((c, i) => {
            const last = i === trail.length - 1;
            return (
              <li key={c.name} className="flex items-center gap-1.5 min-w-0">
                {i > 0 && <ChevronRight className="w-3 h-3 shrink-0" aria-hidden />}
                {c.href && !last ? (
                  <Link href={c.href} className="hover:text-white transition-colors truncate">
                    {c.name}
                  </Link>
                ) : (
                  <span
                    aria-current={last ? 'page' : undefined}
                    className={tone === 'dark' ? 'text-white font-medium truncate' : 'text-slate-600 font-medium truncate'}
                  >
                    {c.name}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
