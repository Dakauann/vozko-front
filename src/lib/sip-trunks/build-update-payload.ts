import type {
    AdvancedTrunkConfig,
    SipTrunk,
    UpdateSipTrunkPayload,
} from "./types";

interface FormValues {
    name: string;
    description?: string;
    host: string;
    port: number;
    username: string;
    password?: string;
    domain?: string;
    transport: string;
    trunkType: string;
    isRotational: boolean;
    phoneNumber?: string;
    advanced?: AdvancedTrunkConfig;
}

export function buildSipTrunkUpdatePayload(
    original: SipTrunk,
    current: FormValues,
): UpdateSipTrunkPayload {
    const payload: UpdateSipTrunkPayload = {};

    if (current.name !== original.name) payload.name = current.name;
    if ((current.description ?? "") !== (original.description ?? ""))
        payload.description = current.description;
    if (current.host !== original.host) payload.host = current.host;
    if (current.port !== original.port) payload.port = current.port;
    if (current.username !== original.username)
        payload.username = current.username;
    if (current.password) payload.password = current.password;
    if ((current.domain ?? "") !== (original.domain ?? ""))
        payload.domain = current.domain;
    if (current.transport !== original.transport)
        payload.transport = current.transport as UpdateSipTrunkPayload["transport"];
    if (current.trunkType !== original.trunkType)
        payload.trunkType =
            current.trunkType as UpdateSipTrunkPayload["trunkType"];
    if (current.isRotational !== original.isRotational)
        payload.isRotational = current.isRotational;
    if ((current.phoneNumber ?? "") !== (original.phoneNumber ?? ""))
        payload.phoneNumber = current.phoneNumber;

    const advancedDiff = diffAdvanced(original.advanced, current.advanced);
    if (advancedDiff) payload.advanced = advancedDiff;

    return payload;
}

function diffAdvanced(
    original: AdvancedTrunkConfig | undefined,
    current: AdvancedTrunkConfig | undefined,
): AdvancedTrunkConfig | undefined {
    if (!current) return undefined;

    const o: AdvancedTrunkConfig = original ?? {};
    const diff: AdvancedTrunkConfig = {};
    let changed = false;

    const keys = Object.keys(current) as (keyof AdvancedTrunkConfig)[];
    for (const key of keys) {
        const cur = current[key];
        const orig = o[key];
        if (cur === undefined) continue;
        if (Array.isArray(cur)) {
            if (!arraysEqual(cur, orig as unknown[] | undefined)) {
                (diff[key] as unknown) = cur;
                changed = true;
            }
            continue;
        }
        if (cur !== orig) {
            (diff[key] as unknown) = cur;
            changed = true;
        }
    }

    return changed ? diff : undefined;
}

function arraysEqual(a: unknown[], b: unknown[] | undefined): boolean {
    if (!b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}
