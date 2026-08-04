"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ChatText,
  CursorClick,
  Image,
  Lightning,
  Plus,
} from "@/components/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Button from "@/components/elevated-design/button";
import type { MessageShortcut } from "@/lib/message-shortcuts/types";
import { listMessageShortcutsAction } from "@/app/actions/message-shortcuts";
import { useTranslations } from "next-intl";

interface ShortcutPickerProps {
  query: string;
  onSelect: (shortcut: MessageShortcut) => void;
  onClose: () => void;
  visible: boolean;
  canCreate?: boolean;
  onCreateShortcut?: (shortcut: string) => void;
  refreshToken?: number;
}

export default function ShortcutPicker({
  query,
  onSelect,
  onClose,
  visible,
  canCreate = false,
  onCreateShortcut,
  refreshToken = 0,
}: ShortcutPickerProps) {
  const [shortcuts, setShortcuts] = useState<MessageShortcut[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("shortcutPicker");

  useEffect(() => {
    if (!visible) return;

    let active = true;
    setLoading(true);
    listMessageShortcutsAction().then((res) => {
      if (!active) return;
      if (!res.error) {
        setShortcuts(res.shortcuts);
      }
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [refreshToken, visible]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return shortcuts.filter(
      (s) =>
        s.shortcut.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q),
    );
  }, [shortcuts, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!visible) return;

      if (filtered.length === 0) {
        if (
          canCreate &&
          onCreateShortcut &&
          (e.key === "Enter" || e.key === "Tab")
        ) {
          e.preventDefault();
          onCreateShortcut(query);
        } else if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        onSelect(filtered[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [
      visible,
      filtered,
      selectedIndex,
      onSelect,
      onClose,
      canCreate,
      onCreateShortcut,
      query,
    ],
  );

  useEffect(() => {
    if (!visible) return;
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [visible, handleKeyDown]);

  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as
      | HTMLElement
      | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const typeIcon = (type: string) => {
    switch (type) {
      case "button":
        return (
          <CursorClick weight="fill" className="h-3.5 w-3.5 text-blue-500" />
        );
      case "media":
        return <Image weight="fill" className="h-3.5 w-3.5 text-healthy" />;
      default:
        return (
          <ChatText
            weight="fill"
            className="h-3.5 w-3.5 text-muted-foreground"
          />
        );
    }
  };

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        transition={{ duration: 0.12 }}
        className="absolute bottom-full left-0 right-0 z-50 mb-1 max-h-[220px] overflow-y-auto rounded-lg border border-border bg-card shadow-lg"
      >
        {loading ? (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">
            {t("loading")}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-4 text-center">
            <p className="text-xs text-muted-foreground">{t("empty")}</p>
            {canCreate && onCreateShortcut ? (
              <Button
                className="mt-3"
                variant="outline"
                size="sm"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onCreateShortcut(query);
                }}
                title={
                  query
                    ? t("createWithQuery", { shortcut: `/${query}` })
                    : t("create")
                }
                icon={<Plus weight="bold" className="h-3.5 w-3.5" />}
                iconVisible
              />
            ) : null}
          </div>
        ) : (
          <div ref={listRef} className="py-1">
            <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border">
              <Lightning weight="fill" className="h-3 w-3 text-warning" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t("header")}
              </span>
            </div>
            {filtered.map((shortcut, i) => (
              <button
                key={shortcut.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(shortcut);
                }}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                  i === selectedIndex
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted"
                }`}
              >
                {typeIcon(shortcut.messageType)}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      /{shortcut.shortcut}
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate">
                      {shortcut.name}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                    {shortcut.content.text || shortcut.content.headerText || ""}
                  </p>
                </div>
                <span className="flex-shrink-0 rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                  {shortcut.messageType}
                </span>
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
