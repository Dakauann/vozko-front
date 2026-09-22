import type { TemplateComponent, WhatsAppTemplate } from "./types";


const PLACEHOLDER = /\{\{([^}]+)\}\}/g;

export function extractPlaceholders(text: string | undefined | null): string[] {
    if (!text) return [];
    const found: string[] = [];
    for (const match of text.matchAll(PLACEHOLDER)) {
        found.push(match[1].trim());
    }
    return found;
}

export interface TemplateParamSlots {
    body: string[];
    header: string[];
    named: boolean;
}

function componentsOf(template: Pick<WhatsAppTemplate, "components"> | null | undefined): TemplateComponent[] {
    return template?.components ?? [];
}

export function templateParamSlots(
    template: Pick<WhatsAppTemplate, "components" | "parameterFormat" | "category"> | null | undefined,
): TemplateParamSlots {
    const components = componentsOf(template);

    const body = components.find((c) => c.type?.toUpperCase() === "BODY");
    const header = components.find((c) => c.type?.toUpperCase() === "HEADER");

    let bodySlots = extractPlaceholders(body?.text);
    const headerSlots =
        header?.format?.toUpperCase() === "TEXT" ? extractPlaceholders(header?.text) : [];

    if (bodySlots.length === 0 && template?.category === "AUTHENTICATION") {
        bodySlots = ["1"];
    }

    const named =
        template?.parameterFormat === "named" ||
        (template?.parameterFormat !== "positional" &&
            [...bodySlots, ...headerSlots].some((slot) => !/^\d+$/.test(slot)));

    return { body: bodySlots, header: headerSlots, named };
}

export function hasMediaHeader(template: Pick<WhatsAppTemplate, "components"> | null | undefined): boolean {
    const header = componentsOf(template).find((c) => c.type?.toUpperCase() === "HEADER");
    const format = header?.format?.toUpperCase();
    return format === "IMAGE" || format === "VIDEO" || format === "DOCUMENT";
}

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

export function templateBodyText(template: Pick<WhatsAppTemplate, "components"> | null | undefined): string {
    return componentsOf(template).find((c) => c.type?.toUpperCase() === "BODY")?.text ?? "";
}

export function templateSummary(
    template: Pick<WhatsAppTemplate, "components" | "parameterFormat"> | null | undefined,
    maxLength = 90,
): string {
    const body = templateBodyText(template).replace(/\s+/g, " ").trim();
    if (body.length <= maxLength) return body;
    return `${body.slice(0, maxLength - 1)}…`;
}

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
