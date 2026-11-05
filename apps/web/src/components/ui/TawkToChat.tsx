'use client';

import { Suspense, useEffect, useRef } from 'react';
import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { safeAddEvent, safeSetAttributes } from '@/lib/tawk-bridge';

const TAWK_TITLE_NOTIFICATION_RE = /\bnew message/i;

const DEFAULT_PROPERTY_ID = '6ae6de21896a4b3c3630071b';
const DEFAULT_WIDGET_ID = '1k6at7dq5';

export const ROUTE_TITLES: Record<string, string> = {
  '/': 'Build. Launch. Manage. Grow. | BazionWeb Digital Engineering | BazionWeb',
  '/services': 'Digital Engineering Services — Websites, E-Commerce & Systems | BazionWeb',
  '/services/websites': 'Website Design & Development | BazionWeb',
  '/services/ecommerce': 'E-Commerce Website Development & M-Pesa Integration | BazionWeb',
  '/services/custom-systems': 'Custom Web Applications & Systems | BazionWeb',
  '/services/hosting': 'Managed Cloud Hosting & Infrastructure | BazionWeb',
  '/services/maintenance': 'Proactive Website Care & Maintenance | BazionWeb',
  '/services/security': 'Security Hardening, OWASP Audits & Compliance | BazionWeb',
  '/services/performance': 'Performance Engineering & Core Web Vitals | BazionWeb',
  '/services/managed-technology': 'Managed Technology Services | BazionWeb',
  '/services/specialized-services': 'Specialized Engineering Services | BazionWeb',
  '/services/support': 'Engineering Support & Care | BazionWeb',
  '/pricing': 'Transparent Fixed Pricing & Care Plans | BazionWeb',
  '/about': 'About BazionWeb — Digital Systems & Web Engineering Partner | BazionWeb',
  '/contact': 'Contact Engineering & Start Your Project | BazionWeb',
  '/process': 'Our 6-Stage Delivery Process | BazionWeb',
  '/case-studies': 'Case Studies & Client Success Stories | BazionWeb',
  '/faq': 'Frequently Asked Questions | BazionWeb',
  '/quote': 'Instant Project Quote & Scope Estimator | BazionWeb',
  '/store': 'Digital Solutions & Care Plans Store | BazionWeb',
  '/cart': 'Shopping Cart | BazionWeb',
  '/checkout': 'Secure Checkout | BazionWeb',
  '/blog': 'Engineering Blog & Technical Insights | BazionWeb',
  '/careers': 'Careers & Engineering Culture | BazionWeb',
  '/solutions': 'Tailored Digital Solutions | BazionWeb',
  '/solutions/smes': 'Solutions for SMEs & Growing Businesses | BazionWeb',
  '/solutions/churches': 'Solutions for Churches & Ministries | BazionWeb',
  '/solutions/education': 'Solutions for Schools & Education | BazionWeb',
  '/solutions/ngos': 'Solutions for NGOs & Non-Profits | BazionWeb',
  '/solutions/startups': 'Solutions for Startups & Product MVPs | BazionWeb',
  '/solutions/professional-services': 'Solutions for Professional Services | BazionWeb',
  '/legal/privacy': 'Privacy Policy | BazionWeb',
  '/legal/terms': 'Terms of Service | BazionWeb',
  '/legal/cookies': 'Cookie Policy | BazionWeb',
  '/legal/sla': 'Service Level Agreement (SLA) | BazionWeb',
  '/legal/dpa': 'Data Processing Agreement (DPA) | BazionWeb',
  '/portal': 'Client Portal | BazionWeb',
  '/portal/login': 'Client Portal Login | BazionWeb',
  '/portal/packages': 'Packages & Retainers | BazionWeb',
  '/portal/invoices': 'Invoices & Billing | BazionWeb',
  '/portal/support': 'Engineering Support | BazionWeb',
  '/portal/vault': 'Encrypted Vault | BazionWeb',
  '/portal/milestones': 'Project Milestones | BazionWeb',
  '/portal/assets': 'Digital Assets | BazionWeb',
  '/admin': 'Admin Dashboard | BazionWeb',
  '/admin/login': 'Admin Login | BazionWeb',
};

