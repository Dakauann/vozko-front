"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useTranslations } from "next-intl";
import { memo, useRef, useState, type ReactNode } from "react";

import { CircuitTraces } from "@/components/brand/circuit";
import { ArrowDown, ArrowUp, BracketsCurly, Copy, DotsSixVertical, Link as LinkGlyph, Plus, TextB, TextItalic, Trash } from "@/components/icons";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import Button from "@/components/elevated-design/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Container, Position } from "@/lib/email-design/document";
import { MAX_HEADING_RUNES, MAX_HREF_RUNES } from "@/lib/email-design/limits";
import type { EmailLook } from "@/lib/email-design/look";
import type { CustomField } from "@/lib/email-design/merge-tags";
import type { ActiveMarks, Mark, TextRange } from "@/lib/email-design/rich-text";
import type { Block, BlockKind, ColumnsBlock, Document, HeadingBlock, Paragraph, TextBlock } from "@/lib/email-design/types";
import { cn } from "@/lib/utils";

import { BLOCK_DROP_PREFIX, blockSummary, COLUMN_DROP_PREFIX, PALETTE_KINDS } from "./block-meta";
import { BlockView, EmailFrame, headingTag, rootSpace, type BlockSlots, type EmailViewLabels, type Space } from "./email-view";
import { TextUnderline } from "./glyphs";
import { MergeTagMenu } from "./merge-tag-menu";
import { KindMenu } from "./palette";
import { PlainEditable } from "./plain-editable";
import { RichTextEditor, type RichTextHandle } from "./rich-text-editor";

export interface CanvasActions {
  select: (id: string | null) => void;
  patch: (id: string, update: (block: Block) => Block, group?: string) => void;
  moveBy: (id: string, delta: -1 | 1) => void;
  canMove: (id: string, delta: -1 | 1) => boolean;
  duplicate: (id: string) => void;
  remove: (id: string) => void;
  insertKind: (kind: BlockKind, position: Position) => void;
}

interface CanvasProps {
  document: Document;
  look: EmailLook;
  selectedId: string | null;
  readOnly: boolean;
  dropTarget: Position | null;
  actions: CanvasActions;
  labels: EmailViewLabels;
  customFields: readonly CustomField[];
  frameWidth: number;
}

const NO_MARKS: ActiveMarks = { bold: false, italic: false, underline: false, href: null };
const CHILD_KINDS = PALETTE_KINDS.filter((kind) => kind !== "columns");

function sameContainer(a: Container, b: Container): boolean {
  if (a.kind === "root" || b.kind === "root") return a.kind === b.kind;
  return a.columnsId === b.columnsId && a.column === b.column;
}

