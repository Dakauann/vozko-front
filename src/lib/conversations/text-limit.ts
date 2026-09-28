export interface TextLimitState {
    count: number;
    limit: number;
    over: boolean;
    near: boolean;
}

const NEAR_RATIO = 0.9;

export function textLimitState(text: string, limit: number | null): TextLimitState | null {
    if (limit === null) return null;
    const count = Array.from(text).length;
    return { count, limit, over: count > limit, near: count >= limit * NEAR_RATIO };
}
