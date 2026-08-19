import type { TemplateComponent, WhatsAppTemplate } from "./types";

/**
 * Template variables, read the way the server reads them.
 *
 * Shared rather than inlined because the placeholders an operator is asked to
 * fill must match the ones the server will substitute. Every divergence here is
 * a message that reaches a customer with a literal `{{1}}` in it, and the
 * operator saw a form that looked complete.
 *
 * Body and header variables are kept apart on purpose: Meta addresses them as
 * different components, and merging them is how a header value ends up in a
 * body sentence.
 */

const PLACEHOLDER = /\{\{([^}]+)\}\}/g;

/** Placeholders in one string, in order, duplicates preserved. */
export function extractPlaceholders(text: string | undefined | null): string[] {
    if (!text) return [];
    const found: string[] = [];
    for (const match of text.matchAll(PLACEHOLDER)) {
        found.push(match[1].trim());
    }
    return found;
}

export interface TemplateParamSlots {
    /** Body variables, in the order they appear. */
    body: string[];
    /** TEXT-header variables. A media header has none. */
    header: string[];
    /** True when the template names its variables rather than numbering them. */
    named: boolean;
}

function componentsOf(template: Pick<WhatsAppTemplate, "components"> | null | undefined): TemplateComponent[] {
    return template?.components ?? [];
}

/**
 * Every slot an operator has to fill before this template can be sent.
 *
 * Component type is compared case-insensitively — templates synced from Meta
 * have been observed with lowercase types, and a case-sensitive read silently
 * reports zero variables for a template that has several, producing a send with
 * empty placeholders.
 */
export function templateParamSlots(
    template: Pick<WhatsAppTemplate, "components" | "parameterFormat"> | null | undefined,
): TemplateParamSlots {
    const components = componentsOf(template);

    const body = components.find((c) => c.type?.toUpperCase() === "BODY");
    const header = components.find((c) => c.type?.toUpperCase() === "HEADER");

    const bodySlots = extractPlaceholders(body?.text);
    const headerSlots =
        header?.format?.toUpperCase() === "TEXT" ? extractPlaceholders(header?.text) : [];

    // The stored format wins when it is set; otherwise a purely numeric first
    // placeholder is the only reliable signal.
    const named =
        template?.parameterFormat === "named" ||
        (template?.parameterFormat !== "positional" &&
            [...bodySlots, ...headerSlots].some((slot) => !/^\d+$/.test(slot)));

    return { body: bodySlots, header: headerSlots, named };
}

/** Whether the template carries a header that needs an uploaded file. */
export function hasMediaHeader(template: Pick<WhatsAppTemplate, "components"> | null | undefined): boolean {
    const header = componentsOf(template).find((c) => c.type?.toUpperCase() === "HEADER");
    const format = header?.format?.toUpperCase();
    return format === "IMAGE" || format === "VIDEO" || format === "DOCUMENT";
}

/**
 * Substitutes values into a template string for PREVIEW.
 *
 * Accepts both placeholder styles for every value, because a template's declared
 * format and the one its body actually uses have been observed to disagree, and
 * showing the operator a raw `{{1}}` in the preview when the real message will
 * render fine is its own kind of lie.
 *
 * Uses replaceAll, so a placeholder repeated in one sentence is filled every
 * time it appears rather than only the first.
 */
export function renderTemplateText(
    text: string | undefined | null,
    values: string[],
    slots: string[],
    fallback?: (slot: string, index: number) => string,
): string {
    if (!text) return "";
    let rendered = text;
    slots.forEach((slot, index) => {
        const value = values[index]?.trim() || fallback?.(slot, index) || `{{${slot}}}`;
        rendered = rendered.replaceAll(`{{${index + 1}}}`, value).replaceAll(`{{${slot}}}`, value);
    });
    return rendered;
}

/** The template's body text, unrendered. */
export function templateBodyText(template: Pick<WhatsAppTemplate, "components"> | null | undefined): string {
    return componentsOf(template).find((c) => c.type?.toUpperCase() === "BODY")?.text ?? "";
}

/** A one-line summary for a picker row: the body with its variables shown as names. */
export function templateSummary(
    template: Pick<WhatsAppTemplate, "components" | "parameterFormat"> | null | undefined,
    maxLength = 90,
): string {
    const body = templateBodyText(template).replace(/\s+/g, " ").trim();
    if (body.length <= maxLength) return body;
    return `${body.slice(0, maxLength - 1)}…`;
}

/**
 * Whether this template can actually be sent right now.
 *
 * The server sends `usabilityStatus`, and that value wins. This derives the same
 * answer locally as a fallback, because a picker that reads a missing field as
 * "not usable" disables every option and leaves the operator staring at a list of
 * approved templates it refuses to let them choose — indistinguishable, from
 * where they sit, from a broken feature.
 *
 * The rule mirrors the server's: approved, and any media header actually has its
 * file uploaded.
 */
export function templateUsability(
    template: Pick<WhatsAppTemplate, "status" | "components" | "headerMediaId" | "usabilityStatus"> | null | undefined,
): "ready" | "not_approved" | "missing_header_media" {
    if (!template) return "not_approved";
    if (template.usabilityStatus) return template.usabilityStatus;
    if (template.status !== "APPROVED") return "not_approved";
    if (hasMediaHeader(template) && !template.headerMediaId) return "missing_header_media";
    return "ready";
}

export function isTemplateSendable(
    template: Pick<WhatsAppTemplate, "status" | "components" | "headerMediaId" | "usabilityStatus"> | null | undefined,
): boolean {
    return templateUsability(template) === "ready";
}
