"use client";

import { useEffect, useRef } from "react";

import { faviconBadgeText, titleWithoutUnread, unreadTitle } from "@/lib/conversations/unread-badge";

const ICON_SIZE = 32;
const BADGE_RADIUS = 10;
const ICON_LINKS = 'link[rel~="icon"]';

function themeColor(token: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return value ? `hsl(${value})` : "";
}

function drawBadge(icon: HTMLImageElement, text: string): string | null {
  const background = themeColor("--healthy");
  const ink = themeColor("--healthy-foreground");
  const canvas = document.createElement("canvas");
  canvas.width = ICON_SIZE;
  canvas.height = ICON_SIZE;
  const context = canvas.getContext("2d");
  if (!context || !background || !ink) return null;
  context.drawImage(icon, 0, 0, ICON_SIZE, ICON_SIZE);
  const center = ICON_SIZE - BADGE_RADIUS;
  context.beginPath();
  context.arc(center, center, BADGE_RADIUS, 0, Math.PI * 2);
  context.fillStyle = background;
  context.fill();
  context.fillStyle = ink;
  context.font = `bold ${text.length > 1 ? 11 : 14}px sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, center, center + 1);
  try {
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

function loadIcon(href: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = href;
  });
}

export function useUnreadTabBadge(count: number, enabled: boolean) {
  const iconRef = useRef<{ href: string; image: Promise<HTMLImageElement | null> } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    document.title = unreadTitle(document.title, count);
    return () => {
      document.title = titleWithoutUnread(document.title);
    };
  }, [count, enabled]);

  useEffect(() => {
    const text = faviconBadgeText(count);
    if (!enabled || !text) return;
    const links = Array.from(document.querySelectorAll<HTMLLinkElement>(ICON_LINKS));
    const originals = links.map((link) => link.getAttribute("href") ?? "");
    const runtimeIcon = originals.find(Boolean);
    if (!runtimeIcon) return;
    if (iconRef.current?.href !== runtimeIcon) iconRef.current = { href: runtimeIcon, image: loadIcon(runtimeIcon) };
    let active = true;
    void iconRef.current.image.then((image) => {
      const badged = active && image ? drawBadge(image, text) : null;
      if (badged) links.forEach((link) => link.setAttribute("href", badged));
    });
    return () => {
      active = false;
      links.forEach((link, index) => link.setAttribute("href", originals[index]));
    };
  }, [count, enabled]);
}
