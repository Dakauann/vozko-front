"use client";

import { useCallback, useEffect, useState } from "react";

import { listWorkflowAlertsAction } from "@/app/actions/workflows";
import type { RuntimeAlert } from "@/lib/workflows/types";

interface RuntimeAlertsRead {
  workflowId: string;
  alerts: RuntimeAlert[];
  failed: boolean;
}

const NO_RUNTIME_ALERTS: RuntimeAlert[] = [];

export function useRuntimeAlerts(savedWorkflowId: string | null) {
  const [alertsReload, setAlertsReload] = useState(0);
  const [runtimeAlertsRead, setRuntimeAlertsRead] = useState<RuntimeAlertsRead | null>(null);

  useEffect(() => {
    if (!savedWorkflowId) return;
    let current = true;
    void listWorkflowAlertsAction(savedWorkflowId).then((res) => {
      if (!current) return;
      setRuntimeAlertsRead((prev) => ({
        workflowId: savedWorkflowId,
        alerts: res.error ? (prev?.workflowId === savedWorkflowId ? prev.alerts : []) : res.alerts,
        failed: Boolean(res.error),
      }));
    });
    return () => {
      current = false;
    };
  }, [savedWorkflowId, alertsReload]);

  const shown = runtimeAlertsRead?.workflowId === savedWorkflowId ? runtimeAlertsRead : null;
  const reload = useCallback(() => setAlertsReload((n) => n + 1), []);

  return { alerts: shown?.alerts ?? NO_RUNTIME_ALERTS, failed: shown?.failed ?? false, reload };
}
