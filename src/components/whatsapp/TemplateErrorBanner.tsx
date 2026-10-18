"use client";

import { X } from "@/components/icons";
import { Notice } from "@/components/ui/notice";

export interface TemplateErrorBannerProps {
    title: string;
    message: string;
    details?: string[];
    code?: string;
    onDismiss: () => void;
    dismissLabel: string;
}

export function TemplateErrorBanner({
    title,
    message,
    details,
    code,
    onDismiss,
    dismissLabel,
}: TemplateErrorBannerProps) {
    return (
        <div className="relative mb-4">
            <Notice tone="fault" title={title} className="pr-12">
                <p className="text-sm text-foreground">{message}</p>

                {details && details.length > 0 && (
                    <ul className="list-disc space-y-1 pl-4">
                        {details.map((detail, index) => (
                            <li key={index} className="text-sm text-muted-foreground">
                                {detail}
                            </li>
                        ))}
                    </ul>
                )}

                {code && (
                    <p className="font-mono text-2xs text-muted-foreground">{code}</p>
                )}
            </Notice>

            <button
                type="button"
                onClick={onDismiss}
                aria-label={dismissLabel}
                className="absolute right-3 top-3 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
                <X className="h-4 w-4" weight="bold" />
            </button>
        </div>
    );
}
