"use client";

/**
 * Page-transition feedback — thin top bar immediately, plus a pulsing
 * logo overlay if the navigation outlasts LOGO_DELAY_MS (fast prefetched
 * navs never flash it). Only page transitions trigger it; in-page async
 * (preview, submit, OTP) has its own inline loading states. An aborted
 * navigation self-clears via the failsafe so the bar can't pin forever.
 */

import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const NAV_FAILSAFE_MS = 10_000;
const LOGO_DELAY_MS = 200;

export function TopLoader() {
  const pathname = usePathname();
  const location = `${pathname}?${useSearchParams().toString()}`;

  const [navPending, setNavPending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const [showLogo, setShowLogo] = useState(false);

  // Start on internal link click or history back/forward. A click whose
  // target keeps the same path+search (hash-only jump) isn't a nav.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor = (event.target as Element).closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return;
      }
      const url = new URL(anchor.href);
      if (url.origin !== window.location.origin) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }
      setNavPending(true);
    };
    const onPopState = () => setNavPending(true);
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  // A committed URL change completes the pending navigation.
  const prevLocation = useRef(location);
  useEffect(() => {
    if (prevLocation.current === location) return;
    prevLocation.current = location;
    setNavPending(false);
  }, [location]);

  useEffect(() => {
    if (!navPending) return;
    const timer = setTimeout(() => setNavPending(false), NAV_FAILSAFE_MS);
    return () => clearTimeout(timer);
  }, [navPending]);

  // The logo only earns the overlay after the delay — quicker
  // transitions just get the bar.
  useEffect(() => {
    if (!navPending) {
      setShowLogo(false);
      return;
    }
    const timer = setTimeout(() => setShowLogo(true), LOGO_DELAY_MS);
    return () => clearTimeout(timer);
  }, [navPending]);

  useEffect(() => {
    if (navPending) {
      setVisible(true);
      setProgress((p) => (p <= 0 ? 15 : p));
      const timer = setInterval(() => {
        setProgress((p) => Math.min(90, p + (90 - p) * 0.08));
      }, 200);
      return () => clearInterval(timer);
    }
    if (!visible) return;
    setProgress(100);
    const timer = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [navPending, visible]);

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <div
          className="h-full bg-primary transition-[width] duration-200 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div
        aria-hidden
        className={`pointer-events-none fixed inset-0 z-40 grid place-items-center bg-background/70 backdrop-blur-[2px] transition-opacity duration-200 ${
          showLogo ? "opacity-100" : "opacity-0"
        }`}
      >
        <Image
          src="/logo-header.png"
          alt=""
          width={140}
          height={60}
          className="animate-pulse"
        />
      </div>
    </>
  );
}
