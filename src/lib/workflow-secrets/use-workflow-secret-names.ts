"use client";

import { useEffect, useState } from "react";

import { listWorkflowSecretsAction } from "@/app/actions/workflow-secrets";

export interface WorkflowSecretNames {
  names: string[];
  loading: boolean;
  failed: boolean;
}

export function useWorkflowSecretNames(): WorkflowSecretNames {
  const [state, setState] = useState<WorkflowSecretNames>({ names: [], loading: true, failed: false });
  useEffect(() => {
    let live = true;
    void listWorkflowSecretsAction().then((res) => {
      if (!live) return;
      setState({ names: res.secrets.map((secret) => secret.name).sort(), loading: false, failed: Boolean(res.error) });
    });
    return () => {
      live = false;
    };
  }, []);
  return state;
}
