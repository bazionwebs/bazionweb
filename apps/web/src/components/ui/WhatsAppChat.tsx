'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { buildWhatsAppLink, trackWhatsAppOpen, WHATSAPP_DEFAULT_MESSAGE, type WhatsAppSource } from '@/lib/contact';
import { cn } from '@/lib/utils';
import WhatsAppIcon from './WhatsAppIcon';

const HIDDEN_WIDGET_PREFIXES = ['/checkout'];

interface WhatsAppLinkProps {
  source: WhatsAppSource;
  message?: string;
  className?: string;
  iconClassName?: string;
  children?: React.ReactNode;
  ariaLabel?: string;
  onClick?: () => void;
}

export function WhatsAppLink({
  source,
  message = WHATSAPP_DEFAULT_MESSAGE,
  className,
  iconClassName,
  children,
  ariaLabel,
  onClick,
}: WhatsAppLinkProps) {
  return (
    <a
      href={buildWhatsAppLink(message)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        trackWhatsAppOpen(source);
        onClick?.();
      }}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={cn('inline-flex items-center gap-2', className)}
    >
      <WhatsAppIcon className={iconClassName} />
      {children}
    </a>
  );
}

interface WhatsAppFloatingChatProps {
  source: WhatsAppSource;
  message?: string;
  label?: string;
  className?: string;
}

export default function WhatsAppFloatingChat({
  source,
  message = WHATSAPP_DEFAULT_MESSAGE,
  label = 'Chat on WhatsApp',
  className,
}: WhatsAppFloatingChatProps) {
  const pathname = usePathname();

  // Keep checkout controls unobstructed; checkout already has its own
  // contextual support prompts.
  if (HIDDEN_WIDGET_PREFIXES.some(prefix => pathname?.startsWith(prefix))) {
    return null;
  }

  return (
    <div className={cn('fixed bottom-6 right-6 z-40 print:hidden', className)}>
      <a
        href={buildWhatsAppLink(message)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackWhatsAppOpen(source)}
        aria-label={label}
        title={label}
        className="group flex items-center gap-2.5 rounded-full border border-white/20 bg-[#25D366] py-3 pl-3.5 pr-4 text-xs font-bold text-white shadow-xl shadow-[#25D366]/25 transition-all duration-150 hover:scale-105 hover:bg-[#1EBE5A] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#25D366]/40"
      >
        <WhatsAppIcon className="h-5 w-5 shrink-0" />
        <span className="hidden sm:inline">{label}</span>
      </a>
    </div>
  );
}
