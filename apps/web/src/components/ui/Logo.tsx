import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type LogoProps = {
  /** light = for white/light backgrounds; dark = for dark backgrounds (same image, no change needed) */
  variant?: 'light' | 'dark';
  /** Link target. Pass null to render a plain span (e.g. inside another link). */
  href?: string | null;
  /**
   * wordmark is kept for API compatibility but no longer has an effect —
   * the full logo image already contains the wordmark text.
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
  // Suppress unused-variable lint warnings while keeping the prop signature stable
  void variant;
  void wordmark;
  void textClassName;

  const content = (
    <Image
      src="/brand/logo-full.png"
      alt="BazionWeb – Build, Host n Grow"
      width={1080}
      height={1080}
      priority={priority}
      className={cn('h-14 w-auto shrink-0 object-contain', markClassName)}
    />
  );

  if (href === null) {
    return (
      <span className={cn('inline-flex items-center shrink-0', className)}>
        {content}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label="BazionWeb home"
      className={cn('inline-flex items-center shrink-0', className)}
    >
      {content}
    </Link>
  );
}
