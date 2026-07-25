"use client";

import { Monitor, Moon, Sun } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";

interface ThemeToggleProps {
  className?: string;
  variant?: "icon" | "switch" | "dropdown";
}

export function ThemeToggle({ className, variant = "icon" }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          className,
        )}
        aria-label="Toggle theme"
      >
        <Sun className="h-4 w-4" weight="bold" />
      </button>
    );
  }

  if (variant === "switch") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-border bg-muted p-1",
          className,
        )}
      >
        {[
          { value: "light", icon: Sun, label: "Light" },
          { value: "dark", icon: Moon, label: "Dark" },
          { value: "system", icon: Monitor, label: "System" },
        ].map(({ value, icon: Icon, label }) => (
          <button
            key={value}
            onClick={() => setTheme(value)}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-full transition-all",
              theme === value
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-label={label}
            title={label}
          >
            <Icon
              className="h-3.5 w-3.5"
              weight={theme === value ? "fill" : "bold"}
            />
          </button>
        ))}
      </div>
    );
  }

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  return (
    <button
      onClick={cycleTheme}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
      aria-label={`Current theme: ${theme}. Click to change.`}
      title={`Theme: ${theme}`}
    >
      {theme === "dark" ? (
        <Moon className="h-4 w-4" weight="fill" />
      ) : theme === "light" ? (
        <Sun className="h-4 w-4" weight="fill" />
      ) : (
        <Monitor className="h-4 w-4" weight="fill" />
      )}
    </button>
  );
}
