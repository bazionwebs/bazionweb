import { renderHook, act } from '@testing-library/react';
import { useStoreScrollspy } from '../useStoreScrollspy';

describe('useStoreScrollspy hook', () => {
  const sectionIds = ['plans', 'hosting', 'addons', 'websites'];
  let observerInstances: Array<{
    callback: IntersectionObserverCallback;
    observe: jest.Mock;
    disconnect: jest.Mock;
  }> = [];

  beforeEach(() => {
    observerInstances = [];
    window.location.hash = '';

    // Mock IntersectionObserver
    (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = jest.fn(
      (callback: IntersectionObserverCallback) => {
        const instance = {
          callback,
          observe: jest.fn(),
          unobserve: jest.fn(),
          disconnect: jest.fn(),
          takeRecords: jest.fn().mockReturnValue([]),
          root: null,
          rootMargin: '',
          thresholds: [],
        };
        observerInstances.push(instance);
        return instance;
      }
    );

    // Create DOM elements for section anchors
    sectionIds.forEach((id) => {
      const el = document.createElement('div');
      el.id = id;
      el.scrollIntoView = jest.fn();
      document.body.appendChild(el);
    });

    jest.spyOn(window.history, 'replaceState').mockImplementation(() => {});
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  afterEach(() => {
    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) document.body.removeChild(el);
    });
    jest.restoreAllMocks();
  });

  it('initializes activeSection with the first section ID', () => {
    const { result } = renderHook(() =>
      useStoreScrollspy(sectionIds, { isDataReady: true })
    );

    expect(result.current.activeSection).toBe('plans');
    expect(result.current.activeId).toBe('plans');
  });

  it('scrolls to section smoothly and updates hash on scrollToSection', () => {
    const { result } = renderHook(() =>
      useStoreScrollspy(sectionIds, { isDataReady: true })
    );

    const hostingEl = document.getElementById('hosting')!;

    act(() => {
      result.current.scrollToSection('hosting');
    });

    expect(result.current.activeSection).toBe('hosting');
    expect(hostingEl.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    });
    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '#hosting');
  });

  it('executes post-hydration hash navigation when isDataReady becomes true', async () => {
    window.location.hash = '#websites';

    const { rerender } = renderHook(
      ({ isDataReady }) => useStoreScrollspy(sectionIds, { isDataReady }),
      { initialProps: { isDataReady: false } }
    );

    const websitesEl = document.getElementById('websites')!;
    expect(websitesEl.scrollIntoView).not.toHaveBeenCalled();

    // Now async catalog data finishes loading:
    await act(async () => {
      rerender({ isDataReady: true });
    });

    expect(websitesEl.scrollIntoView).toHaveBeenCalled();
  });

  it('updates activeSection when IntersectionObserver reports section in view', () => {
    const { result } = renderHook(() =>
      useStoreScrollspy(sectionIds, { isDataReady: true })
    );

    expect(observerInstances.length).toBeGreaterThan(0);
    const observer = observerInstances[0];

    const addonsEl = document.getElementById('addons')!;

    act(() => {
      observer.callback(
        [
          {
            target: addonsEl,
            isIntersecting: true,
            boundingClientRect: { top: 50 } as DOMRectReadOnly,
            intersectionRatio: 0.8,
            intersectionRect: {} as DOMRectReadOnly,
            rootBounds: null,
            time: Date.now(),
          },
        ],
        observer as unknown as IntersectionObserver
      );
    });

    expect(result.current.activeSection).toBe('addons');
    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '#addons');
  });

  it('handles bottom-of-page edge case by activating the last section', () => {
    const { result } = renderHook(() =>
      useStoreScrollspy(sectionIds, { isDataReady: true })
    );

    // Mock window at bottom
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    Object.defineProperty(window, 'scrollY', { value: 1200, configurable: true });
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      value: 2000,
      configurable: true,
    });

    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    expect(result.current.activeSection).toBe('websites');
    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '#websites');
  });

  it('responds to dynamic hashchange events', () => {
    renderHook(() =>
      useStoreScrollspy(sectionIds, { isDataReady: true })
    );

    const hostingEl = document.getElementById('hosting')!;

    act(() => {
      window.location.hash = '#hosting';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    expect(hostingEl.scrollIntoView).toHaveBeenCalled();
  });

  it('cleans up event listeners and observer on unmount', () => {
    const { unmount } = renderHook(() =>
      useStoreScrollspy(sectionIds, { isDataReady: true })
    );

    expect(observerInstances.length).toBeGreaterThan(0);
    const observer = observerInstances[0];

    unmount();

    expect(observer.disconnect).toHaveBeenCalled();
  });

  it('unlocks manual scroll guard after 800ms and does not cancel unlock timer on activeSection change', () => {
    jest.useFakeTimers();

    const { result } = renderHook(() =>
      useStoreScrollspy(sectionIds, { isDataReady: true })
    );

    const addonsEl = document.getElementById('addons')!;

    // 1. Trigger manual scroll
    act(() => {
      result.current.scrollToSection('websites');
    });

    expect(result.current.activeSection).toBe('websites');

    const activeObserver = observerInstances[observerInstances.length - 1];

    // 2. While within 800ms window (e.g. at 300ms), observer event is ignored
    act(() => {
      jest.advanceTimersByTime(300);
      activeObserver.callback(
        [
          {
            target: addonsEl,
            isIntersecting: true,
            boundingClientRect: { top: 10 } as DOMRectReadOnly,
            intersectionRatio: 1,
            intersectionRect: {} as DOMRectReadOnly,
            rootBounds: null,
            time: Date.now(),
          },
        ],
        activeObserver as unknown as IntersectionObserver
      );
    });

    expect(result.current.activeSection).toBe('websites');

    // 3. Advance past 800ms (remaining 500ms + 50ms)
    act(() => {
      jest.advanceTimersByTime(550);
    });

    // 4. Now that the lockout timer has expired, subsequent observer callbacks update activeSection
    act(() => {
      activeObserver.callback(
        [
          {
            target: addonsEl,
            isIntersecting: true,
            boundingClientRect: { top: 10 } as DOMRectReadOnly,
            intersectionRatio: 1,
            intersectionRect: {} as DOMRectReadOnly,
            rootBounds: null,
            time: Date.now(),
          },
        ],
        activeObserver as unknown as IntersectionObserver
      );
    });

    expect(result.current.activeSection).toBe('addons');

    jest.useRealTimers();
  });
});
