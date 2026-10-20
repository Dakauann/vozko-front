import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiClient } = vi.hoisted(() => ({
  apiClient: vi.fn(),
}));

vi.mock("@/lib/api/browser-client", () => ({ apiClient }));

import {
  deleteWorkflowSecretAction,
  listWorkflowSecretsAction,
  putWorkflowSecretAction,
} from "@/app/actions/workflow-secrets";

describe("workflow secret actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists names with camel case fields and never asks for values", async () => {
    apiClient.mockResolvedValue({
      data: { secrets: [{ name: "api_key", updated_at: "2026-10-19T12:00:00Z", updated_by: "u-1" }] },
    });

    await expect(listWorkflowSecretsAction()).resolves.toEqual({
      secrets: [{ name: "api_key", updatedAt: "2026-10-19T12:00:00Z", updatedBy: "u-1" }],
    });
    expect(apiClient).toHaveBeenCalledWith("/workflow-secrets", { method: "GET" });
  });

  it("reads a missing list as empty so the table shows its empty state", async () => {
    apiClient.mockResolvedValue({ data: {} });

    await expect(listWorkflowSecretsAction()).resolves.toEqual({ secrets: [] });
  });

  it("propagates the backend message when listing fails", async () => {
    apiClient.mockResolvedValue({ error: { message: "Sem permissão", status: 403 } });

    await expect(listWorkflowSecretsAction()).resolves.toEqual({ secrets: [], error: "Sem permissão", status: 403 });
  });

  it("puts the value under the encoded name and returns the summary only", async () => {
    apiClient.mockResolvedValue({
      data: { name: "senha", updated_at: "2026-10-19T12:00:00Z", updated_by: "u-1" },
    });

    await expect(putWorkflowSecretAction("senha", "p4ss")).resolves.toEqual({
      secret: { name: "senha", updatedAt: "2026-10-19T12:00:00Z", updatedBy: "u-1" },
    });
    expect(apiClient).toHaveBeenCalledWith("/workflow-secrets/senha", {
      method: "PUT",
      body: JSON.stringify({ value: "p4ss" }),
    });
  });

  it("returns the error code of a refused put so the dialog can point at the field", async () => {
    apiClient.mockResolvedValue({ error: { message: "O valor tem no máximo 8 KB", status: 400, code: "value_too_long" } });

    await expect(putWorkflowSecretAction("senha", "x")).resolves.toEqual({
      secret: null,
      error: "O valor tem no máximo 8 KB",
      code: "value_too_long",
      status: 400,
    });
  });

  it("deletes by encoded name", async () => {
    apiClient.mockResolvedValue({});

    await expect(deleteWorkflowSecretAction("senha")).resolves.toEqual({});
    expect(apiClient).toHaveBeenCalledWith("/workflow-secrets/senha", { method: "DELETE" });
  });

  it("propagates a delete error", async () => {
    apiClient.mockResolvedValue({ error: { message: "Segredo não encontrado", status: 404, code: "not_found" } });

    await expect(deleteWorkflowSecretAction("senha")).resolves.toEqual({ error: "Segredo não encontrado", code: "not_found", status: 404 });
  });
});
