import { render, screen } from '@testing-library/react';
import Footer from './Footer';

describe('Footer', () => {
  it('should render the brand name', () => {
    render(<Footer />);
    const brandLink = screen.getByRole('link', { name: 'BazionWeb home' });
    expect(brandLink).toBeInTheDocument();
    expect(brandLink.textContent).toContain('BazionWeb');
  });

  it('should render services links', () => {
    render(<Footer />);
    expect(screen.getByText('Services')).toBeInTheDocument();
    expect(screen.getByText('Custom Systems & Portals')).toBeInTheDocument();
  });

  it('should render company links', () => {
    render(<Footer />);
    expect(screen.getByText('Company')).toBeInTheDocument();
    expect(screen.getByText('About Us')).toBeInTheDocument();
    const helpCenterLink = screen.getByRole('link', { name: 'Help Center' });
    expect(helpCenterLink).toBeInTheDocument();
    expect(helpCenterLink).toHaveAttribute('href', 'https://help.bazionweb.com');
  });

  it('should render legal links', () => {
    render(<Footer />);
    expect(screen.getByText('Legal')).toBeInTheDocument();
    expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
  });

  it('should render contact info', () => {
    render(<Footer />);
    expect(screen.getByText('hello@bazionweb.com')).toBeInTheDocument();
    expect(screen.getByText('Remote-first · Worldwide')).toBeInTheDocument();
  });
});
