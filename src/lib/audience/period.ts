
export type PeriodPreset = 'today' | '7' | '30' | '90' | 'all' | 'custom';

export interface Period {
    preset: PeriodPreset;
    from?: string;
    to?: string;
}

export const PERIOD_PRESETS: PeriodPreset[] = ['today', '7', '30', '90', 'all', 'custom'];

export const DEFAULT_PERIOD: Period = { preset: '30' };

export const DEFAULT_AUTHORS_PERIOD: Period = { preset: 'all' };

function startOfLocalDay(daysAgo = 0): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - daysAgo);
    return d;
}

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

export function isPeriodReady(period: Period): boolean {
    if (period.preset !== 'custom') return true;
    if (!period.from || !period.to) return false;
    return period.from <= period.to;
}
