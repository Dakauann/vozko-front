import type { HandleDefinition, WorkflowNode } from "@/lib/workflows/types";

import { FIXTURE_DEFINITIONS, fixtureHandles, fixtureWorkflow } from "./fixture";

const REFUSED = { error: "harness", code: "harness" };

export async function getNodeTypesAction() {
  return { definitions: FIXTURE_DEFINITIONS };
}

export async function getWorkflowAction() {
  return { workflow: fixtureWorkflow() };
}

export async function resolveHandlesAction(nodes: Pick<WorkflowNode, "id" | "type" | "config">[]): Promise<{ handles: Record<string, HandleDefinition[]> }> {
  return { handles: fixtureHandles(nodes.map((node) => ({ ...node, position: { x: 0, y: 0 } }))) };
}

export async function validateGraphAction() {
  return { valid: true, issues: [] };
}

export async function listWorkflowsAction() {
  return { workflows: [], meta: { page: 1, pageSize: 15, totalPages: 1, totalItems: 0 } };
}

export async function listBuilderSessionsAction() {
  return { sessions: [] };
}

export async function getBuilderSessionAction() {
  return null;
}

export async function getWorkflowWebhookAction() {
  return null;
}

export async function getNodeVariablesAction() {
  return { catalog: { variables: [], unreadable: 0 } };
}

function choicePrompt(sends: number, optionIds: string[]) {
  return {
    sends,
    clickedPrompts: Math.round(sends * 0.8),
    clickRate: 8000,
    freeText: { count: Math.round(sends * 0.05), rate: 500 },
    options: optionIds.map((optionId, index) => ({ optionId, shown: sends, clicks: Math.round(sends * (0.1 + index * 0.2)), ctr: 1000 + index * 2000 })),
  };
}

export async function getWorkflowChoiceStatsAction() {
  return {
    status: "ready",
    stats: {
      from: "2026-09-23",
      to: "2026-10-22",
      timezone: "America/Sao_Paulo",
      version: null,
      nodes: new Map([
        ["t3", choicePrompt(1742, ["planos", "horarios", "experimental"])],
        ["t5", choicePrompt(980, ["template_button:0"])],
        ["t6", choicePrompt(640, ["centro", "norte", "sul"])],
      ]),
    },
  };
}

export async function getTriggerLastInputAction() {
  return { lastInput: null, ...REFUSED };
}

export const createWorkflowAction = async () => REFUSED;
export const updateWorkflowAction = async () => REFUSED;
export const assignWorkflowDepartmentAction = async () => REFUSED;
export const deleteWorkflowAction = async () => REFUSED;
export const activateWorkflowAction = async () => REFUSED;
export const pauseWorkflowAction = async () => REFUSED;
export const publishWorkflowAction = async () => ({ workflow: null, failure: { message: "harness" } });
export const listWorkflowVersionsAction = async () => ({ versions: [], meta: { page: 1, pageSize: 20, totalPages: 1, totalItems: 0 } });
export const restoreWorkflowVersionAction = async () => REFUSED;
export const getWorkflowVersionAction = async () => ({ version: null, error: "harness" });
export const pinNodeFromRunAction = async () => ({ workflow: null, error: "harness" });
export const createWorkflowWebhookAction = async () => REFUSED;
export const updateWorkflowWebhookAction = async () => REFUSED;
export const rotateWorkflowWebhookAction = async () => REFUSED;
export const deleteWorkflowWebhookAction = async () => REFUSED;
export const importWorkflowAction = async () => REFUSED;
export const listWorkflowWebhookDeliveriesAction = async () => ({ deliveries: [], meta: { page: 1, pageSize: 15, totalPages: 1, totalItems: 0 } });
export const listWorkflowRunsAction = async () => ({ runs: [], meta: { page: 1, pageSize: 15, totalPages: 1, totalItems: 0 } });
export const listWorkflowAlertsAction = async () => ({ alerts: [] });
export const getWorkflowRunAction = async () => REFUSED;
export const cancelWorkflowRunAction = async () => REFUSED;
export const downloadWorkflowRunAction = async () => ({ error: REFUSED });
export const downloadWorkflowRunsAction = async () => ({ error: REFUSED });
export const analyzeNodeAction = async () => REFUSED;
export const testNodeAction = async () => REFUSED;
