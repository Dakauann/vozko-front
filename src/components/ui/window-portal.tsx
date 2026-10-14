"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { HostDocumentProvider } from "@/contexts/host-document-context";
import { setWindowTitle } from "@/lib/picture-in-picture";

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
    setWindowTitle(target, title);
  }, [target, title]);

  return createPortal(
    <HostDocumentProvider document={target.document}>
      {children}
    </HostDocumentProvider>,
    target.document.body,
  );
}
