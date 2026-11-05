import React from 'react';
import { render } from '@testing-library/react';
import TawkToChat, { resolveTitleForPath } from '@/components/ui/TawkToChat';

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/pricing'),
  useSearchParams: jest.fn(() => ({
    toString: () => '',
  })),
}));

describe('TawkToChat Component & Title Synchronization', () => {
  beforeEach(() => {
    (window as any).Tawk_API = {
      setAttributes: jest.fn(),
      addEvent: jest.fn(),
    };
    document.title = 'Initial Title';
  });

  afterEach(() => {
    delete (window as any).Tawk_API;
    delete (window as any).__tawk_history_sync_installed;
    jest.clearAllMocks();
  });

  describe('resolveTitleForPath', () => {
    it('resolves exact known routes', () => {
      expect(resolveTitleForPath('/pricing')).toContain('Transparent Fixed Pricing');
      expect(resolveTitleForPath('/about')).toContain('About BazionWeb');
      expect(resolveTitleForPath('/services/hosting')).toContain('Managed Cloud Hosting');
      expect(resolveTitleForPath('/')).toContain('Build. Launch. Manage. Grow.');
    });

    it('resolves section anchor hashes', () => {
      expect(resolveTitleForPath('/services#ecommerce')).toContain('E-Commerce Section');
      expect(resolveTitleForPath('/services#websites')).toContain('Websites Section');
    });

    it('formats unknown kebab-case slugs gracefully', () => {
      expect(resolveTitleForPath('/custom-feature')).toBe('Custom Feature | BazionWeb');
    });
  });

  describe('Route Tracker & Attribute Synchronization', () => {
    it('syncs current_title and current_path to window.Tawk_API on mount and updates document.title safely', () => {
      // Mock requestAnimationFrame to run synchronously for tests
      const originalRaf = window.requestAnimationFrame;
      window.requestAnimationFrame = (cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      };

      try {
        render(<TawkToChat />);

        expect(document.title).toContain('Transparent Fixed Pricing');

        expect(window.Tawk_API?.setAttributes).toHaveBeenCalledWith(
          expect.objectContaining({
            current_path: '/pricing',
            current_title: expect.stringContaining('Pricing'),
          }),
          expect.any(Function)
        );

        expect(window.Tawk_API?.addEvent).toHaveBeenCalledWith(
          'route-change',
          expect.objectContaining({
            path: '/pricing',
            title: expect.stringContaining('Pricing'),
          }),
          expect.any(Function)
        );
      } finally {
        window.requestAnimationFrame = originalRaf;
      }
    });
  });
});

