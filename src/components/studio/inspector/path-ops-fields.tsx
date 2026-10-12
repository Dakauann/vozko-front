"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { ArrowDown, ArrowUp, Eye, EyeSlash, Trash } from "@/components/icons";
import { LINE_JOINS, newShapeLayer, type Layer } from "@/lib/studio/document";
import { appliedPreset, editPathOpField, movedPathOp, pathOpKeyState, PATH_OP_PRESETS, replacedPathOp, toggledHidden, withPathOp, withPreset, type PathOpPreset } from "@/lib/studio/path-op-edits";
import {
  MERGE_MODES,
  MERGE_OPERAND_PATHS,
  MERGE_OPERAND_SHAPES,
  newPathOp,
  PATH_OP_KINDS,
  pathOpFields,
  pathOpRange,
  pathOpsLayer,
  pathOpValue,
  WHOLE_PATH_OP_FIELDS,
  ZIG_ZAG_POINTS,
  type MergeOperandShape,
  type PathOp,
  type PathOpField,
  type PathOpKind,
} from "@/lib/studio/path-ops";
import { isValidPath, scalePath } from "@/lib/studio/vector-path";
import { cn } from "@/lib/utils";

import { CodeField } from "../video/inspector/code-field";
import { FieldGrid, InspectorSection, NumberField, SelectField } from "../video/inspector/fields";
import { KeyedField } from "../video/inspector/key-toggle";
import { ToolButton } from "../video/tool-button";

const PERCENT = 100;
const PERCENT_FIELDS: ReadonlySet<PathOpField> = new Set(["centerX", "centerY", "x", "y", "w", "h"]);
const DEGREE_FIELDS: ReadonlySet<PathOpField> = new Set(["angle", "rotation"]);
const CUSTOM_OPERAND = "custom";
const SAMPLE_CANVAS = { width: 160, height: 160 };
const SAMPLE_BOX = 96;
const SAMPLE_OFFSET = (SAMPLE_CANVAS.width - SAMPLE_BOX) / 2;

const KIND_GLYPHS: Record<PathOpKind, ReactNode> = {
  offset: <path d="M4 4h8v8H4z M2 2h12v12H2z" fill="none" stroke="currentColor" strokeWidth="1.3" />,
  puckerBloat: <path d="M8 1.5C10 5 11 6 14.5 8 11 10 10 11 8 14.5 6 11 5 10 1.5 8 5 6 6 5 8 1.5z" />,
  roundCorners: <rect x="2.5" y="2.5" width="11" height="11" rx="4" />,
  zigZag: <path d="M1.5 10l2-4 2 4 2-4 2 4 2-4 2 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />,
  twist: <path d="M8 2a6 6 0 1 1-6 6M8 5a3 3 0 1 0 3 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />,
  merge: <path d="M2 3h8v8H2z M6 6h8v8H6z" fillRule="evenodd" />,
};

function KindGlyph({ kind }: { kind: PathOpKind }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5 fill-current">
      {KIND_GLYPHS[kind]}
    </svg>
  );
}

function scaleOf(field: PathOpField): number {
  return PERCENT_FIELDS.has(field) ? PERCENT : 1;
}

function unitOf(field: PathOpField, kind: PathOpKind): string | undefined {
  if (PERCENT_FIELDS.has(field) || (kind === "puckerBloat" && field === "amount")) return "%";
  if (DEGREE_FIELDS.has(field)) return "°";
  return WHOLE_PATH_OP_FIELDS.includes(field) ? undefined : "px";
}

const SAMPLE: Layer = { ...newShapeLayer("star", { x: 0.5, y: 0.5, w: SAMPLE_BOX / SAMPLE_CANVAS.width, h: SAMPLE_BOX / SAMPLE_CANVAS.height, rotation: 0, opacity: 1 }), id: "sample", points: 5, inner: 0.55 };

function PresetThumb({ preset }: { preset: PathOpPreset }) {
  const shaped = useMemo(() => pathOpsLayer({ ...SAMPLE, ...appliedPreset(SAMPLE, preset) }, SAMPLE_CANVAS), [preset]);
  return (
    <svg viewBox={`0 0 ${SAMPLE_CANVAS.width} ${SAMPLE_CANVAS.height}`} aria-hidden className="h-8 w-full rounded-sm border border-border bg-muted">
      <path d={scalePath(shaped.path ?? "", SAMPLE_BOX, SAMPLE_BOX)} transform={`translate(${SAMPLE_OFFSET} ${SAMPLE_OFFSET})`} fillRule={shaped.fillRule ?? "nonzero"} className="fill-foreground" />
    </svg>
  );
}

