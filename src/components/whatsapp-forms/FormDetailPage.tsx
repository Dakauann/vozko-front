"use client";

import { useTranslations } from "next-intl";

import { ScreenLoader } from "@/components/brand/screen-loader";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/elevated-design/elevated-tabs";
import { Files, PencilSimple } from "@/components/icons";
import { Notice } from "@/components/ui/notice";
import { useListQueryState } from "@/hooks/use-list-query-state";
import { useFormAccess, useFormDetail } from "@/hooks/use-whatsapp-forms";
import { useRouter } from "@/i18n/routing";
import { formBuilderHref, formsListHref } from "@/lib/whatsapp-forms/links";
import { RESPONSE_FILTER_PARAMS } from "@/lib/whatsapp-forms/filters";

import { AutomationsTab } from "./detail/AutomationsTab";
import { PerformanceTab } from "./detail/PerformanceTab";
import { ResponsesTab } from "./detail/ResponsesTab";
import { SendsTab } from "./detail/SendsTab";
import { VersionsTab } from "./detail/VersionsTab";
import { PublicationMarks } from "./PublicationMarks";

export const DETAIL_VIEWS = ["responses", "performance", "sends", "automations", "versions"] as const;
type DetailView = (typeof DETAIL_VIEWS)[number];

const NO_SORTS: readonly string[] = [];

export function FormDetailPage({ formId }: { formId: string }) {
  const t = useTranslations("whatsappForms");
  const router = useRouter();
  const access = useFormAccess();
  const query = useFormDetail(formId);
  const state = useListQueryState<string, DetailView>({ sortKeys: NO_SORTS, views: DETAIL_VIEWS, defaultView: access.responses ? "responses" : "sends", viewScopedParams: RESPONSE_FILTER_PARAMS });
  const detail = query.data;

  if (query.isPending) return <ScreenLoader fit="fill" />;
  if (!detail) {
    return (
      <div className="w-full space-y-4">
        <Notice tone="fault">{t("common.errorTitle")}</Notice>
        <Button variant="secondary" title={t("common.retry")} onClick={() => void query.refetch()} />
      </div>
    );
  }

  const view = state.view ?? "responses";
  const filters = { param: state.param, setParams: state.setParams };
  const publishedNumber = detail.published?.number;

  return (
    <div className="w-full space-y-4">
      <DashboardPageHeader
        icon={<Files className="h-6 w-6" />}
        badge={t("list.title")}
        title={detail.form.name}
        description={detail.form.description ?? ""}
        back={{ label: t("detail.back"), onClick: () => router.push(formsListHref()) }}
        meta={
          <>
            <PublicationMarks publications={detail.publications} />
            <span className="text-xs text-muted-foreground">{publishedNumber ? t("detail.published", { number: publishedNumber }) : t("detail.notPublished")}</span>
          </>
        }
        actions={
          access.edit && !detail.form.archivedAt ? (
            <Button variant="primary" title={t("detail.edit")} icon={<PencilSimple className="h-4 w-4" />} iconVisible iconSide="left" link={formBuilderHref(formId)} newTab={false} />
          ) : undefined
        }
      />

      <Tabs value={view} onValueChange={(next) => state.setView(next as DetailView)}>
        <TabsList>
          {DETAIL_VIEWS.filter((key) => (key === "responses" || key === "performance" ? access.responses : true)).map((key) => (
            <TabsTrigger key={key} value={key}>
              {t(`detail.tabs.${key}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        {access.responses ? (
          <TabsContent value="responses">
            <ResponsesTab detail={detail} filters={filters} />
          </TabsContent>
        ) : null}
        {access.responses ? (
          <TabsContent value="performance">
            <PerformanceTab detail={detail} filters={filters} />
          </TabsContent>
        ) : null}
        <TabsContent value="sends">
          <SendsTab detail={detail} />
        </TabsContent>
        <TabsContent value="automations">
          <AutomationsTab detail={detail} />
        </TabsContent>
        <TabsContent value="versions">
          <VersionsTab detail={detail} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
