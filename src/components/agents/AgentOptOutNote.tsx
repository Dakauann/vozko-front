"use client";

import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { Plus } from "@/components/icons";
import { Notice } from "@/components/ui/notice";
import { ExitRiskList } from "@/components/whatsapp/exit/ExitRiskAcknowledgement";
import { missingOptOutSkill } from "@/lib/agents/opt-out-skill";

interface SkillTool {
  name: string;
  displayName?: string;
}

export function AgentOptOutNote<Tool extends SkillTool>({
  tools,
  selected,
  onAdd,
  disabled,
}: {
  tools: readonly Tool[];
  selected: readonly { name: string }[];
  onAdd: (tool: Tool) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("leadExit.agentNote");
  const tool = missingOptOutSkill(tools, selected);
  if (!tool) return null;
  const name = tool.displayName || tool.name;
  return (
    <Notice tone="info" title={t("title", { name })}>
      <p className="text-muted-foreground">{t("body")}</p>
      <ExitRiskList />
      <div className="pt-2">
        <Button
          type="button"
          variant="outline-subtle"
          size="sm"
          title={t("add", { name })}
          icon={<Plus className="h-3.5 w-3.5" weight="bold" />}
          iconSide="left"
          onClick={() => onAdd(tool)}
          disabled={disabled}
        />
      </div>
    </Notice>
  );
}
