import type { Metadata } from 'next';
import CartView from '@/components/billing/CartView';

export const metadata: Metadata = {
  title: 'Shopping Cart | BazionWeb',
  description: 'Review the items in your BazionWeb cart and check out once with M-Pesa or card.',
};

export default function CartPage() {
  return <CartView />;
}
