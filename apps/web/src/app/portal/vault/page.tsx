import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Encrypted Vault',
  description: 'Securely deposit and manage API keys and credentials for your project.',
};

export { default } from './VaultClient';
