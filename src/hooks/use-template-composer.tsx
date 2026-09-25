"use client";

import { exchangeRateFromMicros, formatMicrosAsBrl } from "@/lib/pricing/currency";
import {
    isTemplateSendable,
    renderTemplateText,
    templateParamSlots,
    templateSummary,
    templateUsability,
} from "@/lib/whatsapp-templates/params";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { SendQuote } from "@/lib/whatsapp-outreach/types";
import type { TemplateMessageMetadata } from "@/lib/conversations/types";
import type { WhatsAppTemplate } from "@/lib/whatsapp-templates/types";
import { getExchangeRateAction } from "@/app/actions/pricing";
import { listWhatsAppTemplatesAction } from "@/app/actions/whatsapp-templates";
import { quoteTemplateSendAction } from "@/app/actions/whatsapp-outreach";
import { useTranslations } from "next-intl";

export interface TemplateComposerInitial {
    templateId: string;
    bodyParams?: string[];
    headerParams?: string[];
}

interface Selection {
    phoneId: string;
    templateId: string;
}

interface Values {
    templateId: string;
    body: string[];
    header: string[];
}

interface Loaded<T> {
    key: string;
    value: T;
}

interface LoadedTemplates {
    phoneId: string;
    version: number;
    value: WhatsAppTemplate[];
}

function blank(count: number): string[] {
    return new Array(count).fill("");
}

export function useTemplateComposer({
    businessPhoneId,
    enabled,
    initial,
}: {
    businessPhoneId: string;
    enabled: boolean;
    initial?: TemplateComposerInitial;
}) {
    const t = useTranslations("whatsappOutreach");
    const tTemplates = useTranslations("whatsappTemplates");

    const [selection, setSelection] = useState<Selection>(() => ({
        phoneId: businessPhoneId,
        templateId: initial?.templateId ?? "",
    }));
    const [values, setValues] = useState<Values>(() => ({
        templateId: initial?.templateId ?? "",
        body: initial?.bodyParams ?? [],
        header: initial?.headerParams ?? [],
    }));
    const [templates, setTemplates] = useState<LoadedTemplates | null>(null);
    const [version, setVersion] = useState(0);
    const [quote, setQuote] = useState<Loaded<SendQuote | null> | null>(null);
    const [exchangeRate, setExchangeRate] = useState<number | null>(null);

    const templateId = selection.phoneId === businessPhoneId ? selection.templateId : "";

    useEffect(() => {
        if (!enabled || !businessPhoneId) return;
        let cancelled = false;
        listWhatsAppTemplatesAction({ businessPhoneId, pageSize: 100 }).then((result) => {
            if (!cancelled) setTemplates({ phoneId: businessPhoneId, version, value: result.templates ?? [] });
        });
        return () => {
            cancelled = true;
        };
    }, [enabled, businessPhoneId, version]);

    useEffect(() => {
        if (!enabled) return;
        getExchangeRateAction().then((rate) => {
            setExchangeRate(exchangeRateFromMicros(rate.item?.priceMicros));
        });
    }, [enabled]);

    const quoteKey = templateId && businessPhoneId ? `${templateId}|${businessPhoneId}` : "";

    useEffect(() => {
        if (!enabled || !quoteKey) return;
        let cancelled = false;
        quoteTemplateSendAction(templateId, businessPhoneId).then((result) => {
            if (!cancelled) setQuote({ key: quoteKey, value: result.quote });
        });
        return () => {
            cancelled = true;
        };
    }, [enabled, quoteKey, templateId, businessPhoneId]);

    const list = useMemo(
        () => (templates?.phoneId === businessPhoneId ? templates.value : []),
        [templates, businessPhoneId],
    );
    const templatesLoading =
        enabled &&
        Boolean(businessPhoneId) &&
        (templates?.phoneId !== businessPhoneId || templates.version !== version);

    const template = useMemo(
        () => list.find((candidate) => candidate.id === templateId) ?? null,
        [list, templateId],
    );
    const slots = useMemo(() => templateParamSlots(template), [template]);

    const bodyValues = values.templateId === templateId ? values.body : blank(slots.body.length);
    const headerValues = values.templateId === templateId ? values.header : blank(slots.header.length);

    const readyTemplates = useMemo(() => list.filter(isTemplateSendable), [list]);

    const missingValues =
        slots.body.some((_, i) => !bodyValues[i]?.trim()) ||
        slots.header.some((_, i) => !headerValues[i]?.trim());

    const selectTemplate = useCallback(
        (next: string) => setSelection({ phoneId: businessPhoneId, templateId: next }),
        [businessPhoneId],
    );

    const setValue = useCallback(
        (part: "body" | "header", index: number, value: string) => {
            setValues((current) => {
                const base =
                    current.templateId === templateId
                        ? current
                        : { templateId, body: blank(slots.body.length), header: blank(slots.header.length) };
                const nextPart = [...base[part]];
                nextPart[index] = value;
                return { ...base, [part]: nextPart };
            });
        },
        [templateId, slots.body.length, slots.header.length],
    );

    const reload = useCallback(() => setVersion((current) => current + 1), []);

    const upsertTemplate = useCallback((next: WhatsAppTemplate) => {
        setTemplates((current) =>
            current && {
                ...current,
                value: [next, ...current.value.filter((candidate) => candidate.id !== next.id)],
            },
        );
    }, []);

    const reset = useCallback(() => {
        setSelection((current) => ({ ...current, templateId: "" }));
        setValues({ templateId: "", body: [], header: [] });
    }, []);

    const previewMetadata: TemplateMessageMetadata | null = useMemo(() => {
        if (!template) return null;
        const filled = (template.components ?? []).map((component) => {
            const type = component.type?.toUpperCase();
            if (type === "BODY") {
                return { ...component, text: renderTemplateText(component.text, bodyValues, slots.body) };
            }
            if (type === "HEADER" && component.format?.toUpperCase() === "TEXT") {
                return { ...component, text: renderTemplateText(component.text, headerValues, slots.header) };
            }
            return component;
        });
        return {
            template_name: template.name,
            language: template.language,
            category: template.category,
            components: filled as TemplateMessageMetadata["components"],
            header_media_url: template.headerMediaUrl ?? undefined,
        };
    }, [template, bodyValues, headerValues, slots]);

    const templateOptions = useMemo(
        () =>
            list.map((candidate) => {
                const usability = templateUsability(candidate);
                return {
                    value: candidate.id,
                    label: candidate.name,
                    description: templateSummary(candidate),
                    disabled: usability !== "ready",
                    meta: (
                        <span className="readout text-[11px] text-muted-foreground">
                            {usability === "ready"
                                ? tTemplates(`category.${candidate.category.toLowerCase()}`)
                                : t(`usability.${usability}`)}
                        </span>
                    ),
                };
            }),
        [list, t, tTemplates],
    );

    const currentQuote = quote?.key === quoteKey ? quote.value : null;

    return {
        templates: list,
        templatesLoading,
        readyTemplates,
        pendingCount: list.length - readyTemplates.length,
        templateOptions,
        templateId,
        template,
        selectTemplate,
        slots,
        bodyValues,
        headerValues,
        setBodyValue: (index: number, value: string) => setValue("body", index, value),
        setHeaderValue: (index: number, value: string) => setValue("header", index, value),
        missingValues,
        previewMetadata,
        quote: currentQuote,
        priceLabel: formatMicrosAsBrl(currentQuote?.priceMicros, exchangeRate),
        reload,
        upsertTemplate,
        reset,
    };
}

export type TemplateComposer = ReturnType<typeof useTemplateComposer>;
