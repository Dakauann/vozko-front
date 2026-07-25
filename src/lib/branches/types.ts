// Ramais (member SIP extensions). Mirrors the sip-trunks slice; a branch is the
// inverse of a trunk (a device that registers TO Vozko). Backend:
// vozko-go/docs/BRANCH_RAMAL_TRANSFER_PLAN.md.

export type BranchRegistrationStatus =
    | 'never_registered'
    | 'registered'
    | 'expired'
    | 'unreachable';

export type BranchCodecID = 'pcma' | 'pcmu' | 'telephone-event';

export interface Branch {
    id: string;
    workspaceId: string;
    memberId: string;
    userId: string;
    sipUser: string;
    displayName?: string;
    realm: string;
    codecs?: BranchCodecID[];
    maxContacts: number;
    dnd: boolean;
    enabled: boolean;
    registrationStatus: BranchRegistrationStatus;
    lastRegisteredAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateBranchPayload {
    userId: string;
    sipUser: string;
    displayName?: string;
    codecs?: BranchCodecID[];
    maxContacts?: number;
    dnd?: boolean;
}

export interface UpdateBranchPayload {
    displayName?: string;
    codecs?: BranchCodecID[];
    maxContacts?: number;
    dnd?: boolean;
}

export interface EnableBranchPayload {
    enabled: boolean;
}

/**
 * Returned by create and rotate-secret. `secret` is the one-time plaintext SIP
 * password (only its HA1 is stored server-side); it is never returned on reads,
 * so the UI must surface it immediately and warn it will not be shown again.
 */
// BranchConnectionInfo is the full "point your softphone here" set (an Asterisk /
// FreePBX SIP credentials sheet): where to register plus the per-branch identity.
// Returned with the one-time secret on create/rotate, and (without user/codecs) from
// the deployment sip-config endpoint.
export interface BranchConnectionInfo {
    server: string;
    port: number;
    transport: string;
    realm: string;
    sipUser?: string;
    codecs?: string[];
    configured: boolean;
}

export interface BranchSecretResult {
    branch: Branch;
    secret: string;
    realm: string;
    sipUser: string;
    connection: BranchConnectionInfo;
}

export interface BranchListMeta {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
}

export interface BranchListResponse {
    items?: Branch[];
    data?: Branch[];
    total?: number;
    page?: number;
    pageSize?: number;
    meta?: BranchListMeta;
}

export interface BranchListParams {
    page?: number;
    pageSize?: number;
}

export interface DeleteBranchResponse {
    message: string;
}

export const BRANCH_CODECS: ReadonlyArray<{ id: BranchCodecID; label: string; recommended?: boolean }> = [
    { id: 'pcma', label: 'G.711 A-law (PCMA)', recommended: true },
    { id: 'pcmu', label: 'G.711 µ-law (PCMU)' },
];
