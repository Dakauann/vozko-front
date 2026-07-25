
import type { ConversationMessage, InboxEntry } from './types';

export function createDebouncedSearch<T extends unknown[]>(
    callback: (...args: T) => void,
    delay: number = 300
): {
    execute: (...args: T) => void;
    cancel: () => void;
} {
    let timeoutId: NodeJS.Timeout | null = null;

    const execute = (...args: T) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            callback(...args);
            timeoutId = null;
        }, delay);
    };

    const cancel = () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
    };

    return { execute, cancel };
}

export function highlightMatches(
    text: string,
    query: string
): Array<{ text: string; isMatch: boolean }> {
    if (!query || query.trim().length === 0) {
        return [{ text, isMatch: false }];
    }

    const normalizedText = text.toLowerCase();
    const normalizedQuery = query.toLowerCase().trim();
    const segments: Array<{ text: string; isMatch: boolean }> = [];

    let lastIndex = 0;
    let index = normalizedText.indexOf(normalizedQuery, lastIndex);

    while (index !== -1) {
        if (index > lastIndex) {
            segments.push({
                text: text.substring(lastIndex, index),
                isMatch: false,
            });
        }

        segments.push({
            text: text.substring(index, index + normalizedQuery.length),
            isMatch: true,
        });

        lastIndex = index + normalizedQuery.length;
        index = normalizedText.indexOf(normalizedQuery, lastIndex);
    }

    if (lastIndex < text.length) {
        segments.push({
            text: text.substring(lastIndex),
            isMatch: false,
        });
    }

    return segments;
}

export function formatSearchResultsCount(
    totalItems: number,
    page: number,
    pageSize: number
): string {
    if (totalItems === 0) {
        return 'No results found';
    }

    const startItem = (page - 1) * pageSize + 1;
    const endItem = Math.min(page * pageSize, totalItems);

    if (totalItems === 1) {
        return '1 result';
    }

    if (totalItems <= pageSize) {
        return `${totalItems} results`;
    }

    return `Showing ${startItem}-${endItem} of ${totalItems}`;
}

export function matchesInboxQuery(entry: InboxEntry, query: string): boolean {
    if (!query || query.trim().length === 0) {
        return true;
    }

    const normalizedQuery = query.toLowerCase().trim();

    if (entry.lead_name?.toLowerCase().includes(normalizedQuery)) {
        return true;
    }

    if (entry.lead_number?.toLowerCase().includes(normalizedQuery)) {
        return true;
    }

    if (entry.last_message_preview?.toLowerCase().includes(normalizedQuery)) {
        return true;
    }

    return false;
}

export function matchesMessageQuery(message: ConversationMessage, query: string): boolean {
    if (!query || query.trim().length === 0) {
        return true;
    }

    const normalizedQuery = query.toLowerCase().trim();

    if (message.text?.toLowerCase().includes(normalizedQuery)) {
        return true;
    }

    if (message.sender_name?.toLowerCase().includes(normalizedQuery)) {
        return true;
    }

    return false;
}

export function filterEntriesByStage(
    entries: InboxEntry[],
    stageId: string | null
): InboxEntry[] {
    return entries.filter(entry => {
        if (stageId === null) {
            return !entry.stage;
        }
        return entry.stage?.stage_id === stageId;
    });
}

export function filterEntriesByUnread(
    entries: InboxEntry[],
    hasUnread?: boolean
): InboxEntry[] {
    if (hasUnread === undefined) {
        return entries;
    }
    return entries.filter(entry => {
        if (hasUnread) {
            return entry.unread_count > 0;
        } else {
            return entry.unread_count === 0;
        }
    });
}

export function filterEntriesByWindow(
    entries: InboxEntry[],
    windowOpen?: boolean
): InboxEntry[] {
    if (windowOpen === undefined) {
        return entries;
    }
    return entries.filter(entry => entry.window_open === windowOpen);
}

export type InboxSortOption =
    | 'recent'
    | 'oldest'
    | 'unread'
    | 'name';

export function sortInboxEntries(
    entries: InboxEntry[],
    sortBy: InboxSortOption
): InboxEntry[] {
    const sorted = [...entries];

    switch (sortBy) {
        case 'recent':
            sorted.sort((a, b) =>
                new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
            );
            break;

        case 'oldest':
            sorted.sort((a, b) =>
                new Date(a.last_message_at).getTime() - new Date(b.last_message_at).getTime()
            );
            break;

        case 'unread':
            sorted.sort((a, b) => {
                if (b.unread_count !== a.unread_count) {
                    return b.unread_count - a.unread_count;
                }
                return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
            });
            break;

        case 'name':
            sorted.sort((a, b) => {
                const nameA = a.lead_name || a.lead_number;
                const nameB = b.lead_name || b.lead_number;
                return nameA.localeCompare(nameB);
            });
            break;
    }

    return sorted;
}

export function getActiveFilterLabels(filters: {
    query?: string;
    stageName?: string;
    messageSearch?: string;
    minMessageCount?: number;
    maxMessageCount?: number;
    windowOpen?: boolean;
    hasUnread?: boolean;
}): string[] {
    const labels: string[] = [];

    if (filters.query) {
        labels.push(`Name/Phone: "${filters.query}"`);
    }

    if (filters.stageName) {
        labels.push(`Stage: ${filters.stageName}`);
    }

    if (filters.messageSearch) {
        labels.push(`Message: "${filters.messageSearch}"`);
    }

    if (filters.minMessageCount !== undefined || filters.maxMessageCount !== undefined) {
        if (filters.minMessageCount !== undefined && filters.maxMessageCount !== undefined) {
            labels.push(`Messages: ${filters.minMessageCount}-${filters.maxMessageCount}`);
        } else if (filters.minMessageCount !== undefined) {
            labels.push(`Messages: ≥${filters.minMessageCount}`);
        } else if (filters.maxMessageCount !== undefined) {
            labels.push(`Messages: ≤${filters.maxMessageCount}`);
        }
    }

    if (filters.windowOpen === true) {
        labels.push('Window: Open');
    } else if (filters.windowOpen === false) {
        labels.push('Window: Closed');
    }

    if (filters.hasUnread === true) {
        labels.push('Has unread messages');
    } else if (filters.hasUnread === false) {
        labels.push('All read');
    }

    return labels;
}

export function validateSearchQuery(
    query: string,
    minLength: number = 2,
    maxLength: number = 100
): string | null {
    const trimmed = query.trim();

    if (trimmed.length === 0) {
        return 'Search query cannot be empty';
    }

    if (trimmed.length < minLength) {
        return `Search query must be at least ${minLength} characters`;
    }

    if (trimmed.length > maxLength) {
        return `Search query must be no more than ${maxLength} characters`;
    }

    return null;
}

export function extractMatchContext(
    text: string,
    query: string,
    contextLength: number = 40
): { before: string; match: string; after: string } | null {
    if (!query || query.trim().length === 0) {
        return null;
    }

    const normalizedText = text.toLowerCase();
    const normalizedQuery = query.toLowerCase().trim();
    const index = normalizedText.indexOf(normalizedQuery);

    if (index === -1) {
        return null;
    }

    const matchEnd = index + normalizedQuery.length;

    const beforeStart = Math.max(0, index - contextLength);
    let before = text.substring(beforeStart, index);
    if (beforeStart > 0) {
        before = '...' + before;
    }

    const match = text.substring(index, matchEnd);

    const afterEnd = Math.min(text.length, matchEnd + contextLength);
    let after = text.substring(matchEnd, afterEnd);
    if (afterEnd < text.length) {
        after = after + '...';
    }

    return { before, match, after };
}
