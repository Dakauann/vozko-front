"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function hasLegitimateBlockingOverlay(): boolean {
  if (typeof document === "undefined") return false;

  const openRadix = document.querySelector(
    '[data-state="open"].fixed.inset-0, [data-state="open"][class*="fixed"][class*="inset-0"]',
  );
  if (openRadix) return true;

  const loader = document.querySelector(
    ".fixed.inset-0.z-50.flex.items-center.justify-center",
  );
  if (loader && loader.childElementCount > 0) return true;

  return false;
}

function releaseStuckBodyLock() {
  if (typeof document === "undefined") return;

  const body = document.body;
  const html = document.documentElement;
  const legitimate = hasLegitimateBlockingOverlay();

  document
    .querySelectorAll(
      '[data-state="closed"].fixed.inset-0, [data-state="closed"][class*="fixed"][class*="inset-0"]',
    )
    .forEach((el) => {
      const node = el as HTMLElement;
      node.style.pointerEvents = "none";
      node.style.display = "none";
      node.setAttribute("aria-hidden", "true");
    });

  if (legitimate) return;

  if (body.style.pointerEvents === "none") {
    body.style.pointerEvents = "";
  }
  if (body.style.overflow === "hidden" || body.style.overflow === "clip") {
    body.style.overflow = "";
  }
  if (html.style.overflow === "hidden" || html.style.overflow === "clip") {
    html.style.overflow = "";
  }
  body.removeAttribute("data-scroll-locked");
  body.removeAttribute("data-aria-hidden");
  html.classList.remove("overflow-hidden");

  if (body.hasAttribute("inert")) body.removeAttribute("inert");
  if (html.hasAttribute("inert")) html.removeAttribute("inert");
}

export function ViewportIntegrityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  useEffect(() => {
    const t = window.setTimeout(releaseStuckBodyLock, 50);
    const t2 = window.setTimeout(releaseStuckBodyLock, 400);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, [pathname]);

  useEffect(() => {
    const onFocus = () => releaseStuckBodyLock();
    const onVisibility = () => {
      if (document.visibilityState === "visible") releaseStuckBodyLock();
    };
    const interval = window.setInterval(() => {
      const locked =
        document.body.style.pointerEvents === "none" ||
        document.body.getAttribute("data-scroll-locked") != null ||
        document.body.style.overflow === "hidden";
      if (locked && !hasLegitimateBlockingOverlay()) {
        releaseStuckBodyLock();
      }
    }, 2000);

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <>{children}</>;
}
