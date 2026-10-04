export type WidgetStatus = 'active' | 'paused';

export type WidgetPosition = 'right' | 'left';

export type IntakeRule = 'hidden' | 'optional' | 'required';

export type IdentityMode = 'off' | 'optional' | 'required';

export const INTAKE_RULES: readonly IntakeRule[] = ['hidden', 'optional', 'required'];

export const IDENTITY_MODES: readonly IdentityMode[] = ['off', 'optional', 'required'];

export const WIDGET_POSITIONS: readonly WidgetPosition[] = ['right', 'left'];

export const MAX_ALLOWED_ORIGINS = 20;

export const MAX_NAME_LENGTH = 80;

export const MAX_SHORT_TEXT_LENGTH = 60;

export const MAX_WELCOME_MESSAGE_LENGTH = 500;

export const DEFAULT_COUNTRY_CODE = '55';

export const ATTACHMENT_TYPES = ['JPG', 'PNG', 'WEBP', 'GIF', 'PDF'] as const;

export const ATTACHMENT_MAX_MB = 10;

export interface WebchatWidget {
    id: string;
    workspaceId: string;
    departmentId?: string | null;
    name: string;
    publicKey: string;
    status: WidgetStatus;
    allowedOrigins: string[];
    accentColor: string;
    position: WidgetPosition;
    launcherLabel?: string;
    welcomeTitle?: string;
    welcomeMessage?: string;
    teamName?: string;
    assistantName?: string;
    intakeName: IntakeRule;
    intakeEmail: IntakeRule;
    intakePhone: IntakeRule;
    privacyPolicyUrl?: string;
    defaultCountryCode: string;
    allowHumanRequest: boolean;
    allowAttachments: boolean;
    identityMode: IdentityMode;
    agentId?: string | null;
    workflowId?: string | null;
    pipelineId?: string | null;
    enableAgentResponses: boolean;
    enableWorkflow: boolean;
    enableAnalysis: boolean;
    enableAutoStaging: boolean;
    enableAutoMemory: boolean;
    loaderUrl?: string;
    snippet?: string;
    createdAt: string;
    updatedAt: string;
}

export interface WebchatWidgetListMeta {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
}

export interface WebchatWidgetRequest {
    name?: string;
    departmentId?: string | null;
    status?: WidgetStatus;
    allowedOrigins?: string[];
    accentColor?: string;
    position?: WidgetPosition;
    launcherLabel?: string;
    welcomeTitle?: string;
    welcomeMessage?: string;
    teamName?: string;
    assistantName?: string;
    intakeName?: IntakeRule;
    intakeEmail?: IntakeRule;
    intakePhone?: IntakeRule;
    privacyPolicyUrl?: string;
    defaultCountryCode?: string;
    allowHumanRequest?: boolean;
    allowAttachments?: boolean;
    identityMode?: IdentityMode;
    agentId?: string | null;
    workflowId?: string | null;
    pipelineId?: string | null;
    enableAgentResponses?: boolean;
    enableWorkflow?: boolean;
    enableAnalysis?: boolean;
    enableAutoStaging?: boolean;
    enableAutoMemory?: boolean;
}

export type OriginIssue = 'invalid' | 'insecure' | 'duplicate';

export type OriginCheck = { ok: true; origin: string } | { ok: false; issue: Exclude<OriginIssue, 'duplicate'> };

