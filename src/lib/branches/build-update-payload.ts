import type { Branch, BranchCodecID, UpdateBranchPayload } from './types';

interface FormValues {
    displayName?: string;
    codecs?: BranchCodecID[];
    maxContacts: number;
    dnd: boolean;
}

/**
 * Builds a minimal PUT payload by diffing the loaded branch against the edit
 * form, so we only send changed fields (mirrors buildSipTrunkUpdatePayload).
 * SIP user and the secret are not editable here (identity + rotate-secret flow).
 */
export function buildBranchUpdatePayload(original: Branch, current: FormValues): UpdateBranchPayload {
    const payload: UpdateBranchPayload = {};

    if ((current.displayName ?? '') !== (original.displayName ?? '')) {
        payload.displayName = current.displayName ?? '';
    }
    if (current.maxContacts !== original.maxContacts) {
        payload.maxContacts = current.maxContacts;
    }
    if (current.dnd !== original.dnd) {
        payload.dnd = current.dnd;
    }
    if (!codecsEqual(current.codecs, original.codecs)) {
        payload.codecs = current.codecs ?? [];
    }

    return payload;
}

function codecsEqual(a: BranchCodecID[] | undefined, b: BranchCodecID[] | undefined): boolean {
    const x = a ?? [];
    const y = b ?? [];
    if (x.length !== y.length) return false;
    return x.every((v, i) => v === y[i]);
}
