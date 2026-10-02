"use client";

import { useEffect, useState } from "react";

import { estimatedProgress } from "@/lib/image-generation/progress";

const TICK_MS = 500;

export function useEstimatedProgress(): number {
  const [startedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setElapsed(Date.now() - startedAt), TICK_MS);
    return () => clearInterval(timer);
  }, [startedAt]);

  return estimatedProgress(elapsed);
}
