'use client';

import type { TawkVisitorAttributes } from '@/types/tawk';

type ReadyCallback = () => void;

let ready = false;
let hooked = false;
const readyQueue: ReadyCallback[] = [];

function isApiReady(): boolean {
  if (typeof window === 'undefined') return false;
  const api = window.Tawk_API;
  if (!api) return false;
  return (
    typeof api.maximize === 'function' ||
    typeof api.setAttributes === 'function' ||
    typeof api.addEvent === 'function'
  );
}

function flushQueue() {
  ready = true;
  const pending = readyQueue.splice(0);
  for (const cb of pending) {
    try {
      cb();
    } catch (error) {
      console.warn('[Tawk] queued callback threw:', error);
    }
  }
}

function ensureOnLoadHook() {
  if (typeof window === 'undefined' || hooked) return;
  hooked = true;
  const api = (window.Tawk_API = window.Tawk_API || {});
  const prevOnLoad = api.onLoad;
  api.onLoad = () => {
    flushQueue();
    if (prevOnLoad) {
      try {
        prevOnLoad();
      } catch (error) {
        console.warn('[Tawk] chained onLoad handler threw:', error);
      }
    }
  };
  if (isApiReady()) flushQueue();
}

export function onTawkReady(cb: ReadyCallback): void {
  if (typeof window === 'undefined') return;
  ensureOnLoadHook();
  if (ready || isApiReady()) {
    try {
      cb();
    } catch (error) {
      console.warn('[Tawk] eager callback threw:', error);
    }
    return;
  }
  readyQueue.push(cb);
}

export function safeSetAttributes(attributes: TawkVisitorAttributes): void {
  if (typeof window === 'undefined') return;
  onTawkReady(() => {
    const setAttributes = window.Tawk_API?.setAttributes;
    if (!setAttributes) return;
    try {
      setAttributes(attributes, (error?: Error) => {
        if (error) console.warn('[Tawk] setAttributes skipped by socket:', error?.message || error);
      });
    } catch (error) {
      console.warn('[Tawk] setAttributes threw:', error);
    }
  });
}

export function safeAddEvent(eventName: string, metadata?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  onTawkReady(() => {
    const addEvent = window.Tawk_API?.addEvent;
    if (!addEvent) return;
    try {
      addEvent(eventName, metadata, (error?: Error) => {
        if (error) console.warn('[Tawk] addEvent skipped by socket:', error?.message || error);
      });
    } catch (error) {
      console.warn('[Tawk] addEvent threw:', error);
    }
  });
}
