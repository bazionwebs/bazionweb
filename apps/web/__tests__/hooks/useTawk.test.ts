import { renderHook, act } from '@testing-library/react';
import { useTawk } from '@/hooks/useTawk';

describe('useTawk hook (apps/web/src/hooks/useTawk.ts)', () => {
  beforeEach(() => {
    // Reset window.Tawk_API
    delete (window as any).Tawk_API;
    delete (window as any).Tawk_LoadStart;
  });

  it('initializes with default status and loaded=false when Tawk is not loaded', () => {
    const { result } = renderHook(() => useTawk());
    expect(result.current.isLoaded).toBe(false);
    expect(result.current.status).toBe('offline');
  });

  it('updates isLoaded and status when Tawk_API is already available on window', () => {
    (window as any).Tawk_API = {
      maximize: jest.fn(),
      minimize: jest.fn(),
      toggle: jest.fn(),
      getStatus: jest.fn().mockReturnValue('online'),
    };

    const { result } = renderHook(() => useTawk());
    expect(result.current.isLoaded).toBe(true);
    expect(result.current.status).toBe('online');
  });

  it('triggers onLoaded callback when onLoad fires', () => {
    const { result } = renderHook(() => useTawk());
    const onLoadedCallback = jest.fn();

    act(() => {
      result.current.onLoaded(onLoadedCallback);
    });
    expect(onLoadedCallback).not.toHaveBeenCalled();

    act(() => {
      if ((window as any).Tawk_API?.onLoad) {
        (window as any).Tawk_API.getStatus = jest.fn().mockReturnValue('online');
        (window as any).Tawk_API.onLoad();
      }
    });

    expect(result.current.isLoaded).toBe(true);
    expect(onLoadedCallback).toHaveBeenCalledTimes(1);
  });

  it('delegates maximize, minimize, toggle, setAttributes, and addEvent to Tawk_API', () => {
    const mockMaximize = jest.fn();
    const mockMinimize = jest.fn();
    const mockToggle = jest.fn();
    const mockSetAttributes = jest.fn();
    const mockAddEvent = jest.fn();
    const mockAddTags = jest.fn();

    (window as any).Tawk_API = {
      maximize: mockMaximize,
      minimize: mockMinimize,
      toggle: mockToggle,
      setAttributes: mockSetAttributes,
      addEvent: mockAddEvent,
      addTags: mockAddTags,
      getStatus: () => 'online',
    };

    const { result } = renderHook(() => useTawk());

    act(() => {
      result.current.maximize();
      result.current.minimize();
      result.current.toggle();
      result.current.setAttributes({ name: 'Test User', market: 'KE' });
      result.current.addEvent('test_event', { key: 'val' });
      result.current.addTags(['pricing_visitor']);
    });

    expect(mockMaximize).toHaveBeenCalledTimes(1);
    expect(mockMinimize).toHaveBeenCalledTimes(1);
    expect(mockToggle).toHaveBeenCalledTimes(1);
    expect(mockSetAttributes).toHaveBeenCalledWith({ name: 'Test User', market: 'KE' }, expect.any(Function));
    expect(mockAddEvent).toHaveBeenCalledWith('test_event', { key: 'val' }, expect.any(Function));
    expect(mockAddTags).toHaveBeenCalledWith(['pricing_visitor']);
  });
});
