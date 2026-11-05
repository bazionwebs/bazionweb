'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { TawkVisitorAttributes } from '@/types/tawk';
import { safeAddEvent, safeSetAttributes } from '@/lib/tawk-bridge';

export function useTawk() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [status, setStatus] = useState<'online' | 'away' | 'offline'>('offline');
  const loadedCallbacksRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.Tawk_API && typeof window.Tawk_API.maximize === 'function') {
      setIsLoaded(true);
      if (window.Tawk_API.getStatus) {
        setStatus(window.Tawk_API.getStatus());
      }
      loadedCallbacksRef.current.forEach((cb) => cb());
      loadedCallbacksRef.current = [];
    }

    const prevOnLoad = window.Tawk_API?.onLoad;
    const prevOnStatusChange = window.Tawk_API?.onStatusChange;

    const tawk = (window.Tawk_API = window.Tawk_API || {});
    tawk.onLoad = () => {
      setIsLoaded(true);
      if (window.Tawk_API?.getStatus) {
        setStatus(window.Tawk_API.getStatus());
      }
      loadedCallbacksRef.current.forEach((cb) => cb());
      loadedCallbacksRef.current = [];
      if (prevOnLoad) prevOnLoad();
    };

    tawk.onStatusChange = (newStatus) => {
      setStatus(newStatus);
      if (prevOnStatusChange) prevOnStatusChange(newStatus);
    };
  }, []);

  const onLoaded = useCallback(
    (callback: () => void) => {
      if (typeof window === 'undefined') return;
      if (isLoaded) {
        callback();
      } else {
        loadedCallbacksRef.current.push(callback);
      }
    },
    [isLoaded],
  );

  const maximize = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (window.Tawk_API?.maximize) {
      window.Tawk_API.maximize();
    }
  }, []);

  const minimize = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (window.Tawk_API?.minimize) {
      window.Tawk_API.minimize();
    }
  }, []);

  const toggle = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (window.Tawk_API?.toggle) {
      window.Tawk_API.toggle();
    }
  }, []);

  const setAttributes = useCallback((attrs: TawkVisitorAttributes) => {
    safeSetAttributes(attrs);
  }, []);

  const addEvent = useCallback((eventName: string, metadata?: Record<string, unknown>) => {
    safeAddEvent(eventName, metadata);
  }, []);

  const addTags = useCallback((tags: string[]) => {
    if (typeof window === 'undefined') return;
    if (window.Tawk_API?.addTags) {
      window.Tawk_API.addTags(tags);
    }
  }, []);

  return {
    isLoaded,
    status,
    maximize,
    minimize,
    toggle,
    setAttributes,
    addEvent,
    addTags,
    onLoaded,
  };
}
