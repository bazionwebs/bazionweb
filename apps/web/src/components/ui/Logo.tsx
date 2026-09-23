import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type LogoProps = {
  /** light = dark wordmark for white backgrounds; dark = white wordmark for dark backgrounds */
  variant?: 'light' | 'dark';
  /** Link target. Pass null to render a plain span (e.g. inside another link). */
  href?: string | null;
  /** Show the "BazionWeb" wordmark next to the mark. */
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
        alt="BazionWeb logo"
        width={512}
        height={282}
        priority={priority}
        className={cn('h-9 w-auto shrink-0', markClassName)}
      />
      {wordmark && (
        <span
          className={cn(
            'font-bold text-lg tracking-tight',
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
    return <span className={cn('inline-flex items-center gap-2', className)}>{content}</span>;
  }

  return (
    <Link href={href} aria-label="BazionWeb home" className={cn('inline-flex items-center gap-2 shrink-0', className)}>
      {content}
    </Link>
  );
}
