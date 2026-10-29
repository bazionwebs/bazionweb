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
}

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
          // A cart anchors on exactly one subscription plan — adding another
          // replaces it (WHMCS behaves the same way for plan switches).
          const base = item.kind === 'PLAN' ? state.items.filter((i) => i.kind !== 'PLAN') : state.items;
          const existing = base.find((i) => i.key === key);
          if (existing) {
            // Plans/hosting are single-subscription lines — cap at 1; add-ons stack.
            const cap = item.kind === 'PLAN' || item.cycle !== 'one-time' ? 1 : 10;
            return {
              items: base.map((i) =>
                i.key === key ? { ...i, qty: Math.min(cap, i.qty + item.qty) } : i,
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
