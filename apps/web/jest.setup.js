try {
  require('@testing-library/jest-dom');
} catch {
  try {
    require(require.resolve('@testing-library/jest-dom', { paths: [__dirname] }));
  } catch {
    // @testing-library/jest-dom optional fallback
  }
}

jest.mock('next/navigation', () => {
  const actual = jest.requireActual('next/navigation');
  return {
    ...actual,
    useRouter: jest.fn(() => ({
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    })),
    usePathname: jest.fn(() => '/'),
    useSearchParams: jest.fn(() => new URLSearchParams()),
  };
});
