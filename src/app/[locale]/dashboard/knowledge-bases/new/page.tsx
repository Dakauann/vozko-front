"use client";

import { ArrowLeft, Files } from "@/components/icons";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import ElevatedButton from "@/components/elevated-design/button";
import KnowledgeBaseForm from "../KnowledgeBaseForm";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export default function NewKnowledgeBasePage() {
  const router = useRouter();
  const t = useTranslations("knowledgeBase.new");

  return (
    <main className="w-full space-y-6">
      <div>
        <ElevatedButton
          variant="ghost"
          title={t("backButton")}
          icon={<ArrowLeft className="h-4 w-4" weight="bold" />}
          iconVisible
          iconSide="left"
          onClick={() => router.push("/dashboard/knowledge-bases")}
        />
      </div>

      <div>
        <DashboardPageHeader
          icon={<Files className="h-5 w-5" weight="fill" />}
          badge={t("badge")}
          description={t("description")}
        />
      </div>

      <div>
        <KnowledgeBaseForm mode="create" />
      </div>
    </main>
  );
}
