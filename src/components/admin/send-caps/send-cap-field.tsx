import type { ReactNode } from "react";

import { Notice } from "@/components/ui/notice";

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
        <Notice tone="fault">
            <p>{message}</p>
        </Notice>
    );
}
