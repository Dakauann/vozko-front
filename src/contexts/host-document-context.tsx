"use client";

import {
  createContext,
  useContext,
  type ComponentType,
  type ReactNode,
} from "react";

const HostDocumentContext = createContext<Document | null>(null);

export function HostDocumentProvider({
  document,
  children,
}: {
  document: Document;
  children: ReactNode;
}) {
  return (
    <HostDocumentContext.Provider value={document}>
      {children}
    </HostDocumentContext.Provider>
  );
}

export function usePortalContainer(): HTMLElement | undefined {
  return useContext(HostDocumentContext)?.body;
}

export function useHostWindow(): Window | undefined {
  return useContext(HostDocumentContext)?.defaultView ?? undefined;
}

export function withHostContainer<
  P extends { container?: Element | DocumentFragment | null },
>(Portal: ComponentType<P>) {
  function HostedPortal(props: P) {
    const container = usePortalContainer();
    return <Portal container={container} {...props} />;
  }
  return HostedPortal;
}