function ToolButton({ label, onClick, disabled, pressed, children, keepFocus }: { label: string; onClick?: () => void; disabled?: boolean; pressed?: boolean; children: ReactNode; keepFocus?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onMouseDown={keepFocus ? (event) => event.preventDefault() : undefined}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[--radius] text-foreground transition-colors",
        "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-35",
        pressed && "bg-primary text-primary-foreground shadow-button-primary hover:bg-[hsl(var(--primary-hover))] [--icon-accent:currentColor]",
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-border" />;
}

function LinkControl({ editor, marks }: { editor: React.RefObject<RichTextHandle | null>; marks: ActiveMarks }) {
  const t = useTranslations("emailEditor");
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState("");
  const [range, setRange] = useState<TextRange | null>(null);
  const change = (next: boolean) => {
    if (next) {
      setRange(editor.current?.selection() ?? null);
      setHref(marks.href ?? "https://");
    }
    setOpen(next);
  };
  const apply = (value: string | null) => {
    editor.current?.link(value, range);
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={change}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("toolbar.link")}
          title={t("toolbar.link")}
          aria-pressed={Boolean(marks.href)}
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => event.stopPropagation()}
          className={cn(
            "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[--radius] text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            marks.href && "bg-primary text-primary-foreground shadow-button-primary hover:bg-[hsl(var(--primary-hover))] [--icon-accent:currentColor]",
          )}
        >
          <LinkGlyph className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3" onClick={(event) => event.stopPropagation()}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            apply(href.trim() === "" ? null : href.trim());
          }}
          className="space-y-3"
        >
          <p className="text-sm font-semibold text-foreground">{t("link.title")}</p>
          <ElevatedInput label={t("link.url")} type="url" inputMode="url" autoFocus value={href} maxLength={MAX_HREF_RUNES} onChange={(event) => setHref(event.target.value)} />
          <p className="text-2xs text-muted-foreground">{t("link.hint")}</p>
          <div className="flex items-center justify-between gap-2">
            {marks.href ? <Button variant="ghost" size="sm" title={t("link.remove")} onClick={() => apply(null)} /> : <span />}
            <Button variant="primary" size="sm" type="submit" title={t("link.apply")} />
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function TextTools({ editor, marks, customFields }: { editor: React.RefObject<RichTextHandle | null>; marks: ActiveMarks; customFields: readonly CustomField[] }) {
  const t = useTranslations("emailEditor.toolbar");
  const [range, setRange] = useState<TextRange | null>(null);
  const toggle = (mark: Mark) => editor.current?.toggle(mark);
  return (
    <>
      <ToolButton label={t("bold")} keepFocus pressed={marks.bold} onClick={() => toggle("bold")}>
        <TextB className="h-4 w-4" />
      </ToolButton>
      <ToolButton label={t("italic")} keepFocus pressed={marks.italic} onClick={() => toggle("italic")}>
        <TextItalic className="h-4 w-4" />
      </ToolButton>
      <ToolButton label={t("underline")} keepFocus pressed={marks.underline} onClick={() => toggle("underline")}>
        <TextUnderline className="h-4 w-4" />
      </ToolButton>
      <LinkControl editor={editor} marks={marks} />
      <MergeTagMenu
        customFields={customFields}
        align="start"
        onOpenChange={(open) => {
          if (open) setRange(editor.current?.selection() ?? null);
        }}
        onPick={(text) => editor.current?.insert(text, range)}
        trigger={({ label }) => (
          <button
            type="button"
            aria-label={label}
            title={label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => event.stopPropagation()}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[--radius] text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <BracketsCurly className="h-4 w-4" />
          </button>
        )}
      />
      <Divider />
    </>
  );
}

interface FrameProps {
  block: Block;
  look: EmailLook;
  space: Space;
  selectedId: string | null;
  readOnly: boolean;
  dropTarget: Position | null;
  actions: CanvasActions;
  labels: EmailViewLabels;
  customFields: readonly CustomField[];
}

