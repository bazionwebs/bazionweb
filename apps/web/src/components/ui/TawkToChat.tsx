'use client';

import { Suspense, useEffect } from 'react';
import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';

const DEFAULT_PROPERTY_ID = '6ae6de21896a4b3c3630071b';
const DEFAULT_WIDGET_ID = '1k6at7dq5';

function TawkRouteTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === 'undefined' || !window.Tawk_API) return;

    const queryString = searchParams?.toString();
    const fullUrl = queryString ? `${pathname}?${queryString}` : pathname;

    if (window.Tawk_API.setAttributes) {
      window.Tawk_API.setAttributes({
        current_path: fullUrl,
      });
    }

    if (window.Tawk_API.addEvent) {
      window.Tawk_API.addEvent('route_change', { path: fullUrl });
    }
  }, [pathname, searchParams]);

  return null;
}

export default function TawkToChat() {
  const propertyId = process.env.NEXT_PUBLIC_TAWK_PROPERTY_ID || DEFAULT_PROPERTY_ID;
  const widgetId = process.env.NEXT_PUBLIC_TAWK_WIDGET_ID || DEFAULT_WIDGET_ID;

  return (
    <>
      <Suspense fallback={null}>
        <TawkRouteTracker />
      </Suspense>
      <Script
        id="tawk-to-script"
        strategy="lazyOnload"
        dangerouslySetInnerHTML={{
          __html: `
            var Tawk_API = Tawk_API || {}, Tawk_LoadStart = new Date();
            (function(){
              var s1 = document.createElement("script"), s0 = document.getElementsByTagName("script")[0];
              s1.async = true;
              s1.src = 'https://embed.tawk.to/${propertyId}/${widgetId}';
              s1.charset = 'UTF-8';
              s1.setAttribute('crossorigin', '*');
              s0.parentNode.insertBefore(s1, s0);
            })();
          `,
        }}
      />
    </>
  );
}
