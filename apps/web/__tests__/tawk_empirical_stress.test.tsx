import React from 'react';
import { render, renderHook, act, fireEvent, screen } from '@testing-library/react';
import { useTawk } from '@/hooks/useTawk';
import TawkTrigger from '@/components/ui/TawkTrigger';
import Footer from '@/components/layout/Footer';

describe('Empirical Challenger Stress Suite: Tawk.to Hooks, Components, and Navigation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    delete (window as any).Tawk_API;
    delete (window as any).Tawk_LoadStart;
    delete (window as any).ontouchstart;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    delete (window as any).Tawk_API;
    delete (window as any).Tawk_LoadStart;
    delete (window as any).ontouchstart;
  });

  describe('1. useTawk Hook Stress Scenarios', () => {
    it('Scenario A: window.Tawk_API is undefined throughout lifecycle', () => {
      const { result } = renderHook(() => useTawk());

      expect(result.current.isLoaded).toBe(false);
      expect(result.current.status).toBe('offline');

      // None of the delegated methods should throw when Tawk_API is missing
      expect(() => {
        act(() => {
          result.current.maximize();
          result.current.minimize();
          result.current.toggle();
          result.current.setAttributes({ name: 'Anonymous' });
          result.current.addEvent('test_event', { foo: 'bar' });
          result.current.addTags(['challenger_tag']);
        });
      }).not.toThrow();

      // onLoaded callback should be safely queued and not executed prematurely
      const mockCallback = jest.fn();
      act(() => {
        result.current.onLoaded(mockCallback);
      });
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('Scenario B: window.Tawk_API is already loaded BEFORE hook mount', () => {
      const mockMaximize = jest.fn();
      const mockGetStatus = jest.fn().mockReturnValue('online');

      (window as any).Tawk_API = {
        maximize: mockMaximize,
        getStatus: mockGetStatus,
      };

      const { result } = renderHook(() => useTawk());

      expect(result.current.isLoaded).toBe(true);
      expect(result.current.status).toBe('online');

      // Callback registered when already loaded should execute immediately
      const mockCallback = jest.fn();
      act(() => {
        result.current.onLoaded(mockCallback);
      });
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('Scenario C: window.Tawk_API is loaded AFTER hook mount', () => {
      const { result } = renderHook(() => useTawk());
      expect(result.current.isLoaded).toBe(false);

      const mockCallback = jest.fn();
      act(() => {
        result.current.onLoaded(mockCallback);
      });
      expect(mockCallback).not.toHaveBeenCalled();

      // Simulate external script arriving and attaching methods, then triggering onLoad
      act(() => {
        (window as any).Tawk_API.getStatus = jest.fn().mockReturnValue('away');
        (window as any).Tawk_API.onLoad();
      });

      expect(result.current.isLoaded).toBe(true);
      expect(result.current.status).toBe('away');
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('Scenario D: preserves existing pre-configured onLoad and onStatusChange callbacks (chaining)', () => {
      const existingOnLoad = jest.fn();
      const existingOnStatusChange = jest.fn();

      (window as any).Tawk_API = {
        onLoad: existingOnLoad,
        onStatusChange: existingOnStatusChange,
        getStatus: () => 'online',
      };

      const { result } = renderHook(() => useTawk());

      act(() => {
        (window as any).Tawk_API.onLoad();
      });
      expect(existingOnLoad).toHaveBeenCalledTimes(1);
      expect(result.current.isLoaded).toBe(true);

      act(() => {
        (window as any).Tawk_API.onStatusChange('away');
      });
      expect(existingOnStatusChange).toHaveBeenCalledWith('away');
      expect(result.current.status).toBe('away');
    });
  });

  describe('2. TawkTrigger Component Stress Scenarios & Unmount Cleanup', () => {
    it('Scenario A: Dwell timer unmount cleanup prevents memory leak and invocation', () => {
      const mockMaximize = jest.fn();
      (window as any).Tawk_API = {
        maximize: mockMaximize,
        addEvent: jest.fn(),
        setAttributes: jest.fn(),
      };

      const clearTimeoutSpy = jest.spyOn(window, 'clearTimeout');

      const { unmount } = render(
        <TawkTrigger dwellSeconds={8} customEventName="pricing_dwell_8s" />
      );

      act(() => {
        jest.advanceTimersByTime(3000);
      });
      expect(mockMaximize).not.toHaveBeenCalled();

      unmount();
      expect(clearTimeoutSpy).toHaveBeenCalled();

      // Advance past the 8-second mark to confirm timer was truly cancelled
      act(() => {
        jest.advanceTimersByTime(10000);
      });
      expect(mockMaximize).not.toHaveBeenCalled();
    });

    it('Scenario B: Scroll depth listener triggers at threshold and cleans up on unmount', () => {
      const mockMaximize = jest.fn();
      const mockSetAttributes = jest.fn();
      (window as any).Tawk_API = {
        maximize: mockMaximize,
        setAttributes: mockSetAttributes,
        addEvent: jest.fn(),
      };

      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

      // Mock DOM scroll heights
      Object.defineProperty(document.documentElement, 'scrollHeight', {
        value: 2000,
        configurable: true,
      });
      Object.defineProperty(window, 'innerHeight', {
        value: 1000,
        configurable: true,
      });

      const { unmount } = render(
        <TawkTrigger scrollDepthPercent={70} />
      );

      expect(addEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });

      // Scroll to 500px -> 500 / (2000 - 1000) = 50% (< 70%)
      Object.defineProperty(window, 'scrollY', { value: 500, configurable: true });
      act(() => {
        fireEvent.scroll(window);
      });
      expect(mockMaximize).not.toHaveBeenCalled();

      // Scroll to 750px -> 750 / (2000 - 1000) = 75% (>= 70%)
      Object.defineProperty(window, 'scrollY', { value: 750, configurable: true });
      act(() => {
        fireEvent.scroll(window);
      });
      expect(mockMaximize).toHaveBeenCalledTimes(1);
      expect(mockSetAttributes).toHaveBeenCalledWith({ scrolled_75_percent: true }, expect.any(Function));

      // Ensure unmount removes event listener
      unmount();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
    });

    it('Scenario C: Exit intent desktop trigger and unmount cleanup', () => {
      const mockMaximize = jest.fn();
      const mockAddEvent = jest.fn();
      (window as any).Tawk_API = {
        maximize: mockMaximize,
        addEvent: mockAddEvent,
        setAttributes: jest.fn(),
      };

      const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
      const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');

      const { unmount } = render(
        <TawkTrigger exitIntent={true} customEventName="exit_intent_fired" />
      );

      expect(addEventListenerSpy).toHaveBeenCalledWith('mouseleave', expect.any(Function));

      // Mouse leaves sideways (clientY > 0): should NOT trigger
      act(() => {
        fireEvent.mouseLeave(document, { clientY: 100 });
      });
      expect(mockMaximize).not.toHaveBeenCalled();

      // Mouse leaves top (clientY <= 0): SHOULD trigger
      act(() => {
        fireEvent.mouseLeave(document, { clientY: -2 });
      });
      expect(mockMaximize).toHaveBeenCalledTimes(1);

      unmount();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseleave', expect.any(Function));
    });

    it('Scenario D: Exit intent is ignored on mobile / touch-enabled devices', () => {
      // Simulate touch environment
      (window as any).ontouchstart = () => {};

      const mockMaximize = jest.fn();
      (window as any).Tawk_API = {
        maximize: mockMaximize,
        addEvent: jest.fn(),
        setAttributes: jest.fn(),
      };

      render(<TawkTrigger exitIntent={true} />);

      act(() => {
        fireEvent.mouseLeave(document, { clientY: -10 });
      });

      expect(mockMaximize).not.toHaveBeenCalled();
    });

    it('Scenario E: TawkTrigger executes safely without errors even when window.Tawk_API is missing during firing', () => {
      // Ensure Tawk_API is completely absent
      delete (window as any).Tawk_API;

      render(
        <TawkTrigger
          dwellSeconds={2}
          customEventName="safe_dwell"
          message="Help needed"
        />
      );

      expect(() => {
        act(() => {
          jest.advanceTimersByTime(2500);
        });
      }).not.toThrow();
    });
  });

  describe('3. Footer Help Center Link Verification', () => {
    it('renders Help Center link with exact URL, target="_blank", rel="noopener noreferrer", and accessible text', () => {
      render(<Footer />);

      const helpCenterLink = screen.getByRole('link', { name: /Help Center/i });

      expect(helpCenterLink).toBeInTheDocument();
      expect(helpCenterLink).toHaveAttribute('href', 'https://help.bazionweb.com');
      expect(helpCenterLink).toHaveAttribute('target', '_blank');
      expect(helpCenterLink).toHaveAttribute('rel', 'noopener noreferrer');
      expect(helpCenterLink.textContent).toContain('Help Center');
    });
  });
});