const SECTION_HASH_TITLES: Record<string, string> = {
  websites: 'Websites Section',
  ecommerce: 'E-Commerce Section',
  'custom-systems': 'Custom Systems Section',
  care: 'Managed Technology Section',
  specialized: 'Specialized Services Section',
  pricing: 'Pricing Section',
  faq: 'FAQ Section',
  contact: 'Contact Section',
};

export function resolveTitleForPath(pathOrUrl: string): string {
  if (!pathOrUrl) return '';

  try {
    // Normalise to URL object if needed
    const dummyOrigin = 'https://bazionweb.com';
    const parsed = pathOrUrl.startsWith('http')
      ? new URL(pathOrUrl)
      : new URL(pathOrUrl, dummyOrigin);

    const pathname = parsed.pathname;
    const hash = parsed.hash ? parsed.hash.replace('#', '') : '';

    if (hash && SECTION_HASH_TITLES[hash]) {
      const baseTitle = ROUTE_TITLES[pathname] || `${pathname.replace('/', '')} | BazionWeb`;
      const cleanBase = baseTitle.replace(' | BazionWeb', '');
      return `${SECTION_HASH_TITLES[hash]} — ${cleanBase} | BazionWeb`;
    }

    if (ROUTE_TITLES[pathname]) {
      return ROUTE_TITLES[pathname];
    }

    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) {
      return ROUTE_TITLES['/'];
    }

    const last = segments[segments.length - 1];
    const formatted = last
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    return `${formatted} | BazionWeb`;
  } catch {
    return '';
  }
}

function TawkRouteTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastSentTitleRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const queryString = searchParams?.toString();
    const fullUrl = queryString ? `${pathname}?${queryString}` : pathname;
    const resolvedTitle = resolveTitleForPath(fullUrl);

    // Defer title update to the next microtask/frame to prevent React insertion effect conflicts
    const frameId = window.requestAnimationFrame(() => {
      if (resolvedTitle && document.title !== resolvedTitle) {
        document.title = resolvedTitle;
      }

      const appliedTitle = document.title || resolvedTitle;
      lastSentTitleRef.current = appliedTitle;
      safeSetAttributes({
        current_path: fullUrl,
        current_title: appliedTitle,
      });
      safeAddEvent('route-change', {
        path: fullUrl,
        title: appliedTitle,
      });
    });

    // Listen for subsequent dynamic DOM <title> changes by Next.js metadata streaming.
    // Tawk mutates the same node with chat-notification titles (e.g. "1 new message") —
    // those are echoes, not page titles, and must never be pushed back into setAttributes.
    let observer: MutationObserver | null = null;
    const titleEl = document.querySelector('title');
    if (titleEl && typeof MutationObserver !== 'undefined') {
      observer = new MutationObserver(() => {
        if (TAWK_TITLE_NOTIFICATION_RE.test(document.title)) return;
        if (lastSentTitleRef.current === document.title) return;
        lastSentTitleRef.current = document.title;
        safeSetAttributes({
          current_path: fullUrl,
          current_title: document.title,
        });
      });
      observer.observe(titleEl, { subtree: true, characterData: true, childList: true });
    }

    return () => {
      window.cancelAnimationFrame(frameId);
      if (observer) {
        observer.disconnect();
      }
    };
  }, [pathname, searchParams]);

  return null;
}

export default function TawkToChat() {
  const propertyId = process.env.NEXT_PUBLIC_TAWK_PROPERTY_ID || DEFAULT_PROPERTY_ID;
  const widgetId = process.env.NEXT_PUBLIC_TAWK_WIDGET_ID || DEFAULT_WIDGET_ID;

  return (
    <>
      <Suspense fallback={null}>
        <TawkRouteTracker />
      </Suspense>
      <Script
        id="tawk-to-script"
        strategy="lazyOnload"
        dangerouslySetInnerHTML={{
          __html: `
            var Tawk_API = Tawk_API || {}, Tawk_LoadStart = new Date();
            (function(){
              var s1 = document.createElement("script"), s0 = document.getElementsByTagName("script")[0];
              s1.async = true;
              s1.src = 'https://embed.tawk.to/${propertyId}/${widgetId}';
              s1.charset = 'UTF-8';
              s1.setAttribute('crossorigin', '*');
              s0.parentNode.insertBefore(s1, s0);
            })();
          `,
        }}
      />
    </>
  );
}
