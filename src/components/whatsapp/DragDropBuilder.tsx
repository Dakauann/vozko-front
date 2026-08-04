"use client";

import { AnimatePresence, Reorder, motion } from "framer-motion";
import {
  ChatCircle,
  Cursor,
  DotsSixVertical,
  File,
  Gif,
  Image as ImageIcon,
  MapPin,
  PhoneCall,
  Plus,
  TextT,
  Trash,
  VideoCamera,
} from "@/components/icons";
import { useRef, useState } from "react";

import type { Icon } from "@/components/icons";
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
    buttons?: Array<{
      id: string;
      type: string;
      text?: string;
      url?: string;
      phone_number?: string;
      example?: string;
    }>;
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
}

interface DragDropBuilderProps {
  components: DraggableComponent[];
  onChange: (components: DraggableComponent[]) => void;
  onComponentSelect?: (component: DraggableComponent | null) => void;
  selectedComponentId?: string | null;
  palette?: ComponentPaletteItem[];
}

const DEFAULT_PALETTE: ComponentPaletteItem[] = [
  {
    type: "HEADER",
    icon: TextT,
    label: "Header",
    description: "Add a header with text, image, video, or document",
    color: "from-blue-500 to-cyan-500",
    singleton: true,
  },
  {
    type: "BODY",
    icon: ChatCircle,
    label: "Body",
    description: "Main message content with variables",
    color: "from-emerald-500 to-teal-500",
    singleton: true,
  },
  {
    type: "FOOTER",
    icon: TextT,
    label: "Footer",
    description: "Optional footer text (max 60 chars)",
    color: "from-amber-500 to-orange-500",
    singleton: true,
  },
  {
    type: "BUTTONS",
    icon: Cursor,
    label: "Buttons",
    description: "Add action or quick reply buttons",
    color: "from-purple-500 to-pink-500",
    singleton: true,
  },
  {
    type: "CALL_PERMISSION_REQUEST",
    icon: PhoneCall,
    label: "Call permission",
    description: "Ask the user for permission to call them on WhatsApp",
    color: "from-indigo-500 to-blue-500",
    singleton: true,
  },
];

