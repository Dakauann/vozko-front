"use client";

import { ChatCircleDots, Robot, Storefront, TreeStructure } from "@/components/icons";
import type { ComponentType } from "react";
import { useTranslations } from "next-intl";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/elevated-design/elevated-tabs";
import type { MercadoLivreAccount } from "@/lib/mercadolivre/types";

import { MercadoLivreAutomationTab } from "./mercadolivre-automation-tab";
import { MercadoLivreListingsTab } from "./mercadolivre-listings-tab";
import { MercadoLivreQuestionsTab } from "./mercadolivre-questions-tab";
import { MercadoLivreRulesTab } from "./mercadolivre-rules-tab";

export interface MercadoLivreAccountTabProps {
  account: MercadoLivreAccount;
  canUpdate: boolean;
  onUpdated: (account: MercadoLivreAccount) => void;
}

export type MercadoLivreAccountTabLabel = "questions" | "listings" | "rules" | "automation";

export interface MercadoLivreAccountTab {
  id: string;
  label: MercadoLivreAccountTabLabel;
  Icon: ComponentType<{ className?: string; weight?: "fill" }>;
  Content: ComponentType<MercadoLivreAccountTabProps>;
}

export const MERCADOLIVRE_ACCOUNT_TABS: readonly MercadoLivreAccountTab[] = [
  { id: "questions", label: "questions", Icon: ChatCircleDots, Content: MercadoLivreQuestionsTab },
  { id: "listings", label: "listings", Icon: Storefront, Content: MercadoLivreListingsTab },
  { id: "rules", label: "rules", Icon: TreeStructure, Content: MercadoLivreRulesTab },
  { id: "automation", label: "automation", Icon: Robot, Content: MercadoLivreAutomationTab },
];

export function MercadoLivreAccountTabs(props: MercadoLivreAccountTabProps) {
  const t = useTranslations("mercadolivre.account.tabs");
  const [first] = MERCADOLIVRE_ACCOUNT_TABS;
  return (
    <Tabs defaultValue={first.id}>
      <TabsList>
        {MERCADOLIVRE_ACCOUNT_TABS.map(({ id, label, Icon }) => (
          <TabsTrigger key={id} value={id} className="gap-1.5">
            <Icon className="h-4 w-4" weight="fill" />
            {t(label)}
          </TabsTrigger>
        ))}
      </TabsList>
      {MERCADOLIVRE_ACCOUNT_TABS.map(({ id, Content }) => (
        <TabsContent key={id} value={id} className="mt-4">
          <Content {...props} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
