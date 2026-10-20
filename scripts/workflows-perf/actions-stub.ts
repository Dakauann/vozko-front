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
export const analyzeNodeAction = async () => REFUSED;
export const testNodeAction = async () => REFUSED;