const BlockFrame = memo(function BlockFrame({ block, look, space, selectedId, readOnly, dropTarget, actions, labels, customFields }: FrameProps) {
  const t = useTranslations("emailEditor");
  const editor = useRef<RichTextHandle | null>(null);
  const [marks, setMarks] = useState<ActiveMarks>(NO_MARKS);
  const selected = selectedId === block.id;
  const isFooter = block.kind === "footer";
  const { attributes, listeners, setActivatorNodeRef, isDragging } = useDraggable({ id: block.id, data: { blockId: block.id }, disabled: readOnly || isFooter });
  const { setNodeRef } = useDroppable({ id: `${BLOCK_DROP_PREFIX}${block.id}`, data: { blockId: block.id } });
  const kindLabel = t(`palette.kinds.${block.kind}.label`);
  const summary = blockSummary(block);

  const slots: BlockSlots = {
    heading: readOnly
      ? undefined
      : (heading: HeadingBlock, style) => (
          <PlainEditable
            as={headingTag(heading.heading.level)}
            value={heading.heading.text}
            style={style}
            label={t("canvas.editHeading")}
            fieldKey="text"
            maxLength={MAX_HEADING_RUNES}
            onChange={(text) => actions.patch(heading.id, (current) => (current.kind === "heading" ? { ...current, heading: { ...current.heading, text } } : current), `${heading.id}:text`)}
          />
        ),
    text: readOnly
      ? undefined
      : (text: TextBlock, style) => (
          <RichTextEditor
            ref={editor}
            paragraphs={text.text.paragraphs}
            style={style}
            linkColor={look.link}
            label={t("canvas.editText")}
            fieldKey="paragraphs"
            onMarks={setMarks}
            onChange={(paragraphs: Paragraph[], group) =>
              actions.patch(text.id, (current) => (current.kind === "text" ? { ...current, text: { ...current.text, paragraphs } } : current), group ? `${text.id}:paragraphs` : undefined)
            }
          />
        ),
    column: (columns: ColumnsBlock, column: number, columnSpace: Space) => (
      <ColumnArea
        block={columns}
        column={column}
        space={columnSpace}
        look={look}
        selectedId={selectedId}
        readOnly={readOnly}
        dropTarget={dropTarget}
        actions={actions}
        labels={labels}
        customFields={customFields}
      />
    ),
  };

  return (
    <div
      ref={setNodeRef}
      data-block-id={block.id}
      data-selected={selected || undefined}
      role="group"
      aria-roledescription={t("canvas.blockRole")}
      aria-label={summary ? `${kindLabel}: ${summary}` : kindLabel}
      aria-current={selected || undefined}
      tabIndex={0}
      onClick={(event) => {
        event.stopPropagation();
        if (!selected) actions.select(block.id);
      }}
      onFocus={(event) => {
        if (event.target === event.currentTarget && !selected) actions.select(block.id);
      }}
      className={cn(
        "relative outline-none transition-[outline-color,opacity] duration-150",
        "[&:hover:not(:has([data-block-id]:hover))]:outline [&:hover:not(:has([data-block-id]:hover))]:outline-1 [&:hover:not(:has([data-block-id]:hover))]:outline-offset-[-1px] [&:hover:not(:has([data-block-id]:hover))]:outline-[hsl(var(--control-edge))]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[hsl(var(--ring))]",
        selected && "z-10 outline outline-2 outline-offset-[-2px] outline-[hsl(var(--ring))] hover:outline-2 [&:hover:not(:has([data-block-id]:hover))]:outline-2 [&:hover:not(:has([data-block-id]:hover))]:outline-[hsl(var(--ring))]",
        isDragging && "opacity-40",
      )}
    >
      {selected ? (
        <div
          role="toolbar"
          aria-label={t("toolbar.label", { block: kindLabel })}
          onClick={(event) => event.stopPropagation()}
          className="absolute -top-10 right-0 z-30 flex h-9 items-center gap-0.5 rounded-lg border border-border-strong bg-popover px-1 shadow-md"
        >
          <span className="flex items-center gap-1 pl-1 pr-1.5">
            {!readOnly && !isFooter ? (
              <button
                type="button"
                ref={setActivatorNodeRef}
                {...attributes}
                {...listeners}
                aria-label={t("toolbar.drag")}
                title={t("toolbar.drag")}
                aria-describedby={undefined}
                className="inline-flex h-7 w-5 cursor-grab items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
              >
                <DotsSixVertical className="h-4 w-4" />
              </button>
            ) : null}
            <span className="whitespace-nowrap text-xs font-semibold text-foreground">{kindLabel}</span>
          </span>
          {!readOnly ? (
            <>
              <Divider />
              {block.kind === "text" ? <TextTools editor={editor} marks={marks} customFields={customFields} /> : null}
              {isFooter ? (
                <span className="px-1.5 text-2xs text-muted-foreground">{t("toolbar.footerLocked")}</span>
              ) : (
                <>
                  <ToolButton label={t("toolbar.moveUp")} disabled={!actions.canMove(block.id, -1)} onClick={() => actions.moveBy(block.id, -1)}>
                    <ArrowUp className="h-4 w-4" />
                  </ToolButton>
                  <ToolButton label={t("toolbar.moveDown")} disabled={!actions.canMove(block.id, 1)} onClick={() => actions.moveBy(block.id, 1)}>
                    <ArrowDown className="h-4 w-4" />
                  </ToolButton>
                  <ToolButton label={t("toolbar.duplicate")} onClick={() => actions.duplicate(block.id)}>
                    <Copy className="h-4 w-4" />
                  </ToolButton>
                  <ToolButton label={t("toolbar.remove")} onClick={() => actions.remove(block.id)}>
                    <Trash className="h-4 w-4" />
                  </ToolButton>
                </>
              )}
            </>
          ) : null}
        </div>
      ) : null}
      <BlockView block={block} look={look} space={space} labels={labels} slots={slots} />
    </div>
  );
});

