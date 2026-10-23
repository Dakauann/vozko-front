"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";

import { issuesAt, issuesUnder } from "@/lib/rcs/issues";
import { useCarrierErrorText } from "@/components/carrier-messaging/shared/use-carrier-error-text";
import type { RcsContentIssue, RcsMedia, RcsMediaKind } from "@/lib/rcs/types";

import type { VariableTools } from "./variable-tools";

export interface RcsMediaRequest {
  kinds: readonly RcsMediaKind[];
  current?: RcsMedia;
}

export type RcsMediaPicker = (request: RcsMediaRequest) => Promise<RcsMedia | null>;

interface ComposerContextValue {
  issues: readonly RcsContentIssue[];
  variables: VariableTools | null;
  pickMedia?: RcsMediaPicker;
  disabled: boolean;
}

const ComposerContext = createContext<ComposerContextValue>({ issues: [], variables: null, disabled: false });

export function ComposerProvider({ value, children }: { value: ComposerContextValue; children: ReactNode }) {
  return <ComposerContext.Provider value={value}>{children}</ComposerContext.Provider>;
}

export function useComposer(): ComposerContextValue {
  return useContext(ComposerContext);
}

export function useIssueMessages() {
  const errorText = useCarrierErrorText();
  return useCallback((issues: readonly RcsContentIssue[]) => [...new Set(issues.map((issue) => errorText(issue.code)))], [errorText]);
}

export function useFieldIssue() {
  const { issues } = useComposer();
  const messages = useIssueMessages();
  return useCallback(
    (path: string, nested = false) => {
      const found = nested ? issuesUnder(issues, path) : issuesAt(issues, path);
      return found.length > 0 ? messages(found).join(" ") : undefined;
    },
    [issues, messages],
  );
}
