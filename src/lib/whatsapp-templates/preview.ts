import type { DraggableComponent } from "@/components/whatsapp/DragDropBuilder";

import type { TemplateComponent } from "./types";

const SAMPLE_POSITIONAL = ["John", "Smith", "Premium"];
const SAMPLE_NAMED: Record<string, string> = { name: "John", lastname: "Smith", product: "Premium" };

export function fillVariables(text: string, examples: string[] = []): string {
    return text
        .replace(/\{\{(\d+)\}\}/g, (match, index: string) => {
            const position = Number(index) - 1;
            return examples[position]?.trim() || SAMPLE_POSITIONAL[position] || match;
        })
        .replace(/\{\{([a-z_]+)\}\}/gi, (match, name: string) => SAMPLE_NAMED[name.toLowerCase()] ?? match);
}

export function toPreviewComponents(
    components: TemplateComponent[],
    headerMediaUrl?: string | null,
): DraggableComponent[] {
    return components.map((component, index) => {
        const draggable: DraggableComponent = {
            id: `${component.type}-${index}`,
            type: component.type,
            data: {
                format: component.format,
                text: component.text,
                variableExamples: component.parameters ?? component.example?.body_text?.[0],
                add_security_recommendation: component.add_security_recommendation,
                code_expiration_minutes: component.code_expiration_minutes,
            },
        };

        if (component.type === "HEADER" && component.format !== "TEXT") {
            draggable.data.example = headerMediaUrl ?? component.example?.header_handle?.[0];
        }

        if (component.buttons && component.buttons.length > 0) {
            draggable.data.buttons = component.buttons.map((btn, btnIndex) => ({
                id: `btn-${btnIndex}`,
                type: btn.type,
                text: btn.text,
                url: btn.url,
                phone_number: btn.phone_number,
                example: Array.isArray(btn.example) ? btn.example[0] : btn.example,
                otp_type: btn.otp_type,
            }));
        }

        return draggable;
    });
}
