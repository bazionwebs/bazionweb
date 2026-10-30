import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type LogoProps = {
  /** light = dark wordmark text for white/light backgrounds; dark = white wordmark text for dark backgrounds */
  variant?: 'light' | 'dark';
  /** Link target. Pass null to render a plain span (e.g. inside another link). */
  href?: string | null;
  /**
   * When true (default) renders the "BazionWeb" brand name text beside the logo image.
   * The full logo image already contains the wordmark, but the text label helps
   * at small render sizes where the image text becomes hard to read.
   */
  wordmark?: boolean;
  className?: string;
  markClassName?: string;
  textClassName?: string;
  priority?: boolean;
};

export default function Logo({
  variant = 'light',
  href = '/',
  wordmark = true,
  className,
  markClassName,
  textClassName,
  priority = false,
}: LogoProps) {
  const logoSrc = variant === 'dark' ? '/brand/logo-full-dark.png' : '/brand/logo-full.png';

  const content = (
    <>
      <Image
        src={logoSrc}
        alt="BazionWeb – Build, Host n Grow"
        width={320}
        height={320}
        priority={priority}
        sizes="(max-width: 640px) 120px, 240px"
        className={cn('h-14 w-auto shrink-0 object-contain', markClassName)}
      />
      {wordmark && (
        <span
          className={cn(
            'font-extrabold text-xl tracking-tight leading-none',
            variant === 'light' ? 'text-[#0F172A]' : 'text-white',
            textClassName,
          )}
        >
          BazionWeb
        </span>
      )}
    </>
  );

  if (href === null) {
    return (
      <span className={cn('inline-flex items-center gap-3 shrink-0', className)}>
        {content}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label="BazionWeb home"
      className={cn('inline-flex items-center gap-3 shrink-0', className)}
    >
      {content}
    </Link>
  );
}
