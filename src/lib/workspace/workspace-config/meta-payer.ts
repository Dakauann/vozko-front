import type { MetaPayer, WorkspaceConfig } from "@/lib/workspace/workspace-config/types";

export const META_PAYERS: readonly MetaPayer[] = ["vozko", "client"];

export function parseMetaPayer(value: unknown): MetaPayer | null {
    return META_PAYERS.includes(value as MetaPayer) ? (value as MetaPayer) : null;
}

export type MetaPayerSaveOutcome =
    | { ok: true; metaPayer: MetaPayer; config: WorkspaceConfig }
    | { ok: false; error: string | null };

export function metaPayerSaveOutcome(
    requested: MetaPayer,
    result: { config: WorkspaceConfig | null; error?: string },
): MetaPayerSaveOutcome {
    if (result.error) return { ok: false, error: result.error };
    const saved = parseMetaPayer(result.config?.metaPayer);
    if (!result.config || saved !== requested) return { ok: false, error: null };
    return { ok: true, metaPayer: saved, config: result.config };
}
