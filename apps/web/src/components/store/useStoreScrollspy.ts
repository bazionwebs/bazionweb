'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface UseStoreScrollspyOptions {
  isDataReady?: boolean;
  headerOffset?: number;
}

export interface UseStoreScrollspyReturn {
  activeSection: string;
  activeId: string;
  scrollToSection: (id: string, updateHash?: boolean) => void;
}

/**
 * Custom hook managing scrollspy tracking, post-hydration deep link scrolling,
 * and URL hash synchronization for the Store page.
 */
export function useStoreScrollspy(
  sectionIds: string[],
  options?: UseStoreScrollspyOptions
): UseStoreScrollspyReturn {
  const isDataReady = options?.isDataReady ?? true;
  const headerOffset = options?.headerOffset ?? 176;

  const [activeSection, setActiveSection] = useState<string>(
    () => sectionIds[0] || 'plans'
  );
  const isManualScroll = useRef(false);
  const manualTimeout = useRef<NodeJS.Timeout | null>(null);
  const hasHydratedHash = useRef(false);

  const scrollToSection = useCallback(
    (id: string, updateHash: boolean = true) => {
      if (typeof window === 'undefined') return;

      const element = document.getElementById(id);
      if (!element) return;

      isManualScroll.current = true;
      if (manualTimeout.current) {
        clearTimeout(manualTimeout.current);
      }
      manualTimeout.current = setTimeout(() => {
        isManualScroll.current = false;
      }, 800);

      setActiveSection(id);

      const prefersReducedMotion =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      element.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'start',
      });

      if (updateHash && window.location.hash !== `#${id}`) {
        window.history.replaceState(null, '', `#${id}`);
      }
    },
    []
  );

  // Dedicated cleanup for manual scroll lock timeout on unmount only
  useEffect(() => {
    return () => {
      if (manualTimeout.current) {
        clearTimeout(manualTimeout.current);
      }
    };
  }, []);

  // 1. Post-Hydration Deep Linking:
  // When isDataReady becomes true, check the URL hash and smoothly scroll to the section.
  useEffect(() => {
    if (typeof window === 'undefined' || !isDataReady || hasHydratedHash.current) {
      return;
    }

    const currentHash = window.location.hash.replace('#', '');
    if (currentHash && sectionIds.includes(currentHash)) {
      hasHydratedHash.current = true;
      // Use requestAnimationFrame to ensure React has fully rendered and the DOM layout is stable
      const frameId = requestAnimationFrame(() => {
        scrollToSection(currentHash, false);
      });
      return () => cancelAnimationFrame(frameId);
    }
  }, [isDataReady, sectionIds, scrollToSection]);

  // 2. Dynamic Hash Changes (e.g. forward/back navigation or external link clicks)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && sectionIds.includes(hash)) {
        scrollToSection(hash, false);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [sectionIds, scrollToSection]);

  // 3. Scroll Listener & IntersectionObserver
  useEffect(() => {
    if (typeof window === 'undefined' || !isDataReady) return;

    // Bottom-of-page edge case: activate the last section if scrolled to bottom
    const handleScroll = () => {
      if (isManualScroll.current) return;

      const doc = document.documentElement;
      const isAtBottom =
        window.innerHeight + window.scrollY >= doc.scrollHeight - 60;

      if (isAtBottom && sectionIds.length > 0) {
        const lastId = sectionIds[sectionIds.length - 1];
        if (lastId && activeSection !== lastId) {
          setActiveSection(lastId);
          if (window.location.hash !== `#${lastId}`) {
            window.history.replaceState(null, '', `#${lastId}`);
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          if (isManualScroll.current) return;

          const visibleEntries = entries.filter((e) => e.isIntersecting);
          if (visibleEntries.length > 0) {
            visibleEntries.sort(
              (a, b) => a.boundingClientRect.top - b.boundingClientRect.top
            );
            const topEntry = visibleEntries[0];
            const newId = topEntry.target.id;
            if (newId && sectionIds.includes(newId) && newId !== activeSection) {
              setActiveSection(newId);
              if (window.location.hash !== `#${newId}`) {
                window.history.replaceState(null, '', `#${newId}`);
              }
            }
          }
        },
        {
          rootMargin: `-${headerOffset}px 0px -55% 0px`,
          threshold: [0, 0.2, 0.5],
        }
      );

      sectionIds.forEach((id) => {
        const el = document.getElementById(id);
        if (el) observer?.observe(el);
      });
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
      observer?.disconnect();
    };
  }, [isDataReady, sectionIds, activeSection, headerOffset]);

  return {
    activeSection,
    activeId: activeSection,
    scrollToSection,
  };
}