function DropLine({ active }: { active: boolean }) {
  return <span aria-hidden className={cn("pointer-events-none absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-primary transition-opacity duration-150", active ? "opacity-100" : "opacity-0")} />;
}

function AddPopover({ label, onPick, kinds, children }: { label: string; onPick: (kind: BlockKind) => void; kinds: readonly BlockKind[]; children: (props: { label: string }) => ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children({ label })}</PopoverTrigger>
      <PopoverContent align="center" className="w-64 p-1.5" onClick={(event) => event.stopPropagation()}>
        <KindMenu
          kinds={kinds}
          onPick={(kind) => {
            setOpen(false);
            onPick(kind);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function InsertionGap({ index, active, readOnly, onInsert }: { index: number; active: boolean; readOnly: boolean; onInsert: (kind: BlockKind, index: number) => void }) {
  const t = useTranslations("emailEditor.canvas");
  return (
    <div className="relative z-20 h-0">
      <div className="group/gap absolute inset-x-0 -top-2 flex h-4 items-center justify-center">
        <DropLine active={active} />
        {!readOnly ? (
          <>
            <span aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[hsl(var(--ring))] opacity-0 transition-opacity duration-150 group-hover/gap:opacity-60" />
            <AddPopover label={t("insertHere")} kinds={PALETTE_KINDS} onPick={(kind) => onInsert(kind, index)}>
              {({ label }) => (
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={label}
                  title={label}
                  onClick={(event) => event.stopPropagation()}
                  className="relative inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-button-primary transition-opacity duration-150 focus-visible:opacity-100 group-hover/gap:opacity-100 data-[state=open]:opacity-100 [--icon-accent:currentColor]"
                >
                  <Plus className="h-3 w-3" />
                </button>
              )}
            </AddPopover>
          </>
        ) : null}
      </div>
    </div>
  );
}

function ColumnArea({ block, column, space, look, selectedId, readOnly, dropTarget, actions, labels, customFields }: FrameProps & { block: ColumnsBlock; column: number }) {
  const t = useTranslations("emailEditor.canvas");
  const container: Container = { kind: "column", columnsId: block.id, column };
  const { setNodeRef } = useDroppable({ id: `${COLUMN_DROP_PREFIX}${block.id}:${column}`, data: { container } });
  const children = block.columns.columns[column]?.blocks ?? [];
  const target = dropTarget && sameContainer(dropTarget.container, container) ? dropTarget.index : null;
  const childSelected = selectedId !== null && children.some((child) => child.id === selectedId);
  const showAdd = !readOnly && (selectedId === block.id || childSelected);
  return (
    <div ref={setNodeRef} className="relative min-h-[48px]">
      {children.map((child, index) => (
        <div key={child.id} className="relative">
          {target === index ? <DropIndicator /> : null}
          <BlockFrame block={child} look={look} space={space} selectedId={selectedId === child.id ? selectedId : null} readOnly={readOnly} dropTarget={null} actions={actions} labels={labels} customFields={customFields} />
        </div>
      ))}
      {target !== null && target >= children.length ? <DropIndicator bottom /> : null}
      {children.length === 0 ? (
        <AddPopover label={t("addToColumn")} kinds={CHILD_KINDS} onPick={(kind) => actions.insertKind(kind, { container, index: 0 })}>
          {({ label }) => (
            <button
              type="button"
              aria-label={label}
              disabled={readOnly}
              onClick={(event) => event.stopPropagation()}
              className="m-2 flex min-h-[64px] w-[calc(100%-16px)] flex-col items-center justify-center gap-1 rounded-[--radius] border border-dashed border-control-edge text-2xs font-medium text-muted-foreground transition-colors hover:border-[hsl(var(--ring))] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
            >
              <Plus className="h-4 w-4" />
              {t("emptyColumn")}
            </button>
          )}
        </AddPopover>
      ) : showAdd ? (
        <AddPopover label={t("addToColumn")} kinds={CHILD_KINDS} onPick={(kind) => actions.insertKind(kind, { container, index: children.length })}>
          {({ label }) => (
            <button
              type="button"
              aria-label={label}
              title={label}
              onClick={(event) => event.stopPropagation()}
              className="mx-auto my-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-button-primary [--icon-accent:currentColor] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </AddPopover>
      ) : null}
    </div>
  );
}

function DropIndicator({ bottom }: { bottom?: boolean }) {
  return <span aria-hidden className={cn("pointer-events-none absolute inset-x-1 z-20 h-0.5 rounded-full bg-primary", bottom ? "bottom-0" : "-top-px")} />;
}

function StarterPrompt({ onPick }: { onPick: (kind: BlockKind) => void }) {
  const t = useTranslations("emailEditor");
  const quick: BlockKind[] = ["heading", "text", "image", "button"];
  return (
    <div className="relative mx-4 my-6 overflow-hidden rounded-lg border border-dashed border-control-edge bg-card px-6 py-7 text-center font-sans dark:bg-muted" onClick={(event) => event.stopPropagation()}>
      <CircuitTraces tone="quiet" aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 text-ornament/40" />
      <p className="relative font-display text-base font-semibold text-foreground">{t("canvas.starter.title")}</p>
      <p className="relative mx-auto mt-1 max-w-[42ch] text-xs leading-relaxed text-muted-foreground">{t("canvas.starter.body")}</p>
      <div className="relative mt-4 flex flex-wrap items-center justify-center gap-2">
        {quick.map((kind) => (
          <Button key={kind} variant="secondary" size="sm" iconVisible icon={<Plus />} title={t(`palette.kinds.${kind}.label`)} onClick={() => onPick(kind)} />
        ))}
      </div>
    </div>
  );
}

export function Canvas({ document, look, selectedId, readOnly, dropTarget, actions, labels, customFields, frameWidth }: CanvasProps) {
  const t = useTranslations("emailEditor.canvas");
  const space = rootSpace(look);
  const footerAt = document.blocks.findIndex((block) => block.kind === "footer");
  const limit = footerAt >= 0 ? footerAt : document.blocks.length;
  const rootTarget = dropTarget && dropTarget.container.kind === "root" ? Math.min(dropTarget.index, limit) : null;
  const nearEmpty = limit === 0;
  const insert = (kind: BlockKind, index: number) => actions.insertKind(kind, { container: { kind: "root" }, index });

  const frameFor = (block: Block) => (
    <BlockFrame
      block={block}
      look={look}
      space={space}
      selectedId={block.kind === "columns" || selectedId === block.id ? selectedId : null}
      readOnly={readOnly}
      dropTarget={block.kind === "columns" && dropTarget?.container.kind === "column" && dropTarget.container.columnsId === block.id ? dropTarget : null}
      actions={actions}
      labels={labels}
      customFields={customFields}
    />
  );

  return (
    <div role="region" aria-label={t("label")} className="mx-auto" style={{ width: frameWidth, maxWidth: "100%" }}>
      <EmailFrame look={look} className="rounded-lg shadow-lg" frameWidth={frameWidth}>
        <div onClick={() => actions.select(null)}>
          {document.blocks.map((block, index) => (
            <div key={block.id}>
              {index <= limit ? <InsertionGap index={index} active={rootTarget === index} readOnly={readOnly || nearEmpty} onInsert={insert} /> : null}
              {nearEmpty && index === limit ? <StarterPrompt onPick={(kind) => insert(kind, 0)} /> : null}
              {frameFor(block)}
            </div>
          ))}
          {footerAt < 0 ? <InsertionGap index={document.blocks.length} active={rootTarget === document.blocks.length} readOnly={readOnly} onInsert={insert} /> : null}
        </div>
      </EmailFrame>
    </div>
  );
}
