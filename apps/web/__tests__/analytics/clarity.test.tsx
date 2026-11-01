import React from 'react';
import { render } from '@testing-library/react';
import MicrosoftClarity from '@/components/analytics/MicrosoftClarity';

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

describe('MicrosoftClarity component', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('renders null when NEXT_PUBLIC_CLARITY_PROJECT_ID is undefined', () => {
    delete process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
    const { container } = render(<MicrosoftClarity />);
    expect(container).toBeEmptyDOMElement();
    expect(document.querySelector('#microsoft-clarity')).toBeNull();
  });

  it('renders null when NEXT_PUBLIC_CLARITY_PROJECT_ID is an empty or whitespace string', () => {
    process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID = '   ';
    const { container } = render(<MicrosoftClarity />);
    expect(container).toBeEmptyDOMElement();
    expect(document.querySelector('#microsoft-clarity')).toBeNull();
  });

  it('renders the clarity script tag when NEXT_PUBLIC_CLARITY_PROJECT_ID is provided', () => {
    process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID = 'clarity-test-abc-123';
    const { container } = render(<MicrosoftClarity />);

    const scriptTag = container.querySelector('#microsoft-clarity');
    expect(scriptTag).not.toBeNull();
    expect(scriptTag?.getAttribute('data-strategy')).toBe('afterInteractive');
    expect(scriptTag?.innerHTML).toContain('clarity-test-abc-123');
    expect(scriptTag?.innerHTML).toContain('https://www.clarity.ms/tag/');
  });

  it('trims leading and trailing whitespace from the project ID', () => {
    process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID = '  clarity-project-trimmed  ';
    const { container } = render(<MicrosoftClarity />);

    const scriptTag = container.querySelector('#microsoft-clarity');
    expect(scriptTag).not.toBeNull();
    expect(scriptTag?.innerHTML).toContain('"clarity-project-trimmed"');
    expect(scriptTag?.innerHTML).not.toContain('"  clarity-project-trimmed  "');
  });
});
