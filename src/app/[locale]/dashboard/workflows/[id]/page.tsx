"use client";

import {
  getNodeTypesAction,
  getWorkflowAction,
  resolveHandlesAction,
} from "@/app/actions/workflows";
import { use, useEffect, useState } from "react";

import type {
  HandleDefinition,
  NodeDefinition,
  Workflow,
} from "@/lib/workflows/types";

import { WorkflowEditor } from "../_components/workflow-editor";
import { notFound } from "next/navigation";

interface EditWorkflowPageProps {
  params: Promise<{
    id: string;
  }>;
}

interface PageState {
  loading: boolean;
  error?: string;
  notFound?: boolean;
  workflow?: Workflow;
  definitions?: NodeDefinition[];
  initialHandles?: Record<string, HandleDefinition[]>;
}

function PageLoader() {
  return (
    <div className="-m-6 flex min-h-[calc(100vh-3rem)] items-center justify-center p-6">
      <div
        className="h-8 w-8 animate-spin rounded-full border border-muted border-t-primary"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}

export default function EditWorkflowPage({ params }: EditWorkflowPageProps) {
  const { id } = use(params);
  const [state, setState] = useState<PageState>({ loading: true });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true });

    (async () => {
      const [workflowResult, definitionsResult] = await Promise.all([
        getWorkflowAction(id),
        getNodeTypesAction(),
      ]);
      if (cancelled) return;

      if (workflowResult.error || definitionsResult.error) {
        setState({
          loading: false,
          error:
            workflowResult.error ??
            definitionsResult.error ??
            "Workflow not found",
        });
        return;
      }

      if (!workflowResult.workflow) {
        setState({ loading: false, notFound: true });
        return;
      }

      // Resolve output handles up front so dynamic handles (and their edges) are
      // present on first paint, the backend is the source of truth for the handle set.
      const wfNodes = workflowResult.workflow.graph?.nodes ?? [];
      const { handles: initialHandles } = wfNodes.length
        ? await resolveHandlesAction(
            wfNodes.map((n) => ({
              id: n.id,
              type: n.type,
              config: n.config ?? {},
            })),
          )
        : { handles: {} };
      if (cancelled) return;

      setState({
        loading: false,
        workflow: workflowResult.workflow,
        definitions: definitionsResult.definitions,
        initialHandles,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.loading) return <PageLoader />;
  if (state.notFound) notFound();

  if (state.error) {
    return (
      <div className="-m-6 flex min-h-[calc(100vh-3rem)] items-center justify-center p-6">
        <p className="text-muted-foreground">{state.error}</p>
      </div>
    );
  }

  return (
    <div className="-m-6">
      <WorkflowEditor
        workflow={state.workflow!}
        definitions={state.definitions ?? []}
        initialHandles={state.initialHandles ?? {}}
        mode="edit"
      />
    </div>
  );
}