export interface PathOpsKeying {
  localMs: number | null;
  onToggleKey: (opId: string, field: PathOpField) => void;
}

export interface PathOpsFieldsProps {
  ops: readonly PathOp[];
  disabled: boolean;
  onChange: (change: (ops: readonly PathOp[]) => PathOp[]) => void;
  keying?: PathOpsKeying;
  gesture?: { onStart: () => void; onCommit: () => void };
  children?: ReactNode;
}

export function PathOpsFields({ ops, disabled, onChange, keying, gesture, children }: PathOpsFieldsProps) {
  const t = useTranslations("studio.pathOps");
  const [openId, setOpenId] = useState<string | null>(null);
  const open = ops.find((op) => op.id === openId) ?? ops.at(-1) ?? null;
  const openIndex = open ? ops.indexOf(open) : -1;

  const add = (kind: PathOpKind) => {
    const made = newPathOp(kind);
    onChange((current) => withPathOp(current, made));
    setOpenId(made.id);
  };

  const apply = (preset: PathOpPreset) => onChange((current) => withPreset(current, preset));

  return (
    <InspectorSection id="pathOps" group="effects" title={t("title")} summary={ops.length === 0 ? null : t("summary", { count: ops.length })}>
      <p className="text-2xs text-muted-foreground">{t("hint")}</p>
      <div className="space-y-1">
        <span className="block text-2xs text-muted-foreground">{t("presetsTitle")}</span>
        <div role="group" aria-label={t("presetsTitle")} className="grid grid-cols-4 gap-1">
          {PATH_OP_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={disabled}
              title={t("presetApply", { name: t(`presets.${preset}`) })}
              onClick={() => apply(preset)}
              className={cn(
                "flex min-w-0 flex-col gap-1 rounded-[--radius] border border-border bg-card p-1 text-left text-[10px] leading-tight text-foreground transition-colors",
                "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40",
              )}
            >
              <PresetThumb preset={preset} />
              <span className="line-clamp-2 block min-h-[2lh] break-words">{t(`presets.${preset}`)}</span>
            </button>
          ))}
        </div>
      </div>
      <div role="group" aria-label={t("add")} className="flex flex-wrap items-center gap-0.5">
        {PATH_OP_KINDS.map((kind) => (
          <ToolButton key={kind} size="sm" label={t("addKind", { kind: t(`kinds.${kind}`) })} icon={<KindGlyph kind={kind} />} disabled={disabled} onClick={() => add(kind)} />
        ))}
      </div>
      {ops.length === 0 ? (
        <p className="text-2xs text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="space-y-0.5" aria-label={t("list")}>
          {ops.map((op, index) => (
            <li key={op.id}>
              <button
                type="button"
                aria-pressed={op === open}
                onClick={() => setOpenId(op.id)}
                className={cn(
                  "flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  op === open ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  op.hidden && "line-through opacity-60",
                )}
              >
                <KindGlyph kind={op.kind} />
                <span className="min-w-0 flex-1 truncate">{t("item", { index: index + 1, kind: t(`kinds.${op.kind}`) })}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open ? (
        <PathOpDetail
          key={open.id}
          op={open}
          disabled={disabled}
          keying={keying}
          gesture={gesture}
          canMoveUp={openIndex > 0}
          canMoveDown={openIndex < ops.length - 1}
          onReplace={(change) => onChange((current) => replacedPathOp(current, open.id, change))}
          onMove={(delta) => onChange((current) => movedPathOp(current, open.id, openIndex + delta))}
        />
      ) : null}
      {children}
    </InspectorSection>
  );
}

interface PathOpDetailProps {
  op: PathOp;
  disabled: boolean;
  keying?: PathOpsKeying;
  gesture?: { onStart: () => void; onCommit: () => void };
  canMoveUp: boolean;
  canMoveDown: boolean;
  onReplace: (change: (op: PathOp) => PathOp | null) => void;
  onMove: (delta: number) => void;
}

function operandOf(path: string): MergeOperandShape | typeof CUSTOM_OPERAND {
  return MERGE_OPERAND_SHAPES.find((shape) => MERGE_OPERAND_PATHS[shape] === path) ?? CUSTOM_OPERAND;
}

function PathOpDetail({ op, disabled, keying, gesture, canMoveUp, canMoveDown, onReplace, onMove }: PathOpDetailProps) {
  const t = useTranslations("studio.pathOps");
  const localMs = keying?.localMs ?? null;
  const field = (name: PathOpField) => {
    const scale = scaleOf(name);
    const [min, max] = pathOpRange(op.kind, name)!;
    const state = pathOpKeyState(op, name, localMs);
    const label = t(op.kind === "puckerBloat" && name === "amount" ? "fields.puckerAmount" : `fields.${name}`);
    const whole = WHOLE_PATH_OP_FIELDS.includes(name);
    const input = (
      <NumberField
        label={label}
        value={pathOpValue(op, name, localMs ?? 0) * scale}
        unit={unitOf(name, op.kind)}
        decimals={whole ? 0 : 1}
        step={whole ? 1 : name === "miterLimit" ? 0.5 : 1}
        min={min * scale}
        max={Number.isFinite(max) ? max * scale : undefined}
        disabled={disabled}
        keyState={state}
        keyHint={keying ? (state === "key" ? t("keyHint") : t("interpolatedHint")) : undefined}
        onGestureStart={gesture?.onStart}
        onGestureEnd={gesture?.onCommit}
        onCommit={(value) => onReplace((current) => editPathOpField(current, name, value / scale, localMs) ?? current)}
      />
    );
    if (!keying) return <div key={name}>{input}</div>;
    return (
      <KeyedField key={name} toggle={{ label: t("key", { field: label }), state, disabled: disabled || localMs === null, onClick: () => keying.onToggleKey(op.id, name) }}>
        {input}
      </KeyedField>
    );
  };
  const shown = pathOpFields(op.kind).filter((name) => op.kind !== "offset" || name !== "miterLimit" || op.join === "miter");
  return (
    <div role="group" aria-label={t("detail")} className="space-y-2 rounded-md border border-border p-2">
      <div className="flex items-center justify-end gap-0.5">
        <ToolButton size="sm" label={op.hidden ? t("show") : t("hide")} icon={op.hidden ? <EyeSlash className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} disabled={disabled} onClick={() => onReplace(toggledHidden)} />
        <ToolButton size="sm" label={t("moveUp")} icon={<ArrowUp className="h-3.5 w-3.5" />} disabled={disabled || !canMoveUp} onClick={() => onMove(-1)} />
        <ToolButton size="sm" label={t("moveDown")} icon={<ArrowDown className="h-3.5 w-3.5" />} disabled={disabled || !canMoveDown} onClick={() => onMove(1)} />
        <ToolButton size="sm" label={t("remove")} icon={<Trash className="h-3.5 w-3.5" />} disabled={disabled} onClick={() => onReplace(() => null)} />
      </div>
      {op.kind === "offset" ? (
        <SelectField label={t("fields.join")} value={op.join} disabled={disabled} options={LINE_JOINS.map((join) => ({ value: join, label: t(`joins.${join}`) }))} onChange={(join) => onReplace((current) => ({ ...current, join }) as PathOp)} />
      ) : null}
      {op.kind === "zigZag" ? (
        <SelectField label={t("fields.points")} value={op.points} disabled={disabled} options={ZIG_ZAG_POINTS.map((points) => ({ value: points, label: t(`pointKinds.${points}`) }))} onChange={(points) => onReplace((current) => ({ ...current, points }) as PathOp)} />
      ) : null}
      {op.kind === "merge" ? (
        <>
          <FieldGrid>
            <SelectField label={t("fields.mode")} value={op.mode} disabled={disabled} options={MERGE_MODES.map((mode) => ({ value: mode, label: t(`modes.${mode}`) }))} onChange={(mode) => onReplace((current) => ({ ...current, mode }) as PathOp)} />
            <SelectField
              label={t("fields.operand")}
              value={operandOf(op.path)}
              disabled={disabled}
              options={[...MERGE_OPERAND_SHAPES, CUSTOM_OPERAND].map((shape) => ({ value: shape, label: t(`operands.${shape}`) }))}
              onChange={(shape) => {
                if (shape !== CUSTOM_OPERAND) onReplace((current) => ({ ...current, path: MERGE_OPERAND_PATHS[shape as MergeOperandShape] }) as PathOp);
              }}
            />
          </FieldGrid>
          {operandOf(op.path) === CUSTOM_OPERAND ? (
            <CodeField
              label={t("fields.path")}
              hint={t("pathHint")}
              value={op.path}
              disabled={disabled}
              onCommit={(path) => {
                if (!isValidPath(path)) return false;
                onReplace((current) => ({ ...current, path }) as PathOp);
                return true;
              }}
            />
          ) : null}
        </>
      ) : null}
      <div className="grid grid-cols-2 gap-2">{shown.map(field)}</div>
      {keying && localMs === null ? <p className="text-2xs text-muted-foreground">{t("outsideHint")}</p> : null}
    </div>
  );
}
