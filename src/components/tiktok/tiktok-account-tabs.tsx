"use client";

import { ChatCircleDots, GridFour, Robot, UsersThree } from "@/components/icons";
import type { ComponentType } from "react";
import { useTranslations } from "next-intl";

import { CommentAnalysisTab } from "@/components/audience/tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/elevated-design/elevated-tabs";
import { useWorkspace } from "@/contexts/workspace-context";
import { commentManageBlock } from "@/lib/tiktok/account";
import { TIKTOK_COMMENT_SOURCE } from "@/lib/tiktok/channel";
import type { TiktokAccount } from "@/lib/tiktok/types";

import { TiktokAutomationTab } from "./tiktok-automation-tab";
import { TiktokCommentRulesPanel } from "./tiktok-comment-rules-panel";
import { TiktokVideosTab } from "./tiktok-videos-tab";

export interface TiktokAccountTabProps {
  account: TiktokAccount;
  canUpdate: boolean;
  onUpdated: (account: TiktokAccount) => void;
}

type TiktokAccountTabId = "videos" | "commentRules" | "automation" | "audience";

interface TiktokAccountTab {
  id: TiktokAccountTabId;
  Icon: ComponentType<{ className?: string; weight?: "fill" }>;
  Content: ComponentType<TiktokAccountTabProps>;
  needsAudience?: boolean;
}

function TiktokAccountRulesTab({ account, canUpdate }: TiktokAccountTabProps) {
  return <TiktokCommentRulesPanel accountId={account.id} block={commentManageBlock(account, canUpdate)} />;
}

function TiktokAudienceTab({ account }: TiktokAccountTabProps) {
  return <CommentAnalysisTab source={TIKTOK_COMMENT_SOURCE} accountId={account.id} />;
}

const TIKTOK_ACCOUNT_TABS: readonly TiktokAccountTab[] = [
  { id: "videos", Icon: GridFour, Content: TiktokVideosTab },
  { id: "commentRules", Icon: ChatCircleDots, Content: TiktokAccountRulesTab },
  { id: "automation", Icon: Robot, Content: TiktokAutomationTab },
  { id: "audience", Icon: UsersThree, Content: TiktokAudienceTab, needsAudience: true },
];

export function TiktokAccountTabs(props: TiktokAccountTabProps) {
  const t = useTranslations("tiktok.account.tabs");
  const { can } = useWorkspace();
  const canSeeAudience = can("audience", "read");
  const tabs = TIKTOK_ACCOUNT_TABS.filter((tab) => !tab.needsAudience || canSeeAudience);
  const [first] = tabs;
  return (
    <Tabs defaultValue={first.id}>
      <TabsList>
        {tabs.map(({ id, Icon }) => (
          <TabsTrigger key={id} value={id} className="gap-1.5">
            <Icon className="h-4 w-4" weight="fill" />
            {t(id)}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map(({ id, Content }) => (
        <TabsContent key={id} value={id} className="mt-4">
          <Content {...props} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
