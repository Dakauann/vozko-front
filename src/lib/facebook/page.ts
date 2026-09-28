import type { FacebookCapability, FacebookPage, FacebookPageStatus } from '@/lib/facebook/types';

export interface FacebookPageConfig {
    departmentId: string | null;
    agentId: string | null;
    workflowId: string | null;
    pipelineId: string | null;
    enableAgentResponses: boolean;
    enableWorkflow: boolean;
    enableAnalysis: boolean;
    enableAutoStaging: boolean;
    enableAutoMemory: boolean;
    automationDisclosure: string;
}

export function facebookPageConfig(page: FacebookPage): FacebookPageConfig {
    return {
        departmentId: page.departmentId ?? null,
        agentId: page.agentId ?? null,
        workflowId: page.workflowId ?? null,
        pipelineId: page.pipelineId ?? null,
        enableAgentResponses: page.enableAgentResponses,
        enableWorkflow: page.enableWorkflow,
        enableAnalysis: page.enableAnalysis,
        enableAutoStaging: page.enableAutoStaging,
        enableAutoMemory: page.enableAutoMemory,
        automationDisclosure: page.automationDisclosure,
    };
}

export function withPageConfig(page: FacebookPage, patch: Partial<FacebookPageConfig>): FacebookPageConfig {
    return { ...facebookPageConfig(page), ...patch };
}

export type FacebookDisplayStatus = FacebookPageStatus | 'ROUTING_OFF';

export function displayStatus(page: FacebookPage): FacebookDisplayStatus {
    if (page.status === 'CONNECTED' && page.routing.isDefaultApp === false) return 'ROUTING_OFF';
    return page.status;
}

export type FacebookPageNotice =
    | 'reconnect'
    | 'restricted'
    | 'webhook'
    | 'messagingOff'
    | 'routingOff'
    | 'routingUnknown';

export function pageNotices(page: FacebookPage): FacebookPageNotice[] {
    const notices: FacebookPageNotice[] = [];
    if (page.needsReconnect) notices.push('reconnect');
    if (page.status === 'RESTRICTED' || page.policy.action === 'block') notices.push('restricted');
    if (page.status === 'CONNECTED' && !page.webhookSubscribedAt) notices.push('webhook');
    if (page.status === 'CONNECTED' && !page.capabilities.messaging) notices.push('messagingOff');
    if (page.routing.isDefaultApp === false) notices.push('routingOff');
    if (page.routing.isDefaultApp === null || page.routing.isDefaultApp === undefined) notices.push('routingUnknown');
    return notices;
}

export type CapabilityGate =
    | { allowed: true }
    | { allowed: false; reason: 'reconnect' | 'notConnected' | 'missing' };

export function capabilityGate(page: FacebookPage, capability: FacebookCapability): CapabilityGate {
    if (page.needsReconnect) return { allowed: false, reason: 'reconnect' };
    if (page.status !== 'CONNECTED') return { allowed: false, reason: 'notConnected' };
    if (!page.capabilities[capability]) return { allowed: false, reason: 'missing' };
    return { allowed: true };
}