export default function DragDropBuilder({
  components,
  onChange,
  onComponentSelect,
  selectedComponentId,
  palette = DEFAULT_PALETTE,
}: DragDropBuilderProps) {
  const builderT = useTranslations("whatsappTemplates.builder");
  const componentTypeT = useTranslations("whatsappTemplates.componentType");
  const headerFormatT = useTranslations("whatsappTemplates.headerFormat");

  const getPaletteLabel = (type: string) =>
    builderT(`palette.${type.toLowerCase()}.label`);
  const getPaletteDescription = (type: string) =>
    builderT(`palette.${type.toLowerCase()}.description`);

  const [draggedType, setDraggedType] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const handleAddComponent = (type: string) => {
    const paletteItem = palette.find((p) => p.type === type);

    if (paletteItem?.singleton && components.some((c) => c.type === type)) {
      return;
    }

    const newComponent: DraggableComponent = {
      id: `${type.toLowerCase()}-${Date.now()}`,
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

  const getComponentColor = (type: string) => {
    const colors: Record<string, string> = {
      HEADER: "blue",
      BODY: "emerald",
      FOOTER: "amber",
      BUTTONS: "purple",
      CALL_PERMISSION_REQUEST: "blue",
    };
    return colors[type] || "slate";
  };

  const canAddComponent = (type: string) => {
    const paletteItem = palette.find((p) => p.type === type);
    if (!paletteItem) return false;
    if (paletteItem.singleton && components.some((c) => c.type === type)) {
      return false;
    }
    // Call permission requests and regular buttons are mutually exclusive:
    // WhatsApp renders the permission buttons itself.
    if (
      type === "CALL_PERMISSION_REQUEST" &&
      components.some((c) => c.type === "BUTTONS")
    ) {
      return false;
    }
    if (
      type === "BUTTONS" &&
      components.some((c) => c.type === "CALL_PERMISSION_REQUEST")
    ) {
      return false;
    }
    return true;
  };

  return (
    <div className="flex gap-6 h-full">
      {/* Component Palette */}
      <div className="w-64 flex-shrink-0" data-tour="wt-builder-palette">
        <div className="sticky top-0">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            {builderT("titles.components")}
          </h3>
          <div className="space-y-2">
            {palette.map((item) => {
              const Icon = item.icon;
              const canAdd = canAddComponent(item.type);

              return (
                <motion.div
                  key={item.type}
                  draggable={canAdd}
                  onDragStart={() => canAdd && handleDragStart(item.type)}
                  onDragEnd={handleDragEnd}
                  whileHover={canAdd ? { scale: 1.02 } : {}}
                  className={`group relative rounded-[--radius] border border-dashed p-4 transition-all cursor-move ${
                    canAdd
                      ? "border-border hover:border-foreground/20 bg-card hover:shadow-md"
                      : "border-border bg-muted opacity-50 cursor-not-allowed"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${item.color} opacity-90`}
                    >
                      <Icon className="h-5 w-5 text-white" weight="duotone" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-foreground text-sm">
                        {getPaletteLabel(item.type)}
                        {item.singleton && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            {builderT("singleton")}
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {getPaletteDescription(item.type)}
                      </p>
                    </div>
                  </div>

                  {canAdd && (
                    <div className="absolute inset-0 flex items-center justify-center bg-card opacity-0 group-hover:opacity-100 transition-opacity rounded-[--radius] pointer-events-none">
                      <DotsSixVertical
                        className="h-6 w-6 text-muted-foreground"
                        weight="bold"
                      />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Builder Canvas */}
      <div className="flex-1 min-w-0" data-tour="wt-builder-canvas">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          {builderT("titles.builder")}
        </h3>

        <div
          ref={dropZoneRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`min-h-[400px] rounded-[--radius] border border-dashed transition-all ${
            isDraggingOver
              ? "border-blue-400 bg-muted"
              : "border-border bg-muted"
          }`}
        >
          {components.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-center p-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <Plus className="h-8 w-8 text-muted-foreground" weight="bold" />
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                {builderT("emptyState.title")}
              </p>
              <p className="text-xs text-muted-foreground max-w-xs">
                {builderT("emptyState.description")}
              </p>
            </div>
          ) : (
            <Reorder.Group
              axis="y"
              values={components}
              onReorder={onChange}
              className="p-4 space-y-3"
            >
              <AnimatePresence mode="popLayout">
                {components.map((component) => {
                  const Icon = getComponentIcon(component.type);
                  const color = getComponentColor(component.type);
                  const isSelected = selectedComponentId === component.id;

                  return (
                    <Reorder.Item
                      key={component.id}
                      value={component}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -50 }}
                      whileDrag={{
                        scale: 1.02,
                        boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                      }}
                      className={`group relative rounded-[--radius] border bg-card p-4 transition-all cursor-move ${
                        isSelected
                          ? `border-${color}-400 shadow-lg`
                          : "border-border hover:border-foreground/20 hover:shadow-md"
                      }`}
                      onClick={() => onComponentSelect?.(component)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center">
                          <DotsSixVertical
                            className="h-6 w-6 text-muted-foreground group-hover:text-muted-foreground transition-colors"
                            weight="bold"
                          />
                        </div>

                        <div
                          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-${color}-100`}
                        >
                          <Icon
                            className={`h-5 w-5 text-${color}-600`}
                            weight="duotone"
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-semibold text-foreground text-sm">
                              {componentTypeT(component.type)}
                            </h4>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveComponent(component.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                            >
                              <Trash className="h-4 w-4" weight="bold" />
                            </button>
                          </div>
                          <ComponentPreview component={component} />
                        </div>
                      </div>
                    </Reorder.Item>
                  );
                })}
              </AnimatePresence>
            </Reorder.Group>
          )}
        </div>
      </div>
    </div>
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
    const buttonCount = data.buttons?.length || 0;
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Cursor className="h-4 w-4" />
        <span>{builderT("preview.buttons.count", { count: buttonCount })}</span>
      </div>
    );
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
