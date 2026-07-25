"use client";

import {
  REF_COOKIE_MAX_AGE_SECONDS,
  REF_COOKIE_NAME,
} from "@/lib/affiliate/ref-cookie.client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export function RefCapture() {
  const params = useSearchParams();
  useEffect(() => {
    const code = params.get("ref")?.trim();
    if (!code) return;
    document.cookie = [
      `${REF_COOKIE_NAME}=${encodeURIComponent(code)}`,
      "Path=/",
      `Max-Age=${REF_COOKIE_MAX_AGE_SECONDS}`,
      "SameSite=Lax",
    ].join("; ");
  }, [params]);
  return null;
}
