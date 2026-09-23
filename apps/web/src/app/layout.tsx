import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '../styles/globals.css';
import CookieBanner from '@/components/ui/CookieBanner';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://bazionweb.com'),
  title: { default: 'BazionWeb — Build. Host. Grow.', template: '%s | BazionWeb' },
  description: 'Complete website lifecycle management for growing businesses. Professional web development, managed hosting, security, maintenance & 24/7 support — one provider, one invoice.',
  keywords: ['managed website hosting','custom website development','website maintenance service','managed web services','website security management','website lifecycle management'],
  authors: [{ name: 'BazionWeb' }],
  creator: 'BazionWeb',
  openGraph: {
    type: 'website', locale: 'en_US', url: 'https://bazionweb.com', siteName: 'BazionWeb',
    title: 'BazionWeb — Build. Host. Grow.',
    description: 'Complete website lifecycle management. Development, hosting, maintenance, security & support — one trusted provider.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'BazionWeb' }],
  },
  twitter: {
    card: 'summary_large_image', title: 'BazionWeb — Build. Host. Grow.',
    description: 'Complete website lifecycle management for growing businesses.', images: ['/og-image.png'],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large' } },
  icons: { icon: '/favicon.ico', shortcut: '/favicon-16x16.png', apple: '/apple-touch-icon.png' },
  manifest: '/site.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#ffffff', width: 'device-width', initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="min-h-screen bg-white antialiased">
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
