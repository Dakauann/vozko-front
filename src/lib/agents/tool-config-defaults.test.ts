// @vitest-environment node

import { describe, expect, it } from "vitest";

import type { AgentToolDefinition } from "./types";
import {
  buildInitialToolConfig,
  buildToolDefaultConfig,
} from "./tool-config-defaults";

const tool = {
  configSchema: {
    timezone: {
      type: "string",
      description: "Default timezone",
      displayName: "Fuso horário padrão",
      defaultValue: "America/Sao_Paulo",
      required: true,
    },
    duration: {
      type: "number",
      description: "Default duration",
      displayName: "Duração padrão da reunião",
      defaultValue: 30,
      required: true,
    },
    create_google_meet: {
      type: "boolean",
      description: "Create Google Meet link",
      displayName: "Criar link do Google Meet",
      defaultValue: true,
      required: true,
    },
    headers: {
      type: "object",
      description: "Static headers",
      displayName: "Cabeçalhos fixos",
      defaultValue: { Accept: "application/json" },
      required: false,
    },
  },
} satisfies Pick<AgentToolDefinition, "configSchema">;

describe("tool config defaults", () => {
  it("builds initial config from backend defaults", () => {
    expect(buildToolDefaultConfig(tool)).toEqual({
      timezone: "America/Sao_Paulo",
      duration: 30,
      create_google_meet: true,
      headers: { Accept: "application/json" },
    });
  });

  it("lets existing agent config override schema defaults", () => {
    expect(
      buildInitialToolConfig(tool, {
        duration: 45,
        create_google_meet: false,
      }),
    ).toMatchObject({
      timezone: "America/Sao_Paulo",
      duration: 45,
      create_google_meet: false,
    });
  });

  it("clones object defaults so form edits cannot mutate the schema", () => {
    const first = buildToolDefaultConfig(tool);
    const second = buildToolDefaultConfig(tool);

    (first.headers as Record<string, string>).Accept = "text/plain";

    expect(second.headers).toEqual({ Accept: "application/json" });
  });
});