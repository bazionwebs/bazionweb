'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { useCartStore, cartCount } from '@/lib/cart';

/** Header cart icon with a live item count. Renders a plain icon on the
 *  server and during the first paint so persisted cart state never causes
 *  a hydration mismatch. */
export default function NavbarCartLink() {
  const items = useCartStore((s) => s.items);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const count = mounted ? cartCount(items) : 0;

  return (
    <Link
      href="/cart"
      aria-label={`Shopping cart${count ? `, ${count} item${count === 1 ? '' : 's'}` : ' (empty)'}`}
      className="relative p-2 rounded-xl text-slate-700 hover:text-[#0D9488] hover:bg-teal-50 transition-colors"
    >
      <ShoppingCart className="w-5 h-5" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#2563EB] px-1 text-[10px] font-bold text-white">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  );
}
