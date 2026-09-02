"use client";

import * as React from "react";

import { AnimatePresence, motion } from "framer-motion";
import {
  CaretDown,
  Check,
  MagnifyingGlass,
  TreeStructure,
  X,
} from "@/components/icons";

import { cn } from "@/lib/utils";
import { useDepartment } from "@/contexts/department-context";
import { useTranslations } from "next-intl";

export function DepartmentSwitcher({
  fullWidth = false,
}: { fullWidth?: boolean } = {}) {
  const t = useTranslations("department");
  const {
    departments,
    currentDepartment,
    isLoading,
    switchDepartment,
    isLocked,
  } = useDepartment();

  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);

  const filteredDepartments = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return departments;
    }

    return departments.filter((department) => {
      const name = department.name.toLowerCase();
      const description = department.description?.toLowerCase() ?? "";
      return name.includes(query) || description.includes(query);
    });
  }, [departments, search]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  React.useEffect(() => {
    if (isOpen && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 100);
    }

    if (!isOpen) {
      setSearch("");
    }
  }, [isOpen]);

  if (!isLoading && departments.length === 0) {
    return null;
  }

  if (isLoading) {
    return <div className="h-8 w-32 animate-pulse rounded-[--radius] bg-muted" />;
  }

  const label = currentDepartment?.name ?? t("allDepartments");

  return (
    <div className={cn("relative", fullWidth && "w-full")} ref={dropdownRef}>
      {/*
        A scope chip, not a card. Department filters the current view (workspace,
        which scopes the whole app, lives at the spine head instead), so this
        reads as one control in the bar's rack rather than a second identity.
        The solid accent tile is gone: accent means state here, and a filter at
        rest is not a state.
      */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-[--radius] px-2 transition-colors",
          isOpen ? "bg-muted" : "hover:bg-muted",
          fullWidth && "w-full border border-border",
        )}
      >
        <TreeStructure
          className="h-4 w-4 shrink-0 text-muted-foreground"
          weight="regular"
        />
        <span
          className={cn(
            "max-w-[120px] truncate text-sm text-foreground",
            fullWidth ? "max-w-none flex-1 text-left" : "hidden lg:block",
          )}
        >
          {label}
        </span>
        <CaretDown
          className={cn(
            "h-3 w-3 shrink-0 text-muted-foreground transition-transform",
            isOpen && "rotate-180",
            fullWidth && "ml-auto",
          )}
          weight="bold"
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={cn(
              "absolute left-0 top-full z-50 mt-2 overflow-hidden rounded-[--radius] border border-border bg-card shadow-xl",
              fullWidth ? "w-full" : "w-72",
            )}
          >
            <div className="space-y-2 border-b border-border px-3 py-2.5">
              <div className="flex items-center gap-2 rounded-[--radius] bg-muted px-3 py-2">
                <MagnifyingGlass
                  className="h-4 w-4 text-muted-foreground"
                  weight="bold"
                />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("search")}
                  className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
                {search && (
                  <button onClick={() => setSearch("")}>
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto p-1.5">
              {!isLocked &&
                (!search ||
                  t("allDepartments")
                    .toLowerCase()
                    .includes(search.toLowerCase())) && (
                  <DepartmentItem
                    name={t("allDepartments")}
                    isSelected={currentDepartment === null}
                    onSelect={() => {
                      switchDepartment(null);
                      setIsOpen(false);
                      setSearch("");
                    }}
                  />
                )}

              {filteredDepartments.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {t("noResults")}
                </div>
              ) : (
                filteredDepartments.map((department) => (
                  <DepartmentItem
                    key={department.id}
                    name={department.name}
                    description={department.description}
                    isSelected={currentDepartment?.id === department.id}
                    onSelect={() => {
                      switchDepartment(department);
                      setIsOpen(false);
                      setSearch("");
                    }}
                  />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DepartmentItem({
  name,
  description,
  isSelected,
  onSelect,
}: {
  name: string;
  description?: string;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-[--radius] p-2.5 text-left transition-all",
        // Neutral opaque ground; the glyph carries the green.
        isSelected ? "bg-muted text-foreground" : "hover:bg-muted",
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg",
          // The tile lifts to --card so it still separates from the selected
          // row's own --muted ground.
          isSelected ? "bg-card text-primary-ink" : "bg-muted text-muted-foreground",
        )}
      >
        <TreeStructure className="h-4 w-4" weight="fill" />
      </div>

      <div className="min-w-0 flex-1 text-left">
        <p
          className={cn(
            "truncate text-sm font-medium",
            isSelected ? "font-semibold text-foreground" : "text-foreground",
          )}
        >
          {name}
        </p>
        {description && (
          <p className="truncate text-2xs text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      {isSelected && (
        <Check className="h-4 w-4 shrink-0 text-primary-ink" weight="bold" />
      )}
    </button>
  );
}
