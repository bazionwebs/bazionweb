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
  const content = (
    <>
      <Image
        src="/brand/logo-mark.png"
        alt="BazionWeb Logo"
        width={512}
        height={282}
        priority={priority}
        className={cn(
          'h-10 w-auto shrink-0 object-contain transition-transform duration-200 group-hover:scale-105',
          variant === 'dark' && 'drop-shadow-[0_2px_10px_rgba(37,99,235,0.4)]',
          markClassName
        )}
      />
      {wordmark && (
        <span
          className={cn(
            'font-black text-xl tracking-tight leading-none',
            variant === 'light' ? 'text-[#0F172A]' : 'text-white',
            textClassName
          )}
        >
          Bazion<span className={variant === 'light' ? 'text-[#2563EB]' : 'text-[#38BDF8]'}>Web</span>
        </span>
      )}
    </>
  );

  if (href === null) {
    return (
      <span className={cn('inline-flex items-center gap-2.5 shrink-0 select-none group', className)}>
        {content}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label="BazionWeb home"
      className={cn('inline-flex items-center gap-2.5 shrink-0 select-none group', className)}
    >
      {content}
    </Link>
  );
}
