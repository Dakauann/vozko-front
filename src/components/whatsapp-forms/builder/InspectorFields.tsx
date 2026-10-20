"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { cn } from "@/lib/utils";

function Counter({ length, limit }: { length: number; limit?: number }) {
  const t = useTranslations("whatsappForms.builder.inspector");
  if (!limit) return null;
  return (
    <p className={cn("px-1 text-right text-2xs tabular-nums", length > limit ? "font-semibold text-destructive-ink" : "text-muted-foreground")}>
      {t("counter", { count: length, limit })}
    </p>
  );
}

export function CountedInput({
  label,
  value,
  limit,
  error,
  disabled,
  type = "text",
  onChange,
}: {
  label: string;
  value: string;
  limit?: number;
  error?: string;
  disabled?: boolean;
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-0.5">
      <ElevatedInput label={label} value={value} type={type} error={error} disabled={disabled} controlSize="sm" onChange={(event) => onChange(event.target.value)} />
      <Counter length={[...value].length} limit={limit} />
    </div>
  );
}

export function CountedTextarea({
  label,
  value,
  limit,
  error,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  limit?: number;
  error?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-0.5">
      <ElevatedTextarea label={label} value={value} error={error} disabled={disabled} autoResize maxHeight={240} onChange={(event) => onChange(event.target.value)} />
      <Counter length={[...value].length} limit={limit} />
    </div>
  );
}

export function InspectorSection({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="space-y-2.5 border-t border-border pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-muted-foreground">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function ProblemLines({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <ul className="space-y-0.5">
      {messages.map((message, index) => (
        <li key={index} className="flex items-start gap-1.5 text-xs text-foreground">
          <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
          {message}
        </li>
      ))}
    </ul>
  );
}
