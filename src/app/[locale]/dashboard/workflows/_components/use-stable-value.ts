import { useState } from "react";

export function useStableValue<T>(value: T, same: (prev: T, next: T) => boolean): T {
  const [stable, setStable] = useState(value);
  if (stable === value || same(stable, value)) return stable;
  setStable(value);
  return value;
}
