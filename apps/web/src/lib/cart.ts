'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Client-side shopping cart, WHMCS-style: browse the store, collect multiple
 * items, check out once. The cart only carries *identity* (product IDs, plan
 * slugs, quantities) — every price shown here is display-only and the billing
 * API re-prices the whole order server-side from the active price book at
 * checkout, so tampered local state can never change what is charged.
 */
export type CartKind = 'PLAN' | 'CATALOG';

export interface CartItem {
  /** Stable unique key within the cart (kind + id + cycle). */
  key: string;
  kind: CartKind;
  /** Plan slug for PLAN items, price-book product ID for CATALOG items. */
  id: string;
  name: string;
  /** MONTHLY | ANNUAL for plans; 'one-time' | 'month' | 'year' for catalog items. */
  cycle: string;
  qty: number;
  /** Display-only unit price in the market currency. */
  unitPrice: number;
  currency: string;
  /** Optional metadata such as domain name or existing website URL. */
  meta?: string;
}

export const isWebsiteItem = (item: { id: string; kind?: string }): boolean =>
  item.id.startsWith('website-') ||
  item.id.startsWith('ecommerce-') ||
  item.id.startsWith('pkg-') ||
  item.id.startsWith('custom-tier-') ||
  item.id.startsWith('service-admin-hub-');

export const isDomainItem = (item: { id: string; kind?: string }): boolean =>
  item.id.startsWith('domain-');

export const isHostingItem = (item: { id: string; kind?: string }): boolean =>
  item.id.startsWith('host-');

export const isCarePlanItem = (item: { id: string; kind?: string }): boolean =>
  item.kind === 'PLAN' || item.id.startsWith('care-');

export const isAddOnItem = (item: { id: string; kind?: string }): boolean =>
  !isWebsiteItem(item) && !isDomainItem(item) && !isHostingItem(item) && !isCarePlanItem(item);

interface CartState {
  items: CartItem[];
  add: (item: Omit<CartItem, 'key'>) => void;
  remove: (key: string) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
}

const makeKey = (item: Omit<CartItem, 'key'>) => `${item.kind}:${item.id}:${item.cycle}`;

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (item) =>
        set((state) => {
          const key = makeKey(item);
          // Single-slot categories (Care Plan, Website Foundation, Domain, Hosting)
          // replace any prior selection in the same slot; Add-Ons stack freely.
          let base = state.items;
          if (item.kind === 'PLAN' || item.id.startsWith('care-')) {
            base = base.filter((i) => i.kind !== 'PLAN' && !i.id.startsWith('care-'));
          } else if (isWebsiteItem(item)) {
            base = base.filter((i) => !isWebsiteItem(i));
          } else if (isDomainItem(item)) {
            base = base.filter((i) => !isDomainItem(i));
          } else if (isHostingItem(item)) {
            base = base.filter((i) => !isHostingItem(i));
          }

          const existing = base.find((i) => i.key === key);
          if (existing) {
            const isSingleSlot =
              item.kind === 'PLAN' ||
              item.cycle !== 'one-time' ||
              isWebsiteItem(item) ||
              isDomainItem(item) ||
              isHostingItem(item);
            const cap = isSingleSlot ? 1 : 10;
            return {
              items: base.map((i) =>
                i.key === key
                  ? { ...i, qty: Math.min(cap, i.qty + item.qty), ...(item.meta !== undefined ? { meta: item.meta } : {}) }
                  : i,
              ),
            };
          }
          return { items: [...base, { ...item, key }] };
        }),
      remove: (key) => set((state) => ({ items: state.items.filter((i) => i.key !== key) })),
      setQty: (key, qty) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.key === key ? { ...i, qty: Math.max(1, Math.min(10, qty)) } : i,
          ),
        })),
      clear: () => set({ items: [] }),
    }),
    { name: 'bazionweb-cart', storage: createJSONStorage(() => localStorage), version: 1 },
  ),
);

export const cartCount = (items: CartItem[]) => items.reduce((n, i) => n + i.qty, 0);

export const cartTotal = (items: CartItem[]) =>
  items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
