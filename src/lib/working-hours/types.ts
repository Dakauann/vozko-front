/**
 * Horário de funcionamento — o mesmo documento que o backend guarda em
 * `working_hours` (domain/working_hours.Spec).
 *
 * Vale para o workspace inteiro e para cada departamento. Enquanto existe, o
 * resgate da roleta faz duas coisas: não roda fora do horário, e conta o prazo
 * do atendente só nos minutos em que a operação está aberta — quem recebe uma
 * conversa 17:55 continua com os 15 minutos inteiros na manhã seguinte, em vez
 * de perder dez deles durante a noite.
 */

export type WorkingHoursWindow = {
    /** "HH:MM" em 24h. */
    start: string;
    /**
     * "HH:MM" em 24h, exclusivo. Um fim menor ou igual ao início atravessa a
     * meia-noite: 22:00→02:00 é o turno da madrugada, e escrever assim mantém
     * o turno como UMA linha em vez de duas metades em dois dias.
     * "24:00" é aceito como fim do dia, então o dia inteiro é 00:00→24:00.
     */
    end: string;
};

/** Chaves do dia como o backend as grava. */
export type WorkingHoursDay = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

export type WorkingHoursSpec = {
    /** Zona IANA, ex.: "America/Sao_Paulo". */
    timezone: string;
    days: Partial<Record<WorkingHoursDay, WorkingHoursWindow[]>>;
};

/**
 * Ordem de exibição: semana de trabalho primeiro, fim de semana no fim.
 * Diferente da ordem do documento (domingo primeiro), que é irrelevante para
 * quem está editando uma escala.
 */
export const WORKING_HOURS_DAY_ORDER: readonly WorkingHoursDay[] = [
    "mon",
    "tue",
    "wed",
    "thu",
    "fri",
    "sat",
    "sun",
] as const;

export const MINUTES_PER_DAY = 24 * 60;

/** Escala padrão ao ativar o horário pela primeira vez: comercial, seg–sex. */
export function defaultWorkingHours(timezone: string): WorkingHoursSpec {
    const business: WorkingHoursWindow[] = [{ start: "09:00", end: "18:00" }];
    return {
        timezone,
        days: {
            mon: [...business],
            tue: [...business],
            wed: [...business],
            thu: [...business],
            fri: [...business],
        },
    };
}

/** Zona do próprio navegador, com um padrão brasileiro quando não dá para saber. */
export function browserTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";
    } catch {
        return "America/Sao_Paulo";
    }
}

/**
 * Converte "HH:MM" em minutos desde a meia-noite, ou null se não for um horário.
 * Aceita "24:00" só como fim do dia, igual ao backend.
 */
export function parseHHMM(value: string): number | null {
    const parts = value.trim().split(":");
    if (parts.length !== 2) return null;
    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
    if (minutes < 0 || minutes > 59) return null;
    if (hours === 24 && minutes === 0) return MINUTES_PER_DAY;
    if (hours < 0 || hours > 23) return null;
    return hours * 60 + minutes;
}

