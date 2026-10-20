"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { connectResultFromQuery } from "@/lib/mercadolivre/connect";
import type { MercadoLivreConnectResult } from "@/lib/mercadolivre/types";

export function useConnectRedirectResult(path: string, onResult: (result: MercadoLivreConnectResult) => void) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const result = connectResultFromQuery(new URLSearchParams(searchParams.toString()));
    if (!result) return;
    onResult(result);
    router.replace(path);
  }, [searchParams, router, path, onResult]);
}
