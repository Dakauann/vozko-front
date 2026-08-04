"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";
import { locales, localeNames, localeFlags, type Locale } from "@/i18n/config";
import { GlobeSimple } from "@/components/icons";
import { cn } from "@/lib/utils";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "./elevated-design/elevated-select";
import Button from "./elevated-design/button";

type LanguageSwitcherProps = {
  variant?: "dropdown" | "inline";
  className?: string;
  tone?: "light" | "dark";
  size?: "sm" | "default";
};

export default function LanguageSwitcher({
  variant = "dropdown",
  className = "",
  tone = "light",
  size = "default",
}: LanguageSwitcherProps) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  const isDark = tone === "dark";
  const isSmall = size === "sm";

  const handleLocaleChange = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale as Locale });
  };

  if (variant === "inline") {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        {locales.map((loc) => (
          <button
            key={loc}
            onClick={() => handleLocaleChange(loc)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all duration-200",
              locale === loc
                ? isDark
                  ? "bg-white/15 text-white"
                  : "bg-muted text-foreground"
                : isDark
                  ? "text-white/60 hover:text-white hover:bg-white/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
          >
            <span>{localeFlags[loc]}</span>
            <span className="hidden sm:inline">{loc.toUpperCase()}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <ElevatedSelect
      value={locale}
      onValueChange={handleLocaleChange}
      className={className}
      contentClassName={cn(isDark && "bg-black border-white/10 text-white")}
      trigger={
        <Button
          variant="ghost"
          size={isSmall ? "sm" : "default"}
          className={cn(
            "flex items-center gap-1 focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
            isDark
              ? "text-white/80 hover:text-white hover:bg-white/10"
              : "text-muted-foreground hover:text-foreground hover:bg-muted",
          )}
          aria-label="Select language"
          title={localeNames[locale]}
          icon={
            <GlobeSimple
              weight="bold"
              className={cn(isSmall ? "h-3.5 w-3.5" : "h-4 w-4")}
            />
          }
          iconVisible
          iconSide="left"
        />
      }
    >
      {locales.map((loc) => (
        <ElevatedSelectItem
          key={loc}
          value={loc}
          icon={<span className="text-lg">{localeFlags[loc]}</span>}
          iconStyled={false}
          className={cn(
            "px-3 py-2",
            isDark &&
              "text-white/80 hover:bg-white/10 hover:text-white hover:border-l-blue-400 focus:bg-white/10 focus:text-white data-[state=checked]:bg-white/10 data-[state=checked]:text-white",
          )}
        >
          {localeNames[loc]}
        </ElevatedSelectItem>
      ))}
    </ElevatedSelect>
  );
}
