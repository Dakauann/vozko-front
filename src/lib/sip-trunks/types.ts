
export type TrunkType = 'mobile' | 'fixed';

export type TransportType = 'udp' | 'tcp' | 'tls';

export type RegistrationStatus =
    | 'pending'
    | 'registering'
    | 'registered'
    | 'failed'
    | 'unregistered';


export type CodecID = 'opus' | 'g722' | 'pcmu' | 'pcma' | 'telephone-event';

/**
 * A codec the backend actually supports offering on a trunk. Fetched from
 * GET /sip-trunks/codecs so the UI never drifts from the media plane's
 * capabilities. `recommended` highlights the suggested choice; `default` marks
 * codecs that make up the system's default offer when none are selected.
 */
export interface SupportedCodec {
    id: CodecID;
    label: string;
    description: string;
    recommended?: boolean;
    default?: boolean;
}

export type SRTPMode = 'disabled' | 'optional' | 'required';

export type PublicAddressMode = 'auto' | 'stun' | 'manual';

export type NumberFormat = 'passthrough' | 'e164' | 'national' | 'local';

export type SessionRefresher = '' | 'uac' | 'uas';

export interface AdvancedTrunkConfig {
    outboundProxy?: string;
    authUsername?: string;
    userAgent?: string;

    registerEnabled?: boolean;
    registerExpirySeconds?: number;
    registerRetrySeconds?: number;
    sessionTimerEnabled?: boolean;
    sessionTimerSeconds?: number;
    minSESeconds?: number;
    sessionRefresher?: SessionRefresher;

    bindHost?: string;
    bindPort?: number;
    publicAddress?: string;
    publicAddressMode?: PublicAddressMode;
    stunEnabled?: boolean;
    stunServers?: string[];

    codecs?: CodecID[];
    ptimeMs?: number;
    dtmfPayloadType?: number;
    srtpMode?: SRTPMode;

    dialPrefix?: string;
    dialStripDigits?: number;
    numberFormat?: NumberFormat;
    hideCallerId?: boolean;

    ringingTimeoutSeconds?: number;
}

export interface SipTrunk {
    id: string;
    workspaceId?: string;
    name: string;
    description?: string;
    host: string;
    port: number;
    username: string;
    domain?: string;
    transport: TransportType;
    trunkType: TrunkType;
    isRotational: boolean;
    phoneNumber?: string;
    enabled: boolean;
    isGloballyVisible?: boolean;
    ownerAssignedBy?: string;
    ownerAssignedAt?: string;
    registrationStatus: RegistrationStatus;
    lastRegisteredAt?: string;
    lastError?: string;
    createdAt: string;
    updatedAt: string;
    advanced?: AdvancedTrunkConfig;
}

export interface CreateSipTrunkPayload {
    name: string;
    description?: string;
    host: string;
    port?: number;
    username: string;
    password: string;
    domain?: string;
    transport: TransportType;
    trunkType: TrunkType;
    isRotational: boolean;
    phoneNumber?: string;
    advanced?: AdvancedTrunkConfig;
}

export interface UpdateSipTrunkPayload {
    name?: string;
    description?: string;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    domain?: string;
    transport?: TransportType;
    trunkType?: TrunkType;
    isRotational?: boolean;
    phoneNumber?: string;
    advanced?: AdvancedTrunkConfig;
}

export interface AdminUpdateSipTrunkPayload extends UpdateSipTrunkPayload {
    isGloballyVisible?: boolean;
}

export interface AdminCreateSipTrunkPayload extends CreateSipTrunkPayload {
    isGloballyVisible?: boolean;
}

export interface EnableSipTrunkPayload {
    enabled: boolean;
}

export interface SipTrunkStatus {
    trunkId: string;
    status: RegistrationStatus;
    error: string;
    timestamp: string;
}

export interface SipTrunkListMeta {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
}

export interface SipTrunkListResponse {
    items?: SipTrunk[];
    data?: SipTrunk[];
    total?: number;
    page?: number;
    pageSize?: number;
    meta?: SipTrunkListMeta;
}

export interface SipTrunkListParams {
    page?: number;
    pageSize?: number;
}

export interface DeleteSipTrunkResponse {
    message: string;
}