export function formatHHMM(minutes: number): string {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Códigos de erro — traduzidos na UI, não montados aqui. */
export type WorkingHoursIssue =
    | { kind: "badTime"; day: WorkingHoursDay; index: number }
    | { kind: "emptyWindow"; day: WorkingHoursDay; index: number }
    | { kind: "overlap"; day: WorkingHoursDay; index: number }
    | { kind: "noOpenTime" }
    | { kind: "noTimezone" };

/**
 * As MESMAS regras que o servidor aplica, rodando antes do envio.
 *
 * O backend recusa uma escala inválida em vez de arredondá-la — uma janela que
 * o admin não consegue ver é uma janela que ninguém consegue depurar — então
 * validar aqui é o que transforma um 400 em uma mensagem embaixo do campo
 * errado. Qualquer divergência entre as duas listas aparece como um erro do
 * servidor que a UI jurava não ser possível.
 */
export function validateWorkingHours(spec: WorkingHoursSpec): WorkingHoursIssue[] {
    const issues: WorkingHoursIssue[] = [];

    if (!spec.timezone?.trim()) {
        issues.push({ kind: "noTimezone" });
    }

    let hasOpenTime = false;

    for (const day of WORKING_HOURS_DAY_ORDER) {
        const windows = spec.days[day] ?? [];
        // Intervalos em minutos absolutos, já com a virada de meia-noite
        // resolvida, para que a checagem de sobreposição enxergue o turno real.
        const resolved: Array<{ start: number; end: number; index: number }> = [];

        windows.forEach((window, index) => {
            const start = parseHHMM(window.start);
            const end = parseHHMM(window.end);
            if (start === null || end === null || start >= MINUTES_PER_DAY) {
                issues.push({ kind: "badTime", day, index });
                return;
            }
            if (start === end) {
                // Ambíguo entre "fechado" e "aberto 24h". Quem quer o segundo
                // escreve 00:00–24:00.
                issues.push({ kind: "emptyWindow", day, index });
                return;
            }
            hasOpenTime = true;
            resolved.push({ start, end: end < start ? end + MINUTES_PER_DAY : end, index });
        });

        resolved
            .slice()
            .sort((a, b) => a.start - b.start)
            .forEach((window, i, sorted) => {
                if (i === 0) return;
                if (window.start < sorted[i - 1].end) {
                    issues.push({ kind: "overlap", day, index: window.index });
                }
            });
    }

    if (!hasOpenTime) {
        // Uma semana sem nenhuma janela congelaria todo prazo do escopo, e numa
        // tela de semana vazia é indistinguível de "não configurado".
        issues.push({ kind: "noOpenTime" });
    }

    return issues;
}

/**
 * Resumo da escala para o chip de status do card.
 *
 * Devolve a forma, não a frase: quem traduz é a UI. Assim o resumo não precisa
 * de um `useTranslations` aqui dentro e continua testável sem i18n.
 */
export type WorkingHoursSummary =
    | { kind: "alwaysOpen" }
    | { kind: "everyDay"; start: string; end: string }
    | { kind: "weekdays"; start: string; end: string }
    | { kind: "custom"; openDays: number };

const WEEKDAYS: readonly WorkingHoursDay[] = ["mon", "tue", "wed", "thu", "fri"];
const WEEKEND: readonly WorkingHoursDay[] = ["sat", "sun"];

export function summarizeWorkingHours(
    spec: WorkingHoursSpec | null | undefined,
): WorkingHoursSummary {
    if (!spec) return { kind: "alwaysOpen" };

    const openDays = WORKING_HOURS_DAY_ORDER.filter(
        (day) => (spec.days[day] ?? []).length > 0,
    );
    if (openDays.length === 0) return { kind: "custom", openDays: 0 };

    // Só vira um resumo curto quando TODOS os dias abertos têm exatamente uma
    // faixa e ela é a mesma. Qualquer coisa além disso é "personalizada", em vez
    // de um resumo que esconde a diferença que o operador precisa ver.
    const single = openDays.every((day) => (spec.days[day] ?? []).length === 1);
    if (!single) return { kind: "custom", openDays: openDays.length };

    const first = spec.days[openDays[0]]![0];
    const uniform = openDays.every((day) => {
        const w = spec.days[day]![0];
        return w.start === first.start && w.end === first.end;
    });
    if (!uniform) return { kind: "custom", openDays: openDays.length };

    const isEveryDay = openDays.length === 7;
    const isWeekdaysOnly =
        openDays.length === WEEKDAYS.length &&
        WEEKDAYS.every((day) => openDays.includes(day)) &&
        WEEKEND.every((day) => !openDays.includes(day));

    if (isEveryDay) return { kind: "everyDay", start: first.start, end: first.end };
    if (isWeekdaysOnly) return { kind: "weekdays", start: first.start, end: first.end };
    return { kind: "custom", openDays: openDays.length };
}

/** Dias úteis, para a ação "aplicar a todos os dias úteis" do editor. */
export const WORKING_HOURS_WEEKDAYS = WEEKDAYS;

/** Zonas oferecidas na seleção. Brasil primeiro, porque é onde a operação está. */
export const WORKING_HOURS_TIMEZONES: readonly string[] = [
    "America/Sao_Paulo",
    "America/Bahia",
    "America/Fortaleza",
    "America/Recife",
    "America/Belem",
    "America/Manaus",
    "America/Cuiaba",
    "America/Campo_Grande",
    "America/Porto_Velho",
    "America/Rio_Branco",
    "America/Noronha",
    "America/Argentina/Buenos_Aires",
    "America/Montevideo",
    "America/Santiago",
    "America/Bogota",
    "America/Lima",
    "America/Mexico_City",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Europe/Lisbon",
    "Europe/Madrid",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Africa/Luanda",
    "Africa/Maputo",
    "Asia/Dubai",
    "Asia/Tokyo",
    "Australia/Sydney",
    "UTC",
] as const;
