"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { HostDocumentProvider } from "@/contexts/host-document-context";

export function WindowPortal({
  target,
  title,
  children,
}: {
  target: Window;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    target.document.title = title;
  }, [target, title]);

  return createPortal(
    <HostDocumentProvider document={target.document}>
      {children}
    </HostDocumentProvider>,
    target.document.body,
  );
}
