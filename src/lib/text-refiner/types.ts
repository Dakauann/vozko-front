export type TextRefinerDiffOp = "equal" | "insert" | "delete";

export interface TextRefinerDiffSegment {
    op: TextRefinerDiffOp;
    text: string;
}

export interface TextRefinerModel {
    id: string;
    name: string;
    promptPrice: number;
    completionPrice: number;
}

export type TextRefinerKind =
    | "generic"
    | "messaging_prompt"
    | "initial_message";

export interface RefineTextInput {
    text: string;
    instruction: string;
    kind?: TextRefinerKind;
    model?: string;
    maxTokens?: number;
    temperature?: number;
}

export interface RefineTextResult {
    requestId: string;
    model: string;
    originalText: string;
    refinedText: string;
    segments: TextRefinerDiffSegment[];
    unifiedDiff: string;
    promptTokens: number;
    completionTokens: number;
    estimatedPriceMicros: number;
    actualPriceMicros: number;
}
