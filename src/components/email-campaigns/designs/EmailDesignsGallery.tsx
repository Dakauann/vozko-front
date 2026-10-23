"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { createEmailCampaignAction, createEmailDesignAction, deleteEmailDesignAction, isEmailActionError } from "@/app/actions/email-campaigns";
import { ScreenLoader } from "@/components/brand/screen-loader";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSheet, ElevatedSheetContent, ElevatedSheetDescription, ElevatedSheetHeader, ElevatedSheetTitle } from "@/components/elevated-design/elevated-sheet";
import { ListPager } from "@/components/elevated-design/list-pager";
import { EmailThumbnail } from "@/components/email-editor";
import { Copy, DotsThree, EnvelopeSimple, Files, PaperPlaneTilt, PencilSimple, Plus, Trash } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Notice } from "@/components/ui/notice";
import { useWorkspace } from "@/contexts/workspace-context";
import { emailDesignsRoot, emailCampaignsRoot, useEmailDesigns } from "@/hooks/use-email-campaigns";
import { sectionErrorCode } from "@/lib/analytics/section-query";
import { wizardHref } from "@/lib/email-campaigns/status";
import type { Design } from "@/lib/email-campaigns/types";
import type { Document } from "@/lib/email-design/types";

import { useEmailErrorMessage, useEmailFormat, useEmailPermission } from "../shared";
import { DocumentPicker } from "./DocumentPicker";

const PAGE_SIZE = 24;

export function designHref(id: string): string {
  return `/dashboard/email/designs/${id}`;
}

