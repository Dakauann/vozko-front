"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { connectResultFromQuery } from "@/lib/tiktok/connect";
import type { TiktokConnectResult } from "@/lib/tiktok/types";

export function useTiktokRedirectResult(path: string, onResult: (result: TiktokConnectResult) => void) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const result = connectResultFromQuery(new URLSearchParams(searchParams.toString()));
    if (!result) return;
    onResult(result);
    router.replace(path);
  }, [searchParams, router, path, onResult]);
}
