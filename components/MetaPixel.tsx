"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

// Meta (Facebook) Pixel. Renders nothing until NEXT_PUBLIC_META_PIXEL_ID is set,
// so it's safe to ship now. Fires PageView on every route change (App Router).
const PIXEL = process.env.NEXT_PUBLIC_META_PIXEL_ID;

export function MetaPixel() {
  const pathname = usePathname();
  // The private investor page is never tracked: it isn't a guest funnel, and its
  // visitors shouldn't land in guest ad audiences.
  const untracked = (pathname ?? "").startsWith("/invest");
  useEffect(() => {
    if (untracked) return;
    if (PIXEL && typeof window !== "undefined" && (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq) {
      (window as unknown as { fbq: (...a: unknown[]) => void }).fbq("track", "PageView");
    }
  }, [pathname, untracked]);

  if (!PIXEL || untracked) return null;
  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${PIXEL}');fbq('track','PageView');`}
    </Script>
  );
}
