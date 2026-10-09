export const VECTOR_TOOLS = ["select", "pen", "draw"] as const;

export type VectorTool = (typeof VECTOR_TOOLS)[number];

export const VECTOR_TOOL_KEYS: Record<VectorTool, string> = { select: "V", pen: "P", draw: "B" };
