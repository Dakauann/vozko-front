"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, PencilSimple, Plus, Trash, X } from "@/components/icons";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";


const DEFAULT_PRESET_COLORS = [
  "#3B82F6", // blue
  "#10B981", // emerald
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#F97316", // orange
  "#84CC16", // lime
  "#6366F1", // indigo
  "#14B8A6", // teal
  "#A855F7", // purple
];


export interface ColoredItem {
  id: string;
  name: string;
  description?: string;
  color: string;
  position: number;
}

export interface ElevatedListManagerProps<T extends ColoredItem> {
  items: T[];
  onItemsChange?: (items: T[]) => void;
  trigger: ReactNode;
  title?: string;
  createDescriptionPlaceholder?: string;
  createPlaceholder?: string;
  createLabel?: string;
  emptyMessage?: string;
  accent?: "emerald" | "violet" | "blue" | "rose" | "amber";
  presetColors?: string[];
  onCreate?: (
    name: string,
    color: string,
    description: string,
  ) => Promise<T | null>;
  onUpdate?: (
    id: string,
    data: { name?: string; color?: string; description?: string },
  ) => Promise<T | null>;
  onDelete?: (id: string) => Promise<boolean>;
  renderItemActions?: (item: T) => ReactNode;
  renderItemBadge?: (item: T) => ReactNode;
  canDelete?: (item: T) => boolean;
  canEdit?: (item: T) => boolean;
  align?: "left" | "right";
  className?: string;
  readonly?: boolean;
}


const accentMap = {
  emerald: {
    focusBorder: "focus:border-emerald-300",
    focusRing: "focus:ring-emerald-100",
    confirmBg: "bg-healthy hover:bg-healthy",
    selectedRing: "ring-2 ring-emerald-500 ring-offset-1",
    createText: "text-healthy",
    createHover: "hover:bg-healthy/10/40",
  },
  violet: {
    focusBorder: "focus:border-violet-300",
    focusRing: "focus:ring-violet-100",
    confirmBg: "bg-muted hover:bg-muted",
    selectedRing: "ring-2 ring-violet-500 ring-offset-1",
    createText: "text-muted-foreground",
    createHover: "hover:bg-muted",
  },
  blue: {
    focusBorder: "focus:border-blue-300",
    focusRing: "focus:ring-ring",
    confirmBg: "bg-muted hover:bg-muted",
    selectedRing: "ring-2 ring-blue-500 ring-offset-1",
    createText: "text-lamp-ink",
    createHover: "hover:bg-muted",
  },
  rose: {
    focusBorder: "focus:border-rose-300",
    focusRing: "focus:ring-rose-100",
    confirmBg: "bg-destructive hover:bg-destructive",
    selectedRing: "ring-2 ring-rose-500 ring-offset-1",
    createText: "text-destructive",
    createHover: "hover:bg-destructive/10/40",
  },
  amber: {
    focusBorder: "focus:border-amber-300",
    focusRing: "focus:ring-amber-100",
    confirmBg: "bg-warning hover:bg-warning",
    selectedRing: "ring-2 ring-amber-500 ring-offset-1",
    createText: "text-warning",
    createHover: "hover:bg-warning/10/40",
  },
} as const;


