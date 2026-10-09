import { createElement, lazy, Suspense, type ComponentType } from "react";

type Loaded = ComponentType<Record<string, unknown>> | { default: ComponentType<Record<string, unknown>> };

export default function dynamic(load: () => Promise<Loaded>) {
  const Lazy = lazy(async () => {
    const loaded = await load();
    return { default: typeof loaded === "function" ? loaded : loaded.default };
  });
  return function Dynamic(props: Record<string, unknown>) {
    return createElement(Suspense, { fallback: null }, createElement(Lazy, props));
  };
}
