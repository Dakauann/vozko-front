"use client";

import { useEffect, useState } from "react";

import type { NodeDefinition } from "@/lib/workflows/types";
import { ScreenLoader } from "@/components/brand/screen-loader";
import { WorkflowEditor } from "../_components/workflow-editor";
import { getNodeTypesAction } from "@/app/actions/workflows";

interface PageState {
  loading: boolean;
  error?: string;
  definitions?: NodeDefinition[];
}

function PageLoader() {
  return (
    <div className="-m-6 flex min-h-[calc(100vh_-_var(--dashboard-header-h))] p-6">
      <ScreenLoader fit="fill" />
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
      <div className="-m-6 flex min-h-[calc(100vh_-_var(--dashboard-header-h))] items-center justify-center p-6">
        <div className="rounded-[--radius] border border-destructive bg-destructive px-4 py-3 text-sm text-destructive-foreground">
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
