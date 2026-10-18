"use client";

import { useCallback, useEffect, useState } from "react";

import { listInstancesAction } from "@/app/actions/unofficial-whatsapp";
import type { UnofficialWhatsAppInstance } from "@/lib/unofficial-whatsapp/types";

const NUMBERS_PAGE_SIZE = 100;

export interface WorkspaceNumbers {
  numbers: UnofficialWhatsAppInstance[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function numberLabel(number: Pick<UnofficialWhatsAppInstance, "displayName" | "profileName" | "phoneNumber" | "id">): string {
  return number.displayName || number.profileName || (number.phoneNumber ? `+${number.phoneNumber}` : number.id);
}

async function loadAllNumbers() {
  const numbers: UnofficialWhatsAppInstance[] = [];
  let page = 1;
  for (;;) {
    const result = await listInstancesAction(page, NUMBERS_PAGE_SIZE);
    if (result.error) return { numbers, error: result.error };
    numbers.push(...result.instances);
    if (page >= result.meta.totalPages || result.instances.length === 0) return { numbers, error: null };
    page += 1;
  }
}

export function useWorkspaceNumbers(enabled = true): WorkspaceNumbers {
  const [numbers, setNumbers] = useState<UnofficialWhatsAppInstance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);
  const [loadedGeneration, setLoadedGeneration] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void loadAllNumbers().then((result) => {
      if (cancelled) return;
      setNumbers(result.numbers);
      setError(result.error);
      setLoadedGeneration(generation);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, generation]);

  const reload = useCallback(() => setGeneration((value) => value + 1), []);

  return { numbers, loading: enabled && loadedGeneration !== generation, error, reload };
}
