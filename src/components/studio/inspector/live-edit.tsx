"use client";

import { createContext, useContext } from "react";

interface LiveEdit {
  start: () => void;
  end: () => void;
}

export const LiveEditContext = createContext<LiveEdit | null>(null);

export function useLiveEdit(): LiveEdit | null {
  return useContext(LiveEditContext);
}
