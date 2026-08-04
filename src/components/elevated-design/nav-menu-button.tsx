"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { CaretDown } from "@/components/icons";
import type { Icon } from "@/components/icons";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useState } from "react";

export interface NavMenuItem {
  label: string;
  href?: string;
  description?: string;
  items?: Array<{
    label: string;
    href: string;
    description?: string;
    icon?: Icon;
  }>;
}

interface NavMenuButtonProps {
  item: NavMenuItem;
  tone?: "light" | "dark";
}

const itemMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 4 },
};

export function NavMenuButton({ item, tone = "light" }: NavMenuButtonProps) {
  const [open, setOpen] = useState(false);

  if (!item.items?.length) {
    return (
      <Link
        href={item.href ?? "#"}
        className={cn(
          "px-3 py-1.5 rounded-[8px] text-sm font-medium transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2",
          tone === "dark"
            ? "text-white/80 hover:bg-white/10 hover:text-white focus-visible:ring-white/40"
            : "text-muted-foreground hover:bg-black/5 hover:text-foreground focus-visible:ring-gray-300"
        )}
      >
        {item.label}
      </Link>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "group px-3 py-1.5 rounded-[8px] text-sm font-medium transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2",
            tone === "dark"
              ? open
                ? "bg-white/10 text-white focus-visible:ring-white/40"
                : "text-white/80 hover:bg-white/10 hover:text-white focus-visible:ring-white/40"
              : open
              ? "bg-black/5 text-foreground focus-visible:ring-gray-300"
              : "text-muted-foreground hover:bg-black/5 hover:text-foreground focus-visible:ring-gray-300"
          )}
        >
          <span className="flex items-center gap-1.5">
            {item.label}
            <CaretDown
              weight="bold"
              className={cn(
                "h-4 w-4 transition-transform duration-200 ease-out",
                open ? "rotate-180" : "rotate-0",
                tone === "dark"
                  ? "text-white/70 group-hover:text-white"
                  : "text-muted-foreground group-hover:text-foreground"
              )}
            />
          </span>
        </button>
      </PopoverTrigger>
      <AnimatePresence>
        {open ? (
          <PopoverContent
            align="start"
            sideOffset={12}
            className={cn(
              "w-72 rounded-[--radius] p-3",
              tone === "dark"
                ? "border-white/10 bg-black text-white shadow-[0_25px_60px_-25px_rgba(0,0,0,0.6)]"
                : "border border-black/5 bg-card p-3 shadow-[0_25px_60px_-25px_rgba(15,23,42,0.25)]"
            )}
            forceMount
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{
                opacity: 0,
                y: 8,
                scale: 0.98,
                transition: { duration: 0.12, ease: [0.4, 0, 0.2, 1] },
              }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col gap-3"
            >
              {item.description ? (
                <motion.p
                  className="px-2 text-sm text-muted-foreground"
                  initial={itemMotion.initial}
                  animate={itemMotion.animate}
                  exit={itemMotion.exit}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                >
                  {item.description}
                </motion.p>
              ) : null}

              <div className="flex flex-col gap-2">
                {item.items.map((linkItem) => {
                  const Icon = linkItem.icon;
                  return (
                    <motion.div
                      key={linkItem.href}
                      initial={itemMotion.initial}
                      animate={itemMotion.animate}
                      exit={itemMotion.exit}
                      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <Link
                        href={linkItem.href}
                        className={cn(
                          "flex items-center gap-3 rounded-[--radius] border border-transparent px-3 py-2 transition-all duration-150 ease-out",
                          tone === "dark"
                            ? "hover:border-white/10 hover:bg-white/6"
                            : "hover:border-black/5 hover:bg-black/5"
                        )}
                        onClick={() => setOpen(false)}
                      >
                        {Icon ? (
                          <span
                            className={cn(
                              "flex h-10 w-10 items-center justify-center rounded-[--radius]",
                              tone === "dark"
                                ? "bg-white/5 text-white/80"
                                : "bg-muted text-foreground"
                            )}
                          >
                            <Icon className="h-5 w-5" strokeWidth={1.8} />
                          </span>
                        ) : null}
                        <span className="flex flex-col text-left">
                          <span
                            className={cn(
                              "text-sm font-semibold",
                              tone === "dark" ? "text-white" : "text-foreground"
                            )}
                          >
                            {linkItem.label}
                          </span>
                          {linkItem.description ? (
                            <span
                              className={cn(
                                "text-xs",
                                tone === "dark"
                                  ? "text-white/80"
                                  : "text-muted-foreground"
                              )}
                            >
                              {linkItem.description}
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          </PopoverContent>
        ) : null}
      </AnimatePresence>
    </Popover>
  );
}
