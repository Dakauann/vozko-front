import type {
    CommentContainerOverridePut,
    CommentContainerSettings,
    CommentTopic,
} from '@/lib/audience/types';


export type EnabledChoice = 'inherit' | 'on' | 'off';

export interface OverrideDraft {
    enabled: EnabledChoice;
    model: string;
    threshold: string;
    instructions: string;
    ownTopics: boolean;
    topics: CommentTopic[];
}

export function editableTopics(topics: CommentTopic[]): CommentTopic[] {
    return topics.filter((tp) => tp.key !== 'other');
}

export function cleanTopics(topics: CommentTopic[]): CommentTopic[] {
    return topics
        .filter((tp) => tp.label.trim() !== '')
        .map((tp) => ({ key: tp.key, label: tp.label.trim(), description: tp.description?.trim() }));
}

export function overrideDraftFrom(cs: CommentContainerSettings | null): OverrideDraft {
    const o = cs?.override;
    return {
        enabled: o?.enabled === true ? 'on' : o?.enabled === false ? 'off' : 'inherit',
        model: o?.model ?? '',
        threshold: o?.severityThreshold != null ? String(o.severityThreshold) : '',
        instructions: o?.instructions ?? '',
        ownTopics: !!o?.topics,
        topics: editableTopics(o?.topics ?? cs?.effective.topics ?? []),
    };
}

export function overrideDraftToPut(d: OverrideDraft): CommentContainerOverridePut {
    const threshold = Number.parseInt(d.threshold, 10);
    return {
        enabled: d.enabled === 'inherit' ? null : d.enabled === 'on',
        model: d.model.trim() || null,
        severityThreshold: Number.isFinite(threshold) ? Math.max(1, Math.min(100, threshold)) : null,
        instructions: d.instructions.trim() || null,
        topics: d.ownTopics ? cleanTopics(d.topics) : null,
    };
}
