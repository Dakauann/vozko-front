import type {
    CommentContainerOverridePut,
    CommentContainerSettings,
    CommentTopic,
} from '@/lib/comment-analysis/types';

/**
 * The per-post override editor's draft: what the form holds between the
 * loaded settings and the PUT. Kept out of the component so the two
 * mappings (settings → draft, draft → request) can be tested without React.
 *
 * "Inherit" is the empty value in every field: the "inherit" choice, an empty
 * string, a switched-off "own topics". The request sends `null` for those,
 * which the API reads as "no override on this field".
 */

export type EnabledChoice = 'inherit' | 'on' | 'off';

export interface OverrideDraft {
    enabled: EnabledChoice;
    model: string;
    threshold: string;
    instructions: string;
    ownTopics: boolean;
    topics: CommentTopic[];
}

/** The editable rows: the fixed "other" topic is never shown as editable. */
export function editableTopics(topics: CommentTopic[]): CommentTopic[] {
    return topics.filter((tp) => tp.key !== 'other');
}

/** Drops blank rows and trims; the keys are assigned by the back-end from the label. */
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
        // Own topics start from the effective set, so "make them my own" is
        // an edit of what already applies rather than a blank list.
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