export function EmailDesignsGallery() {
  const t = useTranslations("emailCampaigns.designs");
  const router = useRouter();
  const client = useQueryClient();
  const allowed = useEmailPermission();
  const errorMessage = useEmailErrorMessage();
  const { date } = useEmailFormat();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [deleting, setDeleting] = useState<Design | null>(null);
  const designs = useEmailDesigns({ kind: "template", page, pageSize: PAGE_SIZE });
  const items = designs.data?.items ?? [];
  const total = designs.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canCreate = allowed("create");

  const refresh = () => client.invalidateQueries({ queryKey: emailDesignsRoot(workspaceId) });

  const create = async (document: Document, designName: string) => {
    const result = await createEmailDesignAction({ name: designName, kind: "template", document });
    if (isEmailActionError(result)) {
      toast.error(t("create.failed"), { description: errorMessage(result) });
      return null;
    }
    await refresh();
    return result.data;
  };

  const startFrom = async (document: Document) => {
    const created = await create(document, name.trim() || t("create.defaultName"));
    if (!created) return;
    setCreating(false);
    setName("");
    router.push(designHref(created.id));
  };

  const duplicate = async (design: Design) => {
    const created = await create(design.document, t("duplicateName", { name: design.name }));
    if (created) toast.success(t("duplicated"));
  };

  const startCampaign = async (design: Design) => {
    const created = await createEmailCampaignAction({ name: design.name, subject: "", document: design.document });
    if (isEmailActionError(created)) {
      toast.error(t("useFailed"), { description: errorMessage(created) });
      return;
    }
    await client.invalidateQueries({ queryKey: emailCampaignsRoot(workspaceId) });
    router.push(wizardHref(created.data.id));
  };

  const remove = async (design: Design) => {
    const result = await deleteEmailDesignAction(design.id);
    if (isEmailActionError(result)) {
      toast.error(t("delete.failed"), { description: errorMessage(result) });
      return;
    }
    toast.success(t("delete.done"));
    await refresh();
  };

  const newButton = canCreate ? <Button variant="primary" title={t("new")} icon={<Plus className="h-4 w-4" weight="bold" />} iconVisible iconSide="left" onClick={() => setCreating(true)} /> : null;

  return (
    <main className="w-full space-y-4">
      <DashboardPageHeader
        icon={<Files className="h-6 w-6" weight="fill" />}
        badge={t("title")}
        description={t("description")}
        actions={
          <>
            {newButton}
            <Button variant="secondary" title={t("campaigns")} icon={<EnvelopeSimple className="h-4 w-4" />} iconVisible iconSide="left" link="/dashboard/email/campaigns" newTab={false} />
          </>
        }
      />

      {designs.isPending ? (
        <ScreenLoader fit="fill" className="min-h-[360px]" />
      ) : designs.isError ? (
        <Notice tone="fault" title={t("loadFailed")}>
          <p>{errorMessage({ code: sectionErrorCode(designs.error) })}</p>
        </Notice>
      ) : items.length === 0 ? (
        <section className="space-y-4" aria-label={t("empty.title")}>
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">{t("empty.title")}</h2>
            <p className="mt-1 max-w-[68ch] text-sm text-muted-foreground">{t("empty.description")}</p>
          </div>
          {canCreate ? <DocumentPicker onPick={(document) => void startFrom(document)} showSaved={false} /> : null}
        </section>
      ) : (
        <>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(248px,1fr))] gap-px overflow-hidden rounded-lg border border-border bg-border" aria-label={t("title")}>
            {items.map((design) => (
              <li key={design.id} className="group relative bg-card">
                <button
                  type="button"
                  onClick={() => router.push(designHref(design.id))}
                  className="flex h-full w-full flex-col items-center gap-3 p-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span className="block overflow-hidden rounded-[--radius] border border-border shadow-sm transition-shadow duration-150 group-hover:shadow-md">
                    <EmailThumbnail document={design.document} />
                  </span>
                  <span className="block w-full pr-8">
                    <span className="block truncate text-sm font-semibold text-foreground">{design.name}</span>
                    <span className="mt-0.5 block text-2xs text-muted-foreground">{t("updated", { date: date(design.updated_at) })}</span>
                  </span>
                </button>
                <div className="absolute bottom-3 right-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={t("actions", { name: design.name })}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <DotsThree className="h-5 w-5" weight="bold" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => router.push(designHref(design.id))}>
                        <PencilSimple className="h-4 w-4" />
                        {t("edit")}
                      </DropdownMenuItem>
                      {canCreate ? (
                        <>
                          <DropdownMenuItem onSelect={() => void startCampaign(design)}>
                            <PaperPlaneTilt className="h-4 w-4" />
                            {t("use")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => void duplicate(design)}>
                            <Copy className="h-4 w-4" />
                            {t("duplicate")}
                          </DropdownMenuItem>
                        </>
                      ) : null}
                      {allowed("delete") ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => setDeleting(design)} className="text-destructive-ink">
                            <Trash className="h-4 w-4" />
                            {t("delete.action")}
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            ))}
          </ul>
          <ListPager page={page} totalPages={totalPages} onPage={setPage} previousLabel={t("pager.previous")} nextLabel={t("pager.next")} pageLabel={t("pager.page", { page, total: totalPages })} />
        </>
      )}

      <ElevatedSheet open={creating} onOpenChange={setCreating}>
        <ElevatedSheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
          <ElevatedSheetHeader>
            <ElevatedSheetTitle>{t("create.title")}</ElevatedSheetTitle>
            <ElevatedSheetDescription>{t("create.description")}</ElevatedSheetDescription>
          </ElevatedSheetHeader>
          <div className="space-y-4 px-4 pb-6">
            <ElevatedInput label={t("create.name")} value={name} onChange={(event) => setName(event.target.value)} />
            <DocumentPicker onPick={(document) => void startFrom(document)} showSaved={false} />
          </div>
        </ElevatedSheetContent>
      </ElevatedSheet>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => (open ? undefined : setDeleting(null))}
        title={t("delete.confirmTitle")}
        description={deleting ? t("delete.confirmBody", { name: deleting.name }) : undefined}
        confirmLabel={t("delete.action")}
        onConfirm={async () => {
          if (deleting) await remove(deleting);
          setDeleting(null);
        }}
      />
    </main>
  );
}
