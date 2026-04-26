"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Scissors, Sparkles } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";

function isModifiedClick(e: MouseEvent): boolean {
  return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
}

export function NavigationLoading() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const routeKey = useMemo(() => `${pathname}?${searchParams.toString()}`, [pathname, searchParams]);

  useEffect(() => {
    if (!loading) return;
    window.clearTimeout(timeoutRef.current ?? undefined);
    timeoutRef.current = window.setTimeout(() => setLoading(false), 250);
    return () => {
      window.clearTimeout(timeoutRef.current ?? undefined);
    };
  }, [routeKey, loading]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || isModifiedClick(event)) return;
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const rawHref = anchor.getAttribute("href") ?? "";
      if (
        rawHref === "" ||
        rawHref.startsWith("#") ||
        rawHref.startsWith("mailto:") ||
        rawHref.startsWith("tel:") ||
        rawHref.startsWith("javascript:")
      ) {
        return;
      }

      const nextUrl = new URL(anchor.href, window.location.href);
      if (nextUrl.origin !== window.location.origin) return;
      const current = `${window.location.pathname}${window.location.search}`;
      const next = `${nextUrl.pathname}${nextUrl.search}`;
      if (current === next) return;
      setLoading(true);
      window.clearTimeout(timeoutRef.current ?? undefined);
      timeoutRef.current = window.setTimeout(() => setLoading(false), 10000);
    };

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.clearTimeout(timeoutRef.current ?? undefined);
    };
  }, []);

  return (
    <>
      <div
        className={`pointer-events-none fixed left-0 right-0 top-0 z-[100] h-0.5 overflow-hidden transition-opacity ${
          loading ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden
      >
        <div className="h-full w-full origin-left animate-pulse bg-blue-500" />
      </div>
      {loading ? (
        <div className="pointer-events-none fixed right-3 top-3 z-[101] inline-flex items-center gap-2 rounded-full border border-slate-700 bg-white/90 px-3 py-2 text-[#B76E79] shadow-lg">
          <Sparkles className="barber-loader-chip h-3.5 w-3.5" />
          <Scissors className="barber-loader-scissor h-4 w-4" />
          <Sparkles className="barber-loader-chip h-3.5 w-3.5" />
        </div>
      ) : null}
    </>
  );
}
