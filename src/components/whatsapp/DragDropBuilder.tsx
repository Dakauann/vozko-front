"use client";

import { AnimatePresence, Reorder, useDragControls } from "framer-motion";
import {
  CaretDown,
  ChatCircle,
  Check,
  Cursor,
  DotsSixVertical,
  File,
  Gif,
  Image as ImageIcon,
  MapPin,
  PhoneCall,
  Plus,
  ShieldCheck,
  TextT,
  Trash,
  VideoCamera,
} from "@/components/icons";
import { useState, type ReactNode } from "react";

import type { Icon } from "@/components/icons";
import { useButtonActionLabel } from "@/components/whatsapp/exit/use-button-action-label";
import type { ButtonActionChoice } from "@/lib/whatsapp-templates/exit";
import type { FlowAction } from "@/lib/whatsapp-templates/types";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export interface DraggableComponent {
  id: string;
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS" | "CALL_PERMISSION_REQUEST";
  data: {
    format?: string;
    text?: string;
    example?: string;
    locationName?: string;
    locationAddress?: string;
    variableExamples?: string[];
    namedVariableExamples?: Record<string, string>;
    variableSuggestions?: Record<string, string>;
    buttons?: Array<{
      id: string;
      type: string;
      text?: string;
      url?: string;
      phone_number?: string;
      example?: string;
      otp_type?: string;
      flowId?: string;
      flowAction?: FlowAction;
      navigateScreen?: string;
      formName?: string;
      action?: ButtonActionChoice;
      exitPiece?: boolean;
      trackClicks?: boolean;
    }>;
    exitConfirmation?: string;
    exitPiece?: boolean;
    add_security_recommendation?: boolean;
    code_expiration_minutes?: number;
    [key: string]: unknown;
  };
}

interface ComponentPaletteItem {
  type: string;
  icon: Icon;
  label: string;
  description: string;
  color: string;
  singleton?: boolean;
  opensChoice?: boolean;
}

interface PalettePicker {
  onPick: () => void;
  used: boolean;
  hint?: string;
}

interface DragDropBuilderProps {
  components: DraggableComponent[];
  onChange: (components: DraggableComponent[]) => void;
  onComponentSelect?: (component: DraggableComponent | null) => void;
  selectedComponentId?: string | null;
  palette?: ComponentPaletteItem[];
  pickers?: Record<string, PalettePicker>;
  renderEditor?: (component: DraggableComponent) => ReactNode;
}

const DEFAULT_PALETTE: ComponentPaletteItem[] = [
  {
    type: "HEADER",
    icon: TextT,
    label: "Header",
    description: "Add a header with text, image, video, or document",
    color: "ink-1",
    singleton: true,
  },
  {
    type: "BODY",
    icon: ChatCircle,
    label: "Body",
    description: "Main message content with variables",
    color: "ink-2",
    singleton: true,
  },
  {
    type: "FOOTER",
    icon: TextT,
    label: "Footer",
    description: "Optional footer text (max 60 chars)",
    color: "ink-3",
    singleton: true,
  },
  {
    type: "BUTTONS",
    icon: Cursor,
    label: "Buttons",
    description: "Add action or quick reply buttons",
    color: "ink-4",
    singleton: true,
  },
  {
    type: "CALL_PERMISSION_REQUEST",
    icon: PhoneCall,
    label: "Call permission",
    description: "Ask the user for permission to call them on WhatsApp",
    color: "ink-1",
    singleton: true,
  },
];

const LEAD_EXIT_PIECE: ComponentPaletteItem = {
  type: "LEAD_EXIT",
  icon: ShieldCheck,
  label: "Lead exit",
  description: "A button or word the lead uses to stop receiving",
  color: "ink-2",
  singleton: true,
  opensChoice: true,
};

export function paletteForCategory(category: string): ComponentPaletteItem[] {
  if (category !== "AUTHENTICATION") return [...DEFAULT_PALETTE, LEAD_EXIT_PIECE];
  return DEFAULT_PALETTE.filter(
    (item) => item.type === "BODY" || item.type === "FOOTER" || item.type === "BUTTONS",
  );
}

function newComponentId(type: string): string {
  return `${type.toLowerCase()}-${Date.now()}`;
}

