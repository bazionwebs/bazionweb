import type { Metadata, Viewport } from 'next';
import '../styles/globals.css';
import CookieBanner from '@/components/ui/CookieBanner';
import MicrosoftClarity from '@/components/analytics/MicrosoftClarity';

export const metadata: Metadata = {
  metadataBase: new URL('https://bazionweb.com'),
  title: {
    default: 'BazionWeb — Web Design, Custom Systems & E-Commerce Development',
    template: '%s | BazionWeb',
  },
  description:
    'Professional web design, custom Next.js development, e-commerce stores with M-Pesa integration, bespoke digital systems, and ongoing website care for businesses in Kenya and worldwide.',
  keywords: [
    'web design company Kenya',
    'website development Nairobi',
    'custom web application development',
    'e-commerce website Kenya',
    'M-Pesa STK push integration',
    'Next.js web developers Kenya',
    'website maintenance services',
    'client portal development',
    'corporate web design Kenya',
    'BazionWeb',
  ],
  authors: [{ name: 'BazionWeb', url: 'https://bazionweb.com' }],
  creator: 'BazionWeb',
  publisher: 'BazionWeb',
  formatDetection: {
    email: true,
    address: true,
    telephone: true,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    alternateLocale: ['en_GB'],
    url: 'https://bazionweb.com',
    siteName: 'BazionWeb',
    title: 'BazionWeb — Web Design, Custom Systems & E-Commerce Development',
    description:
      'Professional web design, custom Next.js development, e-commerce with M-Pesa integration, bespoke portals, and ongoing website care for businesses in Kenya and worldwide.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'BazionWeb — Websites, E-Commerce & Custom Digital Systems' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BazionWeb — Web Design, Custom Systems & E-Commerce Development',
    description:
      'Professional web design, custom Next.js development, e-commerce with M-Pesa, bespoke systems, and ongoing website care.',
    images: ['/og-image.png'],
    creator: '@bazionweb',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  manifest: '/site.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Early synchronous cookie synchronization script to eliminate FOWC & hydration drift */}
        <script
          id="market-init-sync"
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  try {
    if (!document.cookie.match(/(?:^|;\\s*)bazion_market=/)) {
      var tz = (typeof Intl !== 'undefined' && Intl.DateTimeFormat) ? Intl.DateTimeFormat().resolvedOptions().timeZone : '';
      var eaZones = ['Africa/Nairobi','Africa/Kampala','Africa/Dar_es_Salaam','Africa/Kigali','Africa/Bujumbura','Africa/Juba','Africa/Addis_Ababa','Africa/Mogadishu','Africa/Asmara','Africa/Djibouti','Indian/Comoro','Indian/Mayotte','Indian/Antananarivo'];
      var isKE = tz === 'Africa/Nairobi' || eaZones.indexOf(tz) !== -1 || (tz && tz.toLowerCase().indexOf('nairobi') !== -1);
      var code = isKE ? 'KE' : 'GLOBAL';
      var legacy = isKE ? 'kenya' : 'international';
      var exp = new Date(Date.now() + 365 * 864e5).toUTCString();
      document.cookie = 'bazion_market=' + code + '; expires=' + exp + '; path=/; SameSite=Lax';
      document.cookie = 'bw-market=' + legacy + '; expires=' + exp + '; path=/; SameSite=Lax';
    }
  } catch (e) {}
})();
`,
          }}
        />
      </head>
      <body className="min-h-screen bg-white antialiased font-sans">
        {children}
        <MicrosoftClarity />
        <CookieBanner />
      </body>
    </html>
  );
}
