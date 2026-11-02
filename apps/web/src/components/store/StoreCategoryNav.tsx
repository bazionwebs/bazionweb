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
      className="sticky top-20 z-30 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs transition-shadow"
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
                'absolute left-0 top-0 bottom-0 w-8 z-10 pointer-events-none bg-gradient-to-r from-white via-white/80 to-transparent transition-opacity duration-200',
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
                      'group flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-200 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2',
                      isActive
                        ? 'bg-[#2563EB] text-white shadow-sm shadow-blue-500/20'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 bg-transparent border border-slate-200/60'
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0 transition-colors',
                        isActive
                          ? 'text-white'
                          : 'text-slate-500 group-hover:text-slate-700'
                      )}
                    />
                    <span>{cat.label}</span>

                    {typeof cat.count === 'number' && (
                      <span
                        className={cn(
                          'text-[11px] font-extrabold px-2 py-0.5 rounded-full transition-colors',
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200 group-hover:text-slate-900'
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
                            ? 'bg-teal-400 text-slate-900'
                            : 'bg-teal-50 text-teal-700 border border-teal-200/60'
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
                            ? 'bg-teal-400 text-slate-900'
                            : 'bg-teal-50 text-teal-700 border border-teal-200/60'
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
                'absolute right-0 top-0 bottom-0 w-8 z-10 pointer-events-none bg-gradient-to-l from-white via-white/80 to-transparent transition-opacity duration-200',
                canScrollRight ? 'opacity-100' : 'opacity-0'
              )}
            />
          </div>

          {/* Integrated Quick Cart CTA */}
          <div className="shrink-0">
            <Link
              href="/cart"
              aria-label={`View Cart, ${cartCount} items`}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs sm:text-sm font-bold hover:bg-slate-800 transition-all duration-150 shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
            >
              <ShoppingCart className="h-4 w-4 text-teal-400" />
              <span className="hidden sm:inline">View Cart</span>
              <span className="bg-[#2563EB] text-white text-[11px] font-extrabold px-2 py-0.5 rounded-full">
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
