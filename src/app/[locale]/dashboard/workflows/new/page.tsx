"use client";

import { useEffect, useState } from "react";

import type { NodeDefinition } from "@/lib/workflows/types";
import { WorkflowEditor } from "../_components/workflow-editor";
import { getNodeTypesAction } from "@/app/actions/workflows";

interface PageState {
  loading: boolean;
  error?: string;
  definitions?: NodeDefinition[];
}

function PageLoader() {
  return (
    <div className="-m-6 flex min-h-[calc(100vh-5rem)] items-center justify-center p-6">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}

export default function NewWorkflowPage() {
  const [state, setState] = useState<PageState>({ loading: true });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true });

    getNodeTypesAction().then(({ definitions, error }) => {
      if (cancelled) return;
      if (error) {
        setState({ loading: false, error });
        return;
      }
      setState({ loading: false, definitions });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.loading) return <PageLoader />;

  if (state.error) {
    return (
      <div className="-m-6 flex min-h-[calc(100vh-5rem)] items-center justify-center p-6">
        <div className="rounded-2xl border border-rose-600 bg-rose-500 px-4 py-3 text-sm text-white">
          {state.error}
        </div>
      </div>
    );
  }

  return (
    <div className="-m-6">
      <WorkflowEditor mode="create" definitions={state.definitions ?? []} />
    </div>
  );
}
