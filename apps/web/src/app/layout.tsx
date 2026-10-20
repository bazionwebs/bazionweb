import type { Metadata, Viewport } from 'next';
import '../styles/globals.css';
import CookieBanner from '@/components/ui/CookieBanner';
import MarketSimulatorBar from '@/components/layout/MarketSimulatorBar';

export const metadata: Metadata = {
  metadataBase: new URL('https://bazionwebs.com'),
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
  authors: [{ name: 'BazionWeb', url: 'https://bazionwebs.com' }],
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
    url: 'https://bazionwebs.com',
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
  themeColor: '#ffffff', width: 'device-width', initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-white antialiased">
        {children}
        <CookieBanner />
        <MarketSimulatorBar />
      </body>
    </html>
  );
}
