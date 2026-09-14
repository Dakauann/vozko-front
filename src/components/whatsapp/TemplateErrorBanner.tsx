"use client";

import { Warning, X } from "@/components/icons";

/**
 * Why a banner and not a toast.
 *
 * Template creation fails for reasons the operator has to ACT on, and acting
 * means reading the sentence, going back into a builder that fills the screen,
 * and changing something. A toast is gone in five seconds, which is how an
 * operator ends up pressing "Criar" four times against a duplicate name while
 * the explanation ("já existe conteúdo em Portuguese (BR) para esse modelo")
 * flashes past each time.
 *
 * So: stays until dismissed, sits above the form where the eye lands, and keeps
 * the provider's own wording verbatim. Meta writes its error_user_msg in the
 * operator's language already, and rewriting it in ours would only lose detail.
 */
export interface TemplateErrorBannerProps {
    title: string;
    /** The sentence to act on. Meta's own words, or our translated rule. */
    message: string;
    /**
     * Extra lines under the message: the failing rules of a client-side
     * validation pass, or Meta's rejected_reason. Optional.
     */
    details?: string[];
    /**
     * The stable error code, shown small and last. It is not for the operator;
     * it is what they paste into a support message, and what support greps for.
     */
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
