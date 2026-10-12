import { MODEL_CAPABILITIES, type ModelCapability } from "./capabilities";

export interface ModelSurface {
  key: string;
  capabilities: readonly ModelCapability[];
  requires: readonly ModelCapability[];
}

export const ELO_SURFACE: ModelSurface = { key: "elo", capabilities: MODEL_CAPABILITIES, requires: ["tools"] };

export const WORKFLOW_BUILDER_SURFACE: ModelSurface = {
  key: "workflow-builder",
  capabilities: MODEL_CAPABILITIES.filter((capability) => capability !== "vision"),
  requires: ["tools"],
};

export const GENERAL_SURFACE: ModelSurface = { key: "general", capabilities: MODEL_CAPABILITIES, requires: [] };
