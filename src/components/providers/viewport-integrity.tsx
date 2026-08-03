"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Recovers from stuck full-viewport black/white screens caused by:
 * - Radix dialog/sheet scroll-lock left on document.body after a failed close
 * - Orphan open overlays (bg-black/*) after soft navigation
 * - pointer-events:none on body with no active modal
 *
 * Users reported pure black or pure white "blackouts" that sometimes survive
 * reload until the lock/portal state clears, this runs on route change and
 * on window focus to force a clean viewport when no legitimate overlay is open.
 */
function hasLegitimateBlockingOverlay(): boolean {
  if (typeof document === "undefined") return false;

  // Open Radix overlays / dialogs / sheets
  const openRadix = document.querySelector(
    '[data-state="open"].fixed.inset-0, [data-state="open"][class*="fixed"][class*="inset-0"]',
  );
  if (openRadix) return true;

  // Elevated loaders / intentional full-screen blockers that are still interactive
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

  // Orphan closed overlays that still paint a black/white veil (must run even
  // when another legitimate modal is open , closed shells should never remain).
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

  // Radix remove-scroll / react-remove-scroll leftovers
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

  // Defensive: body/html sometimes keep inert/aria-hidden after portal teardown
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
    // After every soft navigation, clear leftover locks from modals.
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
    // Safety net: if the page looks locked for >2s with no overlay, unlock.
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
