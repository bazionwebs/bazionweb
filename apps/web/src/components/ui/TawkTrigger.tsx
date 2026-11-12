'use client';

import { useEffect, useRef } from 'react';
import { useTawk } from '@/hooks/useTawk';

export interface TawkTriggerProps {
  dwellSeconds?: number;
  scrollDepthPercent?: number;
  exitIntent?: boolean;
  customEventName?: string;
  eventData?: Record<string, unknown>;
  message?: string;
}

export default function TawkTrigger({
  dwellSeconds,
  scrollDepthPercent,
  exitIntent,
  customEventName,
  eventData,
  message,
}: TawkTriggerProps) {
  const { maximize, addEvent, setAttributes } = useTawk();
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    if (hasTriggeredRef.current) return;

    let dwellTimer: NodeJS.Timeout | null = null;

    // 1. Dwell Timer Trigger
    if (dwellSeconds && dwellSeconds > 0) {
      dwellTimer = setTimeout(() => {
        if (!hasTriggeredRef.current) {
          hasTriggeredRef.current = true;
          maximize();
          if (customEventName) {
            addEvent(customEventName, eventData);
          }
          if (message) {
            setAttributes({ trigger_message: message });
          }
        }
      }, dwellSeconds * 1000);
    }

    // 2. Scroll Depth Trigger
    function handleScroll() {
      if (hasTriggeredRef.current || !scrollDepthPercent) return;
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight <= 0) return;
      const currentScrollPercent = (window.scrollY / scrollHeight) * 100;

      if (currentScrollPercent >= scrollDepthPercent) {
        hasTriggeredRef.current = true;
        setAttributes({ scrolled_75_percent: true });
        maximize();
        if (customEventName) {
          addEvent(customEventName, eventData);
        }
      }
    }

    if (scrollDepthPercent) {
      window.addEventListener('scroll', handleScroll, { passive: true });
    }

    // 3. Desktop Exit Intent Trigger
    function handleMouseLeave(e: MouseEvent) {
      if (hasTriggeredRef.current || !exitIntent) return;
      const supportsTouchInput = typeof window.ontouchstart === 'function';
      const isTouchOnlyPointer = window.matchMedia?.('(hover: none) and (pointer: coarse)').matches ?? false;
      if (supportsTouchInput || isTouchOnlyPointer) return; // Ignore touch-enabled devices.

      if (e.clientY <= 0) {
        hasTriggeredRef.current = true;
        maximize();
        addEvent('exit_intent_fired', {
          ...eventData,
          url: typeof window !== 'undefined' ? window.location.pathname : '',
        });
      }
    }

    if (exitIntent) {
      document.addEventListener('mouseleave', handleMouseLeave);
    }

    return () => {
      if (dwellTimer) clearTimeout(dwellTimer);
      if (scrollDepthPercent) window.removeEventListener('scroll', handleScroll);
      if (exitIntent) document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [
    dwellSeconds,
    scrollDepthPercent,
    exitIntent,
    customEventName,
    eventData,
    message,
    maximize,
    addEvent,
    setAttributes,
  ]);

  return null;
}
