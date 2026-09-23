'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type FaqItem = { q: string; a: string };

export default function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {items.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={f.q} className="card overflow-hidden">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
            >
              <span className="font-semibold text-[#0F172A]">{f.q}</span>
              <ChevronDown
                className={cn(
                  'w-5 h-5 shrink-0 text-slate-400 transition-transform',
                  isOpen && 'rotate-180 text-[#2563EB]',
                )}
              />
            </button>
            {isOpen && (
              <div className="px-6 pb-6 text-sm text-slate-600 leading-relaxed">{f.a}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
