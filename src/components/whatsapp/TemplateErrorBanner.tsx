"use client";

import { Warning, X } from "@/components/icons";

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
        <div
            role="alert"
            aria-live="assertive"
            className="mb-4 flex items-start gap-3 rounded-[--radius] border border-destructive-ink/30 bg-destructive-ink/5 p-4"
        >
            <Warning
                className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive-ink"
                weight="fill"
            />

            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-destructive-ink">{title}</p>
                <p className="mt-1 text-sm text-foreground">{message}</p>

                {details && details.length > 0 && (
                    <ul className="mt-2 list-disc space-y-1 pl-4">
                        {details.map((detail, index) => (
                            <li key={index} className="text-sm text-muted-foreground">
                                {detail}
                            </li>
                        ))}
                    </ul>
                )}

                {code && (
                    <p className="mt-2 font-mono text-2xs text-muted-foreground">{code}</p>
                )}
            </div>

            <button
                type="button"
                onClick={onDismiss}
                aria-label={dismissLabel}
                className="flex-shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
                <X className="h-4 w-4" weight="bold" />
            </button>
        </div>
    );
}
