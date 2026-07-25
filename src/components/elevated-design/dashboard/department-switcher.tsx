"use client";

import * as React from "react";

import { AnimatePresence, motion } from "framer-motion";
import {
  CaretDown,
  Check,
  MagnifyingGlass,
  TreeStructure,
  X,
} from "@phosphor-icons/react";

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
    return (
      <div className="flex h-9 w-36 animate-pulse items-center rounded-xl bg-muted" />
    );
  }

  const label = currentDepartment?.name ?? t("allDepartments");

  return (
    <div className={cn("relative", fullWidth && "w-full")} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2.5 rounded-xl px-3 py-2 transition-all",
          "border border-border/80 bg-card/80 shadow-sm",
          "hover:border-primary/40 hover:shadow-md hover:shadow-primary/5",
          isOpen && "border-primary/40 shadow-md shadow-primary/5",
          fullWidth && "w-full",
        )}
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 text-white shadow-sm shadow-primary/20">
          <TreeStructure className="h-3.5 w-3.5" weight="fill" />
        </div>
        <span
          className={cn(
            "max-w-[120px] truncate text-sm font-medium text-foreground",
            fullWidth ? "flex-1 text-left max-w-none" : "hidden md:block",
          )}
        >
          {label}
        </span>
        <CaretDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
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
              "absolute left-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xl shadow-black/10",
              fullWidth ? "w-full" : "w-72",
            )}
          >
            <div className="space-y-2 border-b border-border px-3 py-2.5">
              <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2">
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
        "flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-all",
        isSelected ? "bg-primary/5" : "hover:bg-muted",
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg",
          isSelected
            ? "bg-primary text-white"
            : "bg-muted text-muted-foreground",
        )}
      >
        <TreeStructure className="h-4 w-4" weight="fill" />
      </div>

      <div className="min-w-0 flex-1 text-left">
        <p
          className={cn(
            "truncate text-sm font-medium",
            isSelected ? "text-primary" : "text-foreground",
          )}
        >
          {name}
        </p>
        {description && (
          <p className="truncate text-[11px] text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      {isSelected && (
        <Check className="h-4 w-4 shrink-0 text-primary" weight="bold" />
      )}
    </button>
  );
}
