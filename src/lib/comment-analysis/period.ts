/**
 * The period every comment-analysis panel obeys.
 *
 * One vocabulary, in one place, because the alternative is what the tab had
 * before: a 7/30/90 pill that moved the stats cards while the ranking and the
 * feed underneath it silently kept showing all time. A number on screen and the
 * table below it must be answering the same question.
 *
 * `all` is not a formality. The ranking has two implementations on the server:
 * without a window it reads an indexed lifetime projection, with one it
 * regroups the comments themselves. `all` is how a reader asks for the cheap
 * one, and it stays the default for the authors table.
 */

export type PeriodPreset = 'today' | '7' | '30' | '90' | 'all' | 'custom';

export interface Period {
    preset: PeriodPreset;
    /** ISO date (YYYY-MM-DD), only for `custom`. */
    from?: string;
    to?: string;
}

/** The presets a picker offers, in order. */
export const PERIOD_PRESETS: PeriodPreset[] = ['today', '7', '30', '90', 'all', 'custom'];

export const DEFAULT_PERIOD: Period = { preset: '30' };

/** The authors ranking opens on all time, which is also its fast path. */
export const DEFAULT_AUTHORS_PERIOD: Period = { preset: 'all' };

function startOfLocalDay(daysAgo = 0): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - daysAgo);
    return d;
}

/**
 * Resolves a period to the `from`/`to` the API takes, as instants.
 *
 * Boundaries are local midnight rather than UTC midnight: someone in São Paulo
 * asking for "hoje" means their day, and answering with a window that started
 * at 21:00 yesterday would put yesterday evening's comments in today's numbers.
 * The instants are sent as ISO, so the server still compares in UTC.
 *
 * `to` is EXCLUSIVE on the server, so a custom range ending on the 30th
 * includes all of the 30th by moving the end to the start of the 31st.
 */
export function periodRange(period: Period): { from?: string; to?: string } {
    switch (period.preset) {
        case 'all':
            return {};
        case 'today':
            return { from: startOfLocalDay(0).toISOString() };
        case '7':
        case '30':
        case '90':
            return { from: startOfLocalDay(Number(period.preset)).toISOString() };
        case 'custom': {
            const range: { from?: string; to?: string } = {};
            if (period.from) {
                const from = new Date(`${period.from}T00:00:00`);
                if (!Number.isNaN(from.valueOf())) range.from = from.toISOString();
            }
            if (period.to) {
                const to = new Date(`${period.to}T00:00:00`);
                if (!Number.isNaN(to.valueOf())) {
                    to.setDate(to.getDate() + 1);
                    range.to = to.toISOString();
                }
            }
            return range;
        }
    }
}

/**
 * Whether a custom period is usable yet. A half-typed range would otherwise
 * reload every panel on each keystroke, and an inverted one is refused by the
 * API with an error the reader cannot act on.
 */
export function isPeriodReady(period: Period): boolean {
    if (period.preset !== 'custom') return true;
    if (!period.from || !period.to) return false;
    return period.from <= period.to;
}
