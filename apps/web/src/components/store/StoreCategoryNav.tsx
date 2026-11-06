'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StoreCategoryItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number | string;
  href: string;
  badge?: string;
}

export interface StoreCategoryNavProps {
  categories: StoreCategoryItem[];
  activeId: string;
  onSelectCategory: (id: string) => void;
  cartCount?: number;
}

export function StoreCategoryNav({
  categories,
  activeId,
  onSelectCategory,
  cartCount = 0,
}: StoreCategoryNavProps) {
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pillRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

  const checkScrollBounds = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4);
  }, []);

  useEffect(() => {
    checkScrollBounds();
    window.addEventListener('resize', checkScrollBounds);
    return () => window.removeEventListener('resize', checkScrollBounds);
  }, [checkScrollBounds, categories]);

  // Auto-center active pill when activeId changes
  useEffect(() => {
    const activePill = pillRefs.current[activeId];
    const scroller = scrollerRef.current;
    if (!activePill || !scroller) return;

    const pillLeft = activePill.offsetLeft;
    const pillWidth = activePill.offsetWidth;
    const scrollerWidth = scroller.clientWidth;

    const targetScrollLeft = pillLeft - scrollerWidth / 2 + pillWidth / 2;
    if (typeof scroller.scrollTo === 'function') {
      scroller.scrollTo({
        left: targetScrollLeft,
        behavior: 'smooth',
      });
    } else {
      scroller.scrollLeft = targetScrollLeft;
    }
    checkScrollBounds();
  }, [activeId, checkScrollBounds]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const currentIndex = categories.findIndex((c) => c.id === activeId);
    if (currentIndex === -1) return;

    let nextIndex = -1;
    if (e.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % categories.length;
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + categories.length) % categories.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = categories.length - 1;
    } else if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') {
      e.preventDefault();
      onSelectCategory(categories[currentIndex].id);
      return;
    }

    if (nextIndex !== -1) {
      e.preventDefault();
      const nextCategory = categories[nextIndex];
      onSelectCategory(nextCategory.id);
      pillRefs.current[nextCategory.id]?.focus();
    }
  };

  return (
    <nav
      aria-label="Store category navigation"
      className="sticky top-20 z-30 w-full bg-[#1E293B] backdrop-blur-md border-y border-slate-700/80 shadow-md transition-shadow"
    >
      <div className="container-default max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16 gap-3 sm:gap-4">
          {/* Category Pills Scroller with Progressive Fade Indicators */}
          <div className="relative flex-1 min-w-0 flex items-center">
            {/* Left Fade Indicator */}
            <div
              data-testid="fade-left"
              aria-hidden="true"
              className={cn(
                'absolute left-0 top-0 bottom-0 w-8 z-10 pointer-events-none bg-gradient-to-r from-[#1E293B] via-[#1E293B]/80 to-transparent transition-opacity duration-200',
                canScrollLeft ? 'opacity-100' : 'opacity-0'
              )}
            />

            {/* Scrollable Pills Container */}
            <div
              ref={scrollerRef}
              onScroll={checkScrollBounds}
              role="tablist"
              aria-label="Store Categories"
              className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-2 px-1 focus:outline-none"
              tabIndex={0}
              onKeyDown={handleKeyDown}
            >
              {categories.map((cat) => {
                const isActive = activeId === cat.id;
                const Icon = cat.icon;
                return (
                  <a
                    key={cat.id}
                    ref={(el) => {
                      pillRefs.current[cat.id] = el;
                    }}
                    href={cat.href || `#${cat.id}`}
                    role="tab"
                    id={`tab-${cat.id}`}
                    aria-controls={cat.id}
                    aria-selected={isActive}
                    tabIndex={isActive ? 0 : -1}
                    onClick={(e) => {
                      e.preventDefault();
                      onSelectCategory(cat.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') {
                        e.preventDefault();
                        onSelectCategory(cat.id);
                      }
                    }}
                    className={cn(
                      'group flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-200 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1E293B]',
                      isActive
                        ? 'bg-[#2563EB] text-white shadow-md shadow-blue-500/30 ring-1 ring-blue-400/50'
                        : 'text-slate-200 hover:text-white hover:bg-slate-700/80 bg-slate-800/80 border border-slate-600/80'
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0 transition-colors',
                        isActive
                          ? 'text-[#14B8A6]'
                          : 'text-slate-300 group-hover:text-white'
                      )}
                    />
                    <span>{cat.label}</span>

                    {typeof cat.count === 'number' && (
                      <span
                        className={cn(
                          'text-[11px] font-extrabold px-2 py-0.5 rounded-full transition-colors',
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-700 text-slate-200 group-hover:bg-slate-600 group-hover:text-white'
                        )}
                      >
                        {cat.count}
                      </span>
                    )}

                    {typeof cat.count === 'string' && (
                      <span
                        className={cn(
                          'text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full transition-colors',
                          isActive
                            ? 'bg-[#14B8A6] text-slate-950'
                            : 'bg-teal-500/20 text-teal-300 border border-teal-400/40'
                        )}
                      >
                        {cat.count}
                      </span>
                    )}

                    {cat.badge && (
                      <span
                        className={cn(
                          'text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full transition-colors',
                          isActive
                            ? 'bg-[#14B8A6] text-slate-950'
                            : 'bg-teal-500/20 text-teal-300 border border-teal-400/40'
                        )}
                      >
                        {cat.badge}
                      </span>
                    )}
                  </a>
                );
              })}
            </div>

            {/* Right Fade Indicator */}
            <div
              data-testid="fade-right"
              aria-hidden="true"
              className={cn(
                'absolute right-0 top-0 bottom-0 w-8 z-10 pointer-events-none bg-gradient-to-l from-[#1E293B] via-[#1E293B]/80 to-transparent transition-opacity duration-200',
                canScrollRight ? 'opacity-100' : 'opacity-0'
              )}
            />
          </div>

          {/* Integrated Quick Cart CTA */}
          <div className="shrink-0">
            <Link
              href="/cart"
              aria-label={`View Cart, ${cartCount} items`}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#14B8A6] text-slate-950 text-xs sm:text-sm font-extrabold hover:bg-teal-400 transition-all duration-150 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
            >
              <ShoppingCart className="h-4 w-4 text-slate-950" />
              <span className="hidden sm:inline">View Cart</span>
              <span className="bg-slate-950 text-white text-[11px] font-extrabold px-2 py-0.5 rounded-full">
                {cartCount}
              </span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default StoreCategoryNav;