const FORBIDDEN_ORIGIN_CHARACTERS = /[\s;,'"]/;
const WILDCARD_PREFIX = /^([a-z][a-z0-9+.-]*):\/\/\*\.(.*)$/;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

function isLoopbackHost(host: string): boolean {
    if (host === 'localhost' || host.endsWith('.localhost')) return true;
    if (host === '[::1]') return true;
    return IPV4.test(host) && host.startsWith('127.');
}

function isIpHost(host: string): boolean {
    return IPV4.test(host) || host.startsWith('[');
}

export function checkOrigin(raw: string): OriginCheck {
    let candidate = raw.trim().toLowerCase().replace(/\/+$/, '');
    if (candidate === '' || FORBIDDEN_ORIGIN_CHARACTERS.test(candidate)) return { ok: false, issue: 'invalid' };

    const wildcardMatch = WILDCARD_PREFIX.exec(candidate);
    const wildcard = wildcardMatch !== null;
    if (wildcardMatch) candidate = `${wildcardMatch[1]}://${wildcardMatch[2]}`;

    let url: URL;
    try {
        url = new URL(candidate);
    } catch {
        return { ok: false, issue: 'invalid' };
    }

    const scheme = url.protocol.replace(/:$/, '');
    if (scheme !== 'https' && scheme !== 'http') return { ok: false, issue: 'invalid' };
    if (url.username || url.password || url.search || url.hash) return { ok: false, issue: 'invalid' };
    if (url.pathname !== '/' && url.pathname !== '') return { ok: false, issue: 'invalid' };
    if (/[?#]/.test(candidate)) return { ok: false, issue: 'invalid' };

    const host = url.hostname;
    if (host === '' || host.includes('*')) return { ok: false, issue: 'invalid' };
    if (wildcard && (isLoopbackHost(host) || !host.includes('.') || isIpHost(host))) {
        return { ok: false, issue: 'invalid' };
    }
    if (scheme === 'http' && !isLoopbackHost(host)) return { ok: false, issue: 'insecure' };

    const port = url.port ? `:${url.port}` : '';
    return { ok: true, origin: `${scheme}://${wildcard ? '*.' : ''}${host}${port}` };
}

export interface OriginsCheck {
    origins: string[];
    rowIssues: Array<OriginIssue | null>;
    listIssue: 'required' | 'too_many' | null;
    valid: boolean;
}

export function checkOrigins(rows: readonly string[]): OriginsCheck {
    const seen = new Set<string>();
    const origins: string[] = [];
    const rowIssues = rows.map((row): OriginIssue | null => {
        if (row.trim() === '') return null;
        const result = checkOrigin(row);
        if (!result.ok) return result.issue;
        if (seen.has(result.origin)) return 'duplicate';
        seen.add(result.origin);
        origins.push(result.origin);
        return null;
    });
    const listIssue = origins.length === 0 ? 'required' : origins.length > MAX_ALLOWED_ORIGINS ? 'too_many' : null;
    const valid = listIssue === null && rowIssues.every((issue) => issue === null);
    return { origins, rowIssues, listIssue, valid };
}

export function isAccentColor(value: string): boolean {
    return /^#[0-9a-fA-F]{6}$/.test(value);
}

export function isCountryCode(value: string): boolean {
    return /^\d{1,3}$/.test(value);
}

export function isPrivacyPolicyUrl(value: string): boolean {
    if (value.trim() === '') return true;
    try {
        const url = new URL(value.trim());
        return url.protocol === 'https:' && url.hostname !== '' && !url.username && !url.password;
    } catch {
        return false;
    }
}

export const WEBCHAT_ERROR_CODES = [
    'origins_required',
    'origin_invalid',
    'origin_insecure',
    'too_many_origins',
    'name_required',
    'name_too_long',
    'color_invalid',
    'text_too_long',
    'privacy_policy_invalid',
    'country_code_invalid',
    'reference_not_in_workspace',
    'widget_not_found',
    'conversation_not_found',
] as const;

export type WebchatErrorCode = (typeof WEBCHAT_ERROR_CODES)[number];

export function webchatErrorKey(code: string | undefined): string | null {
    if (!code || !(WEBCHAT_ERROR_CODES as readonly string[]).includes(code)) return null;
    return `errors.${code}`;
}

export function originsSummary(origins: readonly string[]): { first: string | null; more: number } {
    return { first: origins[0] ?? null, more: Math.max(0, origins.length - 1) };
}
