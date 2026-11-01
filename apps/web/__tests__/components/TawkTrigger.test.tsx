import React from 'react';
import { render, act, fireEvent } from '@testing-library/react';
import TawkTrigger from '@/components/ui/TawkTrigger';

describe('TawkTrigger component (apps/web/src/components/ui/TawkTrigger.tsx)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    (window as any).Tawk_API = {
      maximize: jest.fn(),
      addEvent: jest.fn(),
      setAttributes: jest.fn(),
      getStatus: () => 'online',
    };
  });

  afterEach(() => {
    jest.useRealTimers();
    delete (window as any).Tawk_API;
  });

  it('triggers maximize and addEvent after dwellSeconds elapsed', () => {
    render(
      <TawkTrigger
        dwellSeconds={5}
        customEventName="pricing_dwell_5s"
        eventData={{ page: '/pricing' }}
      />
    );

    expect((window as any).Tawk_API.maximize).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect((window as any).Tawk_API.maximize).toHaveBeenCalledTimes(1);
    expect((window as any).Tawk_API.addEvent).toHaveBeenCalledWith(
      'pricing_dwell_5s',
      { page: '/pricing' },
      expect.any(Function)
    );
  });

  it('cleans up dwell timer on unmount before timeout fires', () => {
    const { unmount } = render(
      <TawkTrigger
        dwellSeconds={10}
        customEventName="pricing_dwell_10s"
      />
    );

    act(() => {
      jest.advanceTimersByTime(4000);
    });
    expect((window as any).Tawk_API.maximize).not.toHaveBeenCalled();

    unmount();

    act(() => {
      jest.advanceTimersByTime(10000);
    });
    expect((window as any).Tawk_API.maximize).not.toHaveBeenCalled();
  });

  it('triggers exit intent when mouse leaves top of viewport on desktop', () => {
    render(<TawkTrigger exitIntent />);

    expect((window as any).Tawk_API.maximize).not.toHaveBeenCalled();

    act(() => {
      fireEvent.mouseLeave(document, { clientY: -5 });
    });

    expect((window as any).Tawk_API.maximize).toHaveBeenCalledTimes(1);
    expect((window as any).Tawk_API.addEvent).toHaveBeenCalledWith(
      'exit_intent_fired',
      expect.objectContaining({ url: expect.any(String) }),
      expect.any(Function)
    );
  });
});
