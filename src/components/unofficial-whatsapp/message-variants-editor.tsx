"use client";

import { Plus, Trash } from "@/components/icons";

import { cn } from "@/lib/utils";

/**
 * The variants block: several versions of one message, and the rules that keep
 * them interchangeable.
 *
 * Lifted out of CampaignMessageComposer rather than copied, because a second
 * surface now needs exactly this: a lead import can open example conversations,
 * and the first message of those is authored the same way, with the same
 * placeholder syntax and the same "every variant uses the same variables" rule.
 * Two copies would be two chances to disagree with the Go domain that validates
 * them.
 *
 * Why variants exist at all differs between the two callers, and neither reason
 * belongs in here:
 *
 *  - A campaign rotates them because identical bodies leaving one number at
 *    volume are what WhatsApp's spam heuristics weight.
 *  - A seeded import rotates them so two hundred example conversations do not
 *    read as one conversation copied two hundred times.
 *
 * So this component takes its own labels and says nothing about why.
 */

/** Mirrors the Go domain's regex, so the counter and the backend agree. */
const PLACEHOLDER = /\{\{(\d+)\}\}/g;

/**
 * The positional variables one body uses, ascending and deduplicated.
 *
 * Named placeholders like {{nome}} are the PROVIDER's syntax, substituted from
 * its own lead store. We never render them, so they are not ours to count.
 */
export function placeholdersIn(body: string): number[] {
  const found = new Set<number>();
  for (const match of body.matchAll(PLACEHOLDER)) {
    const n = Number(match[1]);
    if (Number.isFinite(n)) found.add(n);
  }
  return [...found].sort((a, b) => a - b);
}

/**
 * The highest placeholder across every variant: how many columns an import
 * needs.
 *
 * The highest rather than the count, because a body using {{1}} and {{3}} needs
 * three columns, not two. Across variants rather than per variant, because one
 * set of columns is collected for the whole run.
 */
export function parameterCountIn(bodies: string[]): number {
  return bodies.reduce(
    (max, body) => Math.max(max, ...placeholdersIn(body), 0),
    0,
  );
}

/**
 * Whether every variant uses the same placeholder SET, not just the same count.
 *
 * Not a nicety: a variant reading {{1}} beside one reading {{2}} would send a
 * raw "{{2}}" to everyone assigned the second, because only one column was
 * ever collected.
 */
export function variantsAgree(bodies: string[]): boolean {
  if (bodies.length < 2) return true;
  const first = placeholdersIn(bodies[0]).join(",");
  return bodies.every((b) => placeholdersIn(b).join(",") === first);
}

/** The strings this editor renders. Supplied by the caller, never guessed. */
export interface MessageVariantsLabels {
  title: string;
  help: string;
  addVariant: string;
  removeVariant: string;
  /** Takes the 1-based index, e.g. "VARIANTE 2". */
  variantLabel: (index: number) => string;
  bodyPlaceholder: string;
  mismatch: string;
  /** Takes the number of variables detected. */
  variablesDetected: (count: number) => string;
}

export interface MessageVariantsEditorProps {
  bodies: string[];
  onChange: (next: string[]) => void;
  labels: MessageVariantsLabels;
  /** How many variants may exist. The cap is the caller's policy, not ours. */
  max: number;
  disabled?: boolean;
  rows?: number;
}

export function MessageVariantsEditor({
  bodies,
  onChange,
  labels,
  max,
  disabled,
  rows = 4,
}: MessageVariantsEditorProps) {
  const setBody = (index: number, body: string) => {
    const next = [...bodies];
    next[index] = body;
    onChange(next);
  };

  const addVariant = () => {
    if (bodies.length >= max) return;
    onChange([...bodies, ""]);
  };

  const removeVariant = (index: number) => {
    // Never drop to zero bodies: a message with no text is not a state the
    // form should be able to reach.
    if (bodies.length <= 1) return;
    onChange(bodies.filter((_, i) => i !== index));
  };

  const agree = variantsAgree(bodies);
  const params = parameterCountIn(bodies);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{labels.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{labels.help}</p>
        </div>
        <button
          type="button"
          onClick={addVariant}
          disabled={disabled || bodies.length >= max}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" weight="bold" />
          {labels.addVariant}
        </button>
      </div>

      {bodies.map((body, index) => (
        <div key={index} className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              {labels.variantLabel(index + 1)}
            </span>
            {bodies.length > 1 ? (
              <button
                type="button"
                onClick={() => removeVariant(index)}
                disabled={disabled}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs text-destructive-ink transition-colors hover:bg-muted"
              >
                <Trash className="h-3 w-3" weight="bold" />
                {labels.removeVariant}
              </button>
            ) : null}
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(index, e.target.value)}
            disabled={disabled}
            rows={rows}
            placeholder={labels.bodyPlaceholder}
            className={cn(
              "w-full resize-y rounded-[--radius] border border-border bg-background px-3 py-2 text-sm text-foreground",
              "focus:outline-none focus:ring-2 focus:ring-primary/40",
            )}
          />
        </div>
      ))}

      {!agree ? (
        <p className="text-xs font-semibold text-destructive-ink">
          {labels.mismatch}
        </p>
      ) : null}

      {params > 0 ? (
        <p className="text-xs text-muted-foreground">
          {labels.variablesDetected(params)}
        </p>
      ) : null}
    </div>
  );
}

export default MessageVariantsEditor;