export default function DragDropBuilder({
  components,
  onChange,
  onComponentSelect,
  selectedComponentId,
  palette = DEFAULT_PALETTE,
  pickers = {},
  renderEditor,
}: DragDropBuilderProps) {
  const builderT = useTranslations("whatsappTemplates.builder");
  const componentTypeT = useTranslations("whatsappTemplates.componentType");

  const getPaletteLabel = (type: string) =>
    builderT(`palette.${type.toLowerCase()}.label`);
  const getPaletteDescription = (type: string) =>
    builderT(`palette.${type.toLowerCase()}.description`);

  const [draggedType, setDraggedType] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleAddComponent = (type: string) => {
    const paletteItem = palette.find((p) => p.type === type);

    if (paletteItem?.opensChoice) {
      if (canAddComponent(type)) pickers[type]?.onPick();
      return;
    }

    if (paletteItem?.singleton && components.some((c) => c.type === type)) {
      return;
    }

    const newComponent: DraggableComponent = {
      id: newComponentId(type),
      type: type as DraggableComponent["type"],
      data: getDefaultData(type),
    };

    const newComponents = [...components];
    if (type === "HEADER") {
      newComponents.unshift(newComponent);
    } else if (
      type === "FOOTER" ||
      type === "BUTTONS" ||
      type === "CALL_PERMISSION_REQUEST"
    ) {
      newComponents.push(newComponent);
    } else {
      const headerIndex = newComponents.findIndex((c) => c.type === "HEADER");
      if (headerIndex >= 0) {
        newComponents.splice(headerIndex + 1, 0, newComponent);
      } else {
        newComponents.unshift(newComponent);
      }
    }

    onChange(newComponents);
    onComponentSelect?.(newComponent);
  };

  const handleRemoveComponent = (id: string) => {
    onChange(components.filter((c) => c.id !== id));
    if (selectedComponentId === id) {
      onComponentSelect?.(null);
    }
  };

  const handleDragStart = (type: string) => {
    setDraggedType(type);
  };

  const handleDragEnd = () => {
    setDraggedType(null);
    setIsDraggingOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);

    if (draggedType) {
      handleAddComponent(draggedType);
    }
  };

  const getComponentIcon = (type: string) => {
    const icons: Record<string, Icon> = {
      HEADER: TextT,
      BODY: ChatCircle,
      FOOTER: TextT,
      BUTTONS: Cursor,
      CALL_PERMISSION_REQUEST: PhoneCall,
    };
    return icons[type] || TextT;
  };

  const getComponentInk = (type: string) =>
    (palette.find((p) => p.type === type) ?? DEFAULT_PALETTE.find((p) => p.type === type))?.color ?? "ink-1";

  const blockedBy = (type: string): string | null => {
    if (type === "CALL_PERMISSION_REQUEST" && components.some((c) => c.type === "BUTTONS")) return "BUTTONS";
    if (type === "BUTTONS" && components.some((c) => c.type === "CALL_PERMISSION_REQUEST")) return "CALL_PERMISSION_REQUEST";
    return null;
  };

  const unavailableReason = (item: ComponentPaletteItem): string | undefined => {
    if (pickers[item.type]?.hint) return pickers[item.type].hint;
    if (item.singleton && components.some((c) => c.type === item.type)) return builderT("inMessage");
    const blocker = blockedBy(item.type);
    return blocker ? builderT("excludes", { piece: getPaletteLabel(blocker) }) : undefined;
  };

  const canAddComponent = (type: string) => {
    const paletteItem = palette.find((p) => p.type === type);
    if (!paletteItem) return false;
    if (paletteItem.opensChoice) return Boolean(pickers[type]) && !pickers[type].used;
    if (paletteItem.singleton && components.some((c) => c.type === type)) {
      return false;
    }
    return blockedBy(type) === null;
  };

  return (
    <div className="space-y-6">
      <div
        data-tour="wt-builder-canvas"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "rounded-lg transition-shadow duration-150",
          isDraggingOver && "ring-2 ring-ring ring-offset-4 ring-offset-card",
        )}
      >
        {components.length === 0 ? (
          <div className="flex items-center gap-4 rounded-lg border border-dashed border-border-strong px-5 py-6">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-control-edge text-muted-foreground">
              <Plus className="h-5 w-5" weight="bold" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">
                {builderT("emptyState.title")}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {builderT("emptyState.description")}
              </span>
            </span>
          </div>
        ) : (
          <Reorder.Group axis="y" values={components} onReorder={onChange} className="space-y-2">
            <AnimatePresence initial={false}>
              {components.map((component) => (
                <PieceCard
                  key={component.id}
                  component={component}
                  icon={getComponentIcon(component.type)}
                  ink={getComponentInk(component.type)}
                  label={componentTypeT(component.type)}
                  selected={selectedComponentId === component.id}
                  onToggle={() =>
                    onComponentSelect?.(selectedComponentId === component.id ? null : component)
                  }
                  onRemove={() => handleRemoveComponent(component.id)}
                  editor={
                    selectedComponentId === component.id && renderEditor
                      ? renderEditor(component)
                      : null
                  }
                />
              ))}
            </AnimatePresence>
          </Reorder.Group>
        )}
      </div>

      <div data-tour="wt-builder-palette">
        <h3 className="legend mb-2">{builderT("titles.add")}</h3>
        <ul className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
          {palette.map((item) => {
            const PieceIcon = item.icon;
            const canAdd = canAddComponent(item.type);
            const reason = canAdd ? undefined : unavailableReason(item);

            return (
              <li key={item.type} className="flex">
                <button
                  type="button"
                  aria-disabled={!canAdd}
                  draggable={canAdd}
                  onDragStart={() => canAdd && handleDragStart(item.type)}
                  onDragEnd={handleDragEnd}
                  onClick={() => canAdd && handleAddComponent(item.type)}
                  className={cn(
                    "group flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-[border-color,box-shadow,background-color] duration-150",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    canAdd
                      ? "border-border bg-card hover:border-border-strong hover:shadow-sm active:bg-[hsl(var(--accent-hover))]"
                      : "cursor-not-allowed border-border bg-card",
                  )}
                >
                  <span
                    className={cn(
                      "ink-plate flex h-8 w-8 shrink-0 items-center justify-center",
                      item.color,
                      !canAdd && "opacity-50",
                    )}
                  >
                    <PieceIcon className="h-4 w-4" weight="duotone" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm font-medium", canAdd ? "text-foreground" : "text-muted-foreground")}>
                      {getPaletteLabel(item.type)}
                    </span>
                    <span className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                      {reason && item.singleton && components.some((c) => c.type === item.type) ? (
                        <Check className="mt-px h-3 w-3 shrink-0 text-foreground" weight="bold" aria-hidden />
                      ) : null}
                      <span className="line-clamp-2">{reason ?? getPaletteDescription(item.type)}</span>
                    </span>
                  </span>
                  {canAdd ? (
                    <Plus
                      className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
                      weight="bold"
                      aria-hidden
                    />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function PieceCard({
  component,
  icon: PieceIcon,
  ink,
  label,
  selected,
  onToggle,
  onRemove,
  editor,
}: {
  component: DraggableComponent;
  icon: Icon;
  ink: string;
  label: string;
  selected: boolean;
  onToggle: () => void;
  onRemove: () => void;
  editor: ReactNode;
}) {
  const builderT = useTranslations("whatsappTemplates.builder");
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={component}
      dragListener={false}
      dragControls={dragControls}
      layout="position"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      whileDrag={{ scale: 1.01 }}
      className={cn(
        "group relative list-none rounded-lg border bg-card transition-[border-color,box-shadow] duration-150",
        selected ? "border-primary-edge shadow-md" : "border-border hover:border-border-strong",
      )}
    >
      <div className="flex items-start gap-1 p-2">
        <button
          type="button"
          aria-label={builderT("dragHandle", { piece: label })}
          onPointerDown={(event) => dragControls.start(event)}
          className="flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-[--radius] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        >
          <DotsSixVertical className="h-4 w-4" weight="bold" />
        </button>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={selected}
          className="flex min-w-0 flex-1 items-start gap-3 rounded-[--radius] px-1 py-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className={cn("ink-plate flex h-8 w-8 shrink-0 items-center justify-center", ink)}>
            <PieceIcon className="h-4 w-4" weight="duotone" />
          </span>
          <span className="min-w-0 flex-1 pt-1.5 text-sm font-semibold leading-5 text-foreground">{label}</span>
          <CaretDown
            aria-hidden
            className={cn(
              "mt-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150",
              selected && "rotate-180",
            )}
          />
        </button>
        <button
          type="button"
          aria-label={`${builderT("component.remove")} ${label}`}
          onClick={onRemove}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors hover:bg-muted hover:text-destructive-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Trash className="h-4 w-4" />
        </button>
      </div>
      {selected ? null : (
        <div onClick={onToggle} className="-mt-1 cursor-pointer pb-3 pl-[5.25rem] pr-12">
          <ComponentPreview component={component} />
        </div>
      )}
      {editor ? (
        <div className="border-t border-border px-4 pb-5 pt-4 sm:px-5" data-tour="wt-component-editor">
          {editor}
        </div>
      ) : null}
    </Reorder.Item>
  );
}

function ComponentPreview({ component }: { component: DraggableComponent }) {
  const builderT = useTranslations("whatsappTemplates.builder");
  const headerFormatT = useTranslations("whatsappTemplates.headerFormat");
  const { type, data } = component;

  if (type === "HEADER") {
    if (data.format === "TEXT") {
      return (
        <p className="text-xs text-muted-foreground line-clamp-2">
          {data.text || (
            <span className="text-muted-foreground italic">
              {builderT("preview.header.noText")}
            </span>
          )}
        </p>
      );
    }
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {data.format === "IMAGE" && <ImageIcon className="h-4 w-4" />}
        {data.format === "VIDEO" && <VideoCamera className="h-4 w-4" />}
        {data.format === "DOCUMENT" && <File className="h-4 w-4" />}
        {data.format === "LOCATION" && <MapPin className="h-4 w-4" />}
        {data.format === "GIF" && <Gif className="h-4 w-4" />}
        <span>
          {builderT("preview.header.media", {
            format: headerFormatT(data.format as string),
          })}
        </span>
      </div>
    );
  }

  if (type === "BODY") {
    return (
      <p className="text-xs text-muted-foreground line-clamp-3">
        {data.text || (
          <span className="text-muted-foreground italic">
            {builderT("preview.body.noText")}
          </span>
        )}
      </p>
    );
  }

  if (type === "FOOTER") {
    return (
      <p className="text-xs text-muted-foreground italic line-clamp-1">
        {data.text || (
          <span className="text-muted-foreground">
            {builderT("preview.footer.noText")}
          </span>
        )}
      </p>
    );
  }

  if (type === "BUTTONS") {
    const buttons = data.buttons ?? [];
    if (buttons.length === 0) {
      return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Cursor className="h-4 w-4" />
          <span>{builderT("preview.buttons.count", { count: 0 })}</span>
        </div>
      );
    }
    return <ButtonChips buttons={buttons} />;
  }

  if (type === "CALL_PERMISSION_REQUEST") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <PhoneCall className="h-4 w-4" />
        <span>{builderT("preview.callPermission.hint")}</span>
      </div>
    );
  }

  return null;
}

function ButtonChips({ buttons }: { buttons: NonNullable<DraggableComponent["data"]["buttons"]> }) {
  const labelOf = useButtonActionLabel();
  const destinationT = useTranslations("templateExit.campaign");
  return (
    <div className="flex flex-wrap gap-1">
      {buttons.map((button) => (
        <span key={button.id} className="inline-flex items-center rounded-[--radius] border border-border bg-muted px-1.5 py-0.5 text-2xs font-semibold text-foreground">
          {button.action ? destinationT("destination", { text: button.text ?? "", action: labelOf(button.action) }) : button.text || button.type}
        </span>
      ))}
    </div>
  );
}

export function getDefaultData(type: string): DraggableComponent["data"] {
  switch (type) {
    case "HEADER":
      return { format: "TEXT", text: "" };
    case "BODY":
      return { text: "" };
    case "FOOTER":
      return { text: "" };
    case "BUTTONS":
      return { buttons: [] };
    case "CALL_PERMISSION_REQUEST":
      return {};
    default:
      return {};
  }
}
