import type {
    RefineTextInput,
    RefineTextResult,
    TextRefinerModel,
} from '@/lib/text-refiner/types';

import { apiClient } from "@/lib/api/browser-client";

export interface RefineTextActionResult {
    result: RefineTextResult | null;
    error: string | null;
    errorCode: string | null;
}

export async function refineTextAction(
    input: RefineTextInput,
): Promise<RefineTextActionResult> {
    const response = await apiClient<RefineTextResult>('/text-refiner/refine', {
        method: 'POST',
        body: JSON.stringify({
            text: input.text,
            instruction: input.instruction,
            kind: input.kind ?? 'generic',
            model: input.model || undefined,
            maxTokens: input.maxTokens,
            temperature: input.temperature,
        }),
    });

    if (response.error) {
        return {
            result: null,
            error: response.error.message,
            errorCode: response.error.code ?? null,
        };
    }

    return {
        result: response.data ?? null,
        error: null,
        errorCode: null,
    };
}

export interface ListTextRefinerModelsResult {
    models: TextRefinerModel[];
    error: string | null;
}

export async function listTextRefinerModelsAction(): Promise<ListTextRefinerModelsResult> {
    const response = await apiClient<TextRefinerModel[] | { data?: TextRefinerModel[] }>(
        '/text-refiner/models',
        { method: 'GET' },
    );

    if (response.error) {
        return { models: [], error: response.error.message };
    }

    const payload = response.data;
    if (Array.isArray(payload)) {
        return { models: payload, error: null };
    }
    if (payload && Array.isArray(payload.data)) {
        return { models: payload.data, error: null };
    }
    return { models: [], error: null };
}
