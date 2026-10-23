"use client";

import ElevatedInput from "@/components/elevated-design/elevated-input";
import type { TemplateParamSlots } from "@/lib/whatsapp-templates/params";
import { useTranslations } from "next-intl";

export function TemplateVariableFields({
    slots,
    bodyValues,
    headerValues,
    onBodyChange,
    onHeaderChange,
    labelOf,
}: {
    slots: TemplateParamSlots;
    bodyValues: string[];
    headerValues: string[];
    onBodyChange: (index: number, value: string) => void;
    onHeaderChange: (index: number, value: string) => void;
    labelOf?: (slot: { name: string; header: boolean }) => string;
}) {
    const t = useTranslations("whatsappOutreach");

    if (slots.header.length === 0 && slots.body.length === 0) return null;

    return (
        <div className="space-y-3">
            <span className="legend">{t("variablesLabel")}</span>
            {slots.header.map((slot, index) => (
                <ElevatedInput
                    key={`header-${index}`}
                    label={labelOf ? labelOf({ name: slots.named ? slot : String(index + 1), header: true }) : t("headerVariable", { name: slots.named ? slot : String(index + 1) })}
                    value={headerValues[index] ?? ""}
                    onChange={(event) => onHeaderChange(index, event.target.value)}
                    className="w-full"
                />
            ))}
            {slots.body.map((slot, index) => (
                <ElevatedInput
                    key={`body-${index}`}
                    label={labelOf ? labelOf({ name: slots.named ? slot : String(index + 1), header: false }) : slots.named ? slot : t("bodyVariable", { name: String(index + 1) })}
                    value={bodyValues[index] ?? ""}
                    onChange={(event) => onBodyChange(index, event.target.value)}
                    className="w-full"
                />
            ))}
        </div>
    );
}
