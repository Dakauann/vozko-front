import type { ReactNode } from "react";

import { Warning } from "@/components/icons";

export function SendCapField({
    label,
    hint,
    children,
}: {
    label: string;
    hint?: string;
    children: ReactNode;
}) {
    return (
        <div className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">{label}</span>
            {children}
            {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
    );
}

export function SendCapDialogError({ message }: { message: string | null }) {
    if (!message) return null;
    return (
        <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-destructive-ink" role="alert">
            <Warning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {message}
        </p>
    );
}
