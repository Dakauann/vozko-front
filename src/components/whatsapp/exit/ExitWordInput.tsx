"use client";

import type { ComponentProps } from "react";

import ElevatedInput from "@/components/elevated-design/elevated-input";
import { EXIT_WORD_PREFIX } from "@/lib/whatsapp-templates/exit";

type ExitWordInputProps = Omit<ComponentProps<typeof ElevatedInput>, "icon">;

export function ExitWordInput(props: ExitWordInputProps) {
  return (
    <ElevatedInput
      {...props}
      icon={
        <span aria-hidden className="font-mono text-sm font-semibold text-foreground">
          {EXIT_WORD_PREFIX}
        </span>
      }
    />
  );
}
