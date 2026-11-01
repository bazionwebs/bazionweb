import React from 'react';
import { render } from '@testing-library/react';
import MicrosoftClarity from '@/components/analytics/MicrosoftClarity';

// Mock next/script for DOM inspection
jest.mock('next/script', () => {
  return function MockScript({
    id,
    strategy,
    dangerouslySetInnerHTML,
  }: {
    id?: string;
    strategy?: string;
    dangerouslySetInnerHTML?: { __html: string };
  }) {
    return (
      <script
        id={id}
        data-strategy={strategy}
        dangerouslySetInnerHTML={dangerouslySetInnerHTML}
      />
    );
  };
});

describe('Empirical Verification: Microsoft Clarity & Content Security Policy', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Microsoft Clarity Component Injection Guard', () => {
    it('1.1 Renders null when NEXT_PUBLIC_CLARITY_PROJECT_ID is unset / undefined', () => {
      delete process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
      const { container } = render(<MicrosoftClarity />);
      expect(container.firstChild).toBeNull();
      expect(container.querySelector('#microsoft-clarity')).toBeNull();
    });

    it('1.2 Renders null when NEXT_PUBLIC_CLARITY_PROJECT_ID is an empty string', () => {
      process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID = '';
      const { container } = render(<MicrosoftClarity />);
      expect(container.firstChild).toBeNull();
      expect(container.querySelector('#microsoft-clarity')).toBeNull();
    });

    it('1.3 Renders null when NEXT_PUBLIC_CLARITY_PROJECT_ID is whitespace-only (spaces, tabs, newlines)', () => {
      process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID = '   \t  \n  ';
      const { container } = render(<MicrosoftClarity />);
      expect(container.firstChild).toBeNull();
      expect(container.querySelector('#microsoft-clarity')).toBeNull();
    });

    it('1.4 Injects script tag with afterInteractive strategy and trimmed ID when populated', () => {
      process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID = '  proj_clarity_emp_999  ';
      const { container } = render(<MicrosoftClarity />);

      const scriptElement = container.querySelector('#microsoft-clarity');
      expect(scriptElement).not.toBeNull();
      expect(scriptElement?.getAttribute('data-strategy')).toBe('afterInteractive');

      const innerContent = scriptElement?.innerHTML || '';
      // Confirms ID is trimmed without whitespace pollution
      expect(innerContent).toContain('"proj_clarity_emp_999"');
      expect(innerContent).not.toContain('"  proj_clarity_emp_999  "');
      // Confirms async loading implementation
      expect(innerContent).toContain('t.async=1');
      expect(innerContent).toContain('https://www.clarity.ms/tag/');
    });
  });

  describe('Content Security Policy in next.config.js', () => {
    it('1.5 Next.js CSP configuration includes clarity.ms in script-src, connect-src, and img-src', async () => {
      // Load next.config.js
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const nextConfig = require('../next.config.js');
      expect(typeof nextConfig.headers).toBe('function');

      const headersRules = await nextConfig.headers();
      const catchAllRule = headersRules.find((rule: { source: string }) => rule.source === '/(.*)');
      expect(catchAllRule).toBeDefined();

      const cspHeader = catchAllRule.headers.find(
        (h: { key: string; value: string }) => h.key === 'Content-Security-Policy'
      );
      expect(cspHeader).toBeDefined();

      const csp = cspHeader.value;

      // Extract directives
      const directives = csp.split(';').reduce((acc: Record<string, string>, dir: string) => {
        const trimmed = dir.trim();
        const firstSpace = trimmed.indexOf(' ');
        if (firstSpace > -1) {
          const key = trimmed.slice(0, firstSpace);
          const val = trimmed.slice(firstSpace + 1);
          acc[key] = val;
        }
        return acc;
      }, {});

      // Verify script-src
      expect(directives['script-src']).toBeDefined();
      expect(directives['script-src']).toContain('https://www.clarity.ms');
      expect(directives['script-src']).toContain('https://*.clarity.ms');

      // Verify connect-src
      expect(directives['connect-src']).toBeDefined();
      expect(directives['connect-src']).toContain('https://www.clarity.ms');
      expect(directives['connect-src']).toContain('https://*.clarity.ms');
      expect(directives['connect-src']).toContain('https://c.clarity.ms');

      // Verify img-src
      expect(directives['img-src']).toBeDefined();
      expect(directives['img-src']).toContain('https://www.clarity.ms');
      expect(directives['img-src']).toContain('https://*.clarity.ms');
      expect(directives['img-src']).toContain('https://c.clarity.ms');
    });
  });
});
