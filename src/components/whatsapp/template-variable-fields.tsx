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
}: {
    slots: TemplateParamSlots;
    bodyValues: string[];
    headerValues: string[];
    onBodyChange: (index: number, value: string) => void;
    onHeaderChange: (index: number, value: string) => void;
}) {
    const t = useTranslations("whatsappOutreach");

    if (slots.header.length === 0 && slots.body.length === 0) return null;

    return (
        <div className="space-y-3">
            <span className="legend">{t("variablesLabel")}</span>
            {slots.header.map((slot, index) => (
                <ElevatedInput
                    key={`header-${index}`}
                    label={t("headerVariable", { name: slots.named ? slot : String(index + 1) })}
                    value={headerValues[index] ?? ""}
                    onChange={(event) => onHeaderChange(index, event.target.value)}
                    className="w-full"
                />
            ))}
            {slots.body.map((slot, index) => (
                <ElevatedInput
                    key={`body-${index}`}
                    label={slots.named ? slot : t("bodyVariable", { name: String(index + 1) })}
                    value={bodyValues[index] ?? ""}
                    onChange={(event) => onBodyChange(index, event.target.value)}
                    className="w-full"
                />
            ))}
        </div>
    );
}