export default function ElevatedListManager<T extends ColoredItem>({
  items,
  onItemsChange,
  trigger,
  title,
  createDescriptionPlaceholder = "Descrição...",
  createPlaceholder = "Name...",
  createLabel = "Create new",
  emptyMessage,
  accent = "emerald",
  presetColors = DEFAULT_PRESET_COLORS,
  onCreate,
  onUpdate,
  onDelete,
  renderItemActions,
  renderItemBadge,
  canDelete = () => true,
  canEdit = () => true,
  align = "right",
  className,
  readonly: readonlyProp,
}: ElevatedListManagerProps<T>) {
  const isReadonly = readonlyProp ?? (!onCreate && !onUpdate && !onDelete);
  const colors = accentMap[accent];

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editColor, setEditColor] = useState("");
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newColor, setNewColor] = useState(presetColors[0]);
  const [loading, setLoading] = useState(false);
  const newNameInputRef = useRef<HTMLInputElement>(null);
  const editNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creating) newNameInputRef.current?.focus();
  }, [creating]);

  useEffect(() => {
    if (editingId) editNameInputRef.current?.focus();
  }, [editingId]);


  const handleCreate = useCallback(async () => {
    if (!newName.trim() || !newDescription.trim() || loading || !onCreate)
      return;
    setLoading(true);
    const created = await onCreate(
      newName.trim(),
      newColor,
      newDescription.trim(),
    );
    if (created && onItemsChange) {
      onItemsChange([...items, created]);
    }
    setNewName("");
    setNewDescription("");
    setNewColor(presetColors[0]);
    setCreating(false);
    setLoading(false);
  }, [
    newName,
    newDescription,
    newColor,
    items,
    onItemsChange,
    loading,
    onCreate,
    presetColors,
  ]);

  const handleUpdate = useCallback(
    async (itemId: string) => {
      if (loading || !onUpdate) return;
      const data: { name?: string; color?: string; description?: string } = {};
      const existing = items.find((i) => i.id === itemId);
      if (!existing) return;

      if (editName.trim() && editName.trim() !== existing.name) {
        data.name = editName.trim();
      }
      if (editColor && editColor !== existing.color) {
        data.color = editColor;
      }
      if (editDescription.trim() !== existing.description) {
        data.description = editDescription.trim();
      }
      if (Object.keys(data).length === 0) {
        setEditingId(null);
        return;
      }

      setLoading(true);
      const updated = await onUpdate(itemId, data);
      if (updated && onItemsChange) {
        onItemsChange(items.map((i) => (i.id === itemId ? updated : i)));
      }
      setEditingId(null);
      setLoading(false);
    },
    [
      editName,
      editDescription,
      editColor,
      items,
      onItemsChange,
      loading,
      onUpdate,
    ],
  );

  const handleDelete = useCallback(
    async (itemId: string) => {
      if (loading || !onDelete) return;
      setLoading(true);
      const success = await onDelete(itemId);
      if (success && onItemsChange) {
        onItemsChange(items.filter((i) => i.id !== itemId));
      }
      setLoading(false);
    },
    [items, onItemsChange, loading, onDelete],
  );

  const startEdit = useCallback((item: ColoredItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditColor(item.color);
    setEditDescription(item.description ?? "");
    setShowColorPicker(null);
  }, []);

  const closeAll = useCallback(() => {
    setOpen(false);
    setCreating(false);
    setEditingId(null);
    setShowColorPicker(null);
  }, []);

  const sortedItems = [...items].sort((a, b) => a.position - b.position);

  return (
    <div className="relative">
      {/* Trigger */}
      <div onClick={() => setOpen((o) => !o)} className="cursor-pointer">
        {trigger}
      </div>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40" onClick={closeAll} />

            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className={cn(
                "absolute top-full z-50 mt-1.5 w-72 overflow-hidden rounded-[--radius] border border-border bg-card shadow-xl",
                align === "right" ? "right-0" : "left-0",
                className,
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
                {title && (
                  <span className="text-xs font-semibold text-foreground">
                    {title}
                  </span>
                )}
                <button
                  onClick={closeAll}
                  className="text-muted-foreground hover:text-muted-foreground transition-colors"
                >
                  <X weight="bold" className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* List */}
              <div className="max-h-72 overflow-y-auto py-1">
                {sortedItems.length === 0 && !creating && emptyMessage && (
                  <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                    {emptyMessage}
                  </div>
                )}

                {sortedItems.map((item) => (
                  <div key={item.id} className="group">
                    {!isReadonly && editingId === item.id ? (
                      <div className="px-3 py-2 space-y-2 bg-muted">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              setShowColorPicker(
                                showColorPicker === item.id ? null : item.id,
                              )
                            }
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border transition-colors hover:bg-muted"
                          >
                            <span
                              className="h-4 w-4 rounded-full ring-1 ring-black/5"
                              style={{ backgroundColor: editColor }}
                            />
                          </button>
                          <input
                            ref={editNameInputRef}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleUpdate(item.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            className={cn(
                              "flex-1 rounded-lg border border-border bg-card px-2 py-1 text-xs text-foreground outline-none focus:ring-1",
                              colors.focusBorder,
                              colors.focusRing,
                            )}
                          />
                          <button
                            onClick={() => handleUpdate(item.id)}
                            disabled={loading}
                            className={cn(
                              "flex h-7 w-7 items-center justify-center rounded-lg text-white transition-colors disabled:opacity-50",
                              colors.confirmBg,
                            )}
                          >
                            <Check weight="bold" className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
                          >
                            <X weight="bold" className="h-3 w-3" />
                          </button>
                        </div>

                        {/* Description */}
                        <textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          placeholder={
                            createDescriptionPlaceholder ?? "Description"
                          }
                          rows={2}
                          className={cn(
                            "w-full rounded-lg border border-border bg-card px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 resize-none",
                            colors.focusBorder,
                            colors.focusRing,
                          )}
                        />

                        {/* Color picker */}
                        <AnimatePresence>
                          {showColorPicker === item.id && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="grid grid-cols-6 gap-1.5 py-1">
                                {presetColors.map((color) => (
                                  <button
                                    key={color}
                                    onClick={() => {
                                      setEditColor(color);
                                      setShowColorPicker(null);
                                    }}
                                    className={cn(
                                      "h-6 w-6 rounded-full ring-1 ring-black/5 transition-all duration-150",
                                      editColor === color &&
                                        colors.selectedRing,
                                    )}
                                    style={{ backgroundColor: color }}
                                  />
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted transition-colors">
                        <span
                          className="h-3 w-3 rounded-full flex-shrink-0 ring-1 ring-black/5"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="flex-1 truncate text-xs font-medium text-foreground">
                          {item.name}
                        </span>
                        {renderItemBadge?.(item)}
                        {(!isReadonly || renderItemActions) && (
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {renderItemActions?.(item)}
                            {!isReadonly && canEdit(item) && (
                              <button
                                onClick={() => startEdit(item)}
                                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-muted-foreground transition-colors"
                              >
                                <PencilSimple
                                  weight="bold"
                                  className="h-3 w-3"
                                />
                              </button>
                            )}
                            {!isReadonly && canDelete(item) && (
                              <button
                                onClick={() => handleDelete(item.id)}
                                disabled={loading}
                                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-red-500 transition-colors disabled:opacity-50"
                              >
                                <Trash weight="bold" className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Create new */}
              {!isReadonly && (
                <div className="border-t border-border">
                  <AnimatePresence mode="wait">
                    {creating ? (
                      <motion.div
                        key="create-form"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden px-3 py-2.5 space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              setShowColorPicker(
                                showColorPicker === "__new__"
                                  ? null
                                  : "__new__",
                              )
                            }
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border transition-colors hover:bg-muted"
                          >
                            <span
                              className="h-4 w-4 rounded-full ring-1 ring-black/5"
                              style={{ backgroundColor: newColor }}
                            />
                          </button>
                          <input
                            ref={newNameInputRef}
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleCreate();
                              if (e.key === "Escape") setCreating(false);
                            }}
                            placeholder={createPlaceholder}
                            className={cn(
                              "flex-1 rounded-lg border border-border bg-card px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1",
                              colors.focusBorder,
                              colors.focusRing,
                            )}
                          />
                          <button
                            onClick={handleCreate}
                            disabled={
                              loading ||
                              !newName.trim() ||
                              !newDescription.trim()
                            }
                            className={cn(
                              "flex h-7 w-7 items-center justify-center rounded-lg text-white transition-colors disabled:opacity-50",
                              colors.confirmBg,
                            )}
                          >
                            <Check weight="bold" className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => setCreating(false)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
                          >
                            <X weight="bold" className="h-3 w-3" />
                          </button>
                        </div>

                        {/* Description */}
                        <textarea
                          value={newDescription}
                          onChange={(e) => setNewDescription(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") setCreating(false);
                          }}
                          placeholder={
                            createDescriptionPlaceholder ?? "Description"
                          }
                          rows={2}
                          className={cn(
                            "w-full rounded-lg border border-border bg-card px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 resize-none",
                            colors.focusBorder,
                            colors.focusRing,
                          )}
                        />

                        <AnimatePresence>
                          {showColorPicker === "__new__" && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="grid grid-cols-6 gap-1.5 py-1">
                                {presetColors.map((color) => (
                                  <button
                                    key={color}
                                    onClick={() => {
                                      setNewColor(color);
                                      setShowColorPicker(null);
                                    }}
                                    className={cn(
                                      "h-6 w-6 rounded-full ring-1 ring-black/5 transition-all duration-150",
                                      newColor === color && colors.selectedRing,
                                    )}
                                    style={{ backgroundColor: color }}
                                  />
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ) : (
                      <motion.button
                        key="create-btn"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setCreating(true)}
                        className={cn(
                          "flex w-full items-center gap-2 px-3 py-2.5 text-xs font-medium transition-colors",
                          colors.createText,
                          colors.createHover,
                        )}
                      >
                        <Plus weight="bold" className="h-3.5 w-3.5" />
                        {createLabel}
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
