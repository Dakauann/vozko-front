"use client";

import { Warning } from "@/components/icons";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export function QuoteRefusalNotice({
    message,
    onRetry,
    className,
}: {
    message: string | null;
    onRetry: (() => void) | null;
    className?: string;
}) {
    const t = useTranslations("common");

    return (
        <div role="status">
            {message && (
                <p className={cn("flex items-start gap-1.5 text-xs text-warning-ink", className)}>
                    <Warning className="mt-0.5 h-3.5 w-3.5 shrink-0" weight="fill" aria-hidden />
                    <span>
                        {message}
                        {onRetry && (
                            <button
                                type="button"
                                onClick={onRetry}
                                className="ml-1.5 font-medium text-foreground underline underline-offset-2 hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {t("tryAgain")}
                            </button>
                        )}
                    </span>
                </p>
            )}
        </div>
    );
}
