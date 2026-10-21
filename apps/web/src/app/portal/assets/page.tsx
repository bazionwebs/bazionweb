import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Asset Sovereignty & DNS',
  description: 'View your domain ownership records, DNS configuration, and SSL certificate status.',
};

export { default } from './AssetsClient';
