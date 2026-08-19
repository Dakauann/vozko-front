"use client";

import {
  ArrowClockwise,
  ArrowLeft,
  Buildings,
  CheckCircle,
  CircleNotch,
  Clock,
  Code,
  Copy,
  DotsThreeVertical,
  Image as ImageIcon,
  PaperPlaneTilt,
  Pause,
  PencilSimple,
  Phone,
  Prohibit,
  UserCircle,
  WhatsappLogo,
  X,
  XCircle,
} from "@/components/icons";
import type {
  TemplateAccess,
  TemplateCategory,
  TemplateStatus,
  WhatsAppTemplate,
} from "@/lib/whatsapp-templates/types";
import {
  adminListAllWorkspacesAction,
  getWorkspaceAction,
} from "@/app/actions/workspace";
import {
  getMyTemplateAccessAction,
  grantTemplateAccessAction,
  listTemplateAccessAction,
  revokeTemplateAccessAction,
} from "@/app/actions/whatsapp-template-access";
import {
  getWhatsAppTemplateByIdAction,
  getWhatsAppTemplateByIdAdminAction,
  replicateWhatsAppTemplateAction,
  syncWhatsAppTemplateByIdAction,
  updateWhatsAppTemplateHeaderMediaAction,
} from "@/app/actions/whatsapp-templates";
import { useCallback, useEffect, useRef, useState } from "react";

import Button from "@/components/elevated-design/button";
import type { DraggableComponent } from "@/components/whatsapp/DragDropBuilder";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ElevatedCommandSelect } from "@/components/elevated-design/elevated-command-select";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import Link from "next/link";
import TemplateEditModal from "@/components/whatsapp/TemplateEditModal";
import type { WhatsAppBusinessPhone } from "@/lib/whatsapp-business-phones/types";
import WhatsAppPreview from "@/components/whatsapp/WhatsAppPreview";
import type { Workspace } from "@/lib/workspace/types";
import { cn } from "@/lib/utils";
import { listBusinessPhonesAction } from "@/app/actions/whatsapp-business-phones";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import { usePaginatedSelect } from "@/hooks/use-paginated-select";
import { useParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] as const },
  },
};

/** Quiet, tinted status treatment (not bright solid fills), on brand. */
function statusTone(status: TemplateStatus): {
  cls: string;
  icon: typeof CheckCircle;
} {
  switch (status) {
    case "APPROVED":
      return {
        cls: "bg-muted text-healthy-ink border-border dark:text-healthy-ink",
        icon: CheckCircle,
      };
    case "PENDING":
      return {
        cls: "bg-muted text-warning-ink border-border dark:text-warning-ink",
        icon: Clock,
      };
    case "REJECTED":
      return {
        cls: "bg-muted text-destructive-ink border-border dark:text-destructive-ink",
        icon: XCircle,
      };
    case "PAUSED":
      return { cls: "bg-muted text-muted-foreground border-border", icon: Pause };
    default:
      return {
        cls: "bg-muted text-muted-foreground border-border",
        icon: Prohibit,
      };
  }
}

/** Category is data, not an action, use quiet data tints, never the Signal Blue accent. */
function categoryTone(category: TemplateCategory): string {
  switch (category) {
    case "MARKETING":
      return "bg-muted text-muted-foreground border-border";
    case "UTILITY":
      return "bg-muted text-muted-foreground border-border dark:text-healthy-ink";
    case "AUTHENTICATION":
      return "bg-muted text-warning-ink border-border dark:text-warning-ink";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function usabilityTone(status: string): string {
  if (status === "ready")
    return "bg-muted text-healthy-ink border-border dark:text-healthy-ink";
  if (status === "missing_header_media")
    return "bg-muted text-warning-ink border-border dark:text-warning-ink";
  return "bg-muted text-destructive-ink border-border dark:text-destructive-ink";
}

function convertToDraggableComponents(
  components: WhatsAppTemplate["components"],
  headerMediaUrl?: string | null,
): DraggableComponent[] {
  return components.map((component, index) => {
    const draggable: DraggableComponent = {
      id: `${component.type}-${index}`,
      type: component.type,
      data: {
        format: component.format,
        text: component.text,
        variableExamples: component.parameters,
      },
    };

    if (component.type === "HEADER" && component.format !== "TEXT") {
      draggable.data.example =
        headerMediaUrl ?? component.example?.header_handle?.[0];
    }

    if (component.buttons && component.buttons.length > 0) {
      draggable.data.buttons = component.buttons.map((btn, btnIndex) => ({
        id: `btn-${btnIndex}`,
        type: btn.type,
        text: btn.text,
        url: btn.url,
        phone_number: btn.phone_number,
        example: Array.isArray(btn.example) ? btn.example[0] : btn.example,
      }));
    }

    return draggable;
  });
}

export default function WhatsAppTemplateDetailPage() {
  const t = useTranslations("whatsappTemplates");
  const commonT = useTranslations("common");
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const params = useParams();
  const templateId = params.templateId as string;

  const tRef = useRef(t);
  const toastRef = useRef(toast);
  tRef.current = t;
  toastRef.current = toast;

  const [template, setTemplate] = useState<WhatsAppTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSavingMedia, setIsSavingMedia] = useState(false);
  const { can } = useWorkspace();
  const isAdmin = can("whatsapp_templates", "update");
  const isSystemAdmin = user?.role === "admin";

  const [accessItems, setAccessItems] = useState<TemplateAccess[]>([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [accessPage, setAccessPage] = useState(1);
  const [accessMeta, setAccessMeta] = useState({
    page: 1,
    pageSize: 10,
    totalPages: 1,
    totalItems: 0,
  });
  const [accessWorkspaces, setAccessWorkspaces] = useState<
    Record<string, Workspace>
  >({});
  const accessWorkspacesRef = useRef<Record<string, Workspace>>({});

  const [grantingWorkspaceId, setGrantingWorkspaceId] = useState<string | null>(
    null,
  );
  const [revokingWorkspaceId, setRevokingWorkspaceId] = useState<string | null>(
    null,
  );

  const [myAccess, setMyAccess] = useState<TemplateAccess | null>(null);

  const [replicateOpen, setReplicateOpen] = useState(false);
  const [replicatePhones, setReplicatePhones] = useState<
    WhatsAppBusinessPhone[]
  >([]);
  const [replicatePhonesLoading, setReplicatePhonesLoading] = useState(false);
  const [replicateTarget, setReplicateTarget] = useState<string | null>(null);
  const [replicating, setReplicating] = useState(false);

  const headerComponent = template?.components.find((c) => c.type === "HEADER");
  const hasMediaHeader =
    headerComponent?.format &&
    ["IMAGE", "VIDEO", "DOCUMENT", "GIF"].includes(headerComponent.format);

  const isSystemAdminRef = useRef(isSystemAdmin);
  isSystemAdminRef.current = isSystemAdmin;

  const fetchTemplate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchFn = isSystemAdminRef.current
        ? getWhatsAppTemplateByIdAdminAction
        : getWhatsAppTemplateByIdAction;
      const result = await fetchFn(templateId);
      if (result.error) {
        setError(result.error);
      } else {
        setTemplate(result.template);
      }
    } catch {
      setError(tRef.current("error.default"));
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    accessWorkspacesRef.current = accessWorkspaces;
  }, [accessWorkspaces]);

  const hydrateAccessWorkspaces = useCallback(
    async (items: TemplateAccess[]): Promise<Record<string, Workspace>> => {
      const currentWorkspaces = accessWorkspacesRef.current;
      const missingWorkspaceIds = items
        .map((item) => item.workspaceId)
        .filter((wsId) => !currentWorkspaces[wsId]);

      if (missingWorkspaceIds.length === 0) return currentWorkspaces;

      const results = await Promise.all(
        missingWorkspaceIds.map((wsId) => getWorkspaceAction(wsId)),
      );

      const newWorkspaces = { ...currentWorkspaces };
      results.forEach((result, index) => {
        if (result.workspace) {
          newWorkspaces[missingWorkspaceIds[index]] = result.workspace;
        }
      });

      accessWorkspacesRef.current = newWorkspaces;
      setAccessWorkspaces(newWorkspaces);
      return newWorkspaces;
    },
    [],
  );

  const fetchAccess = useCallback(async () => {
    if (!isSystemAdmin) return;
    setAccessLoading(true);
    setAccessError(null);
    try {
      const result = await listTemplateAccessAction(templateId, {
        page: accessPage,
        pageSize: accessMeta.pageSize,
      });
      if (result.error) {
        setAccessError(result.error);
      } else {
        setAccessItems(result.items);
        setAccessMeta(result.meta);
        await hydrateAccessWorkspaces(result.items);
      }
    } catch {
      setAccessError(tRef.current("access.error.default"));
    } finally {
      setAccessLoading(false);
    }
  }, [
    accessMeta.pageSize,
    accessPage,
    hydrateAccessWorkspaces,
    isSystemAdmin,
    templateId,
  ]);

  useEffect(() => {
    if (templateId && !authLoading) {
      fetchTemplate();
    }
  }, [templateId, fetchTemplate, authLoading, isSystemAdmin]);

  useEffect(() => {
    if (templateId && isSystemAdmin) {
      fetchAccess();
    }
  }, [templateId, isSystemAdmin, accessPage, fetchAccess]);

  useEffect(() => {
    if (isSystemAdmin || !template) return;

    const fetchMyAccess = async () => {
      try {
        const result = await getMyTemplateAccessAction(templateId);
        if (!result.error && result.access) {
          setMyAccess(result.access);
        }
      } catch {
        // Silently fail
      }
    };

    fetchMyAccess();
  }, [templateId, isSystemAdmin, template]);

  const accessWorkspaceIdsRef = useRef(new Set<string>());
  useEffect(() => {
    accessWorkspaceIdsRef.current = new Set(
      accessItems.map((item) => item.workspaceId),
    );
  }, [accessItems]);

  const workspaceSelect = usePaginatedSelect<Workspace>({
    fetchFn: useCallback(async (page: number, search: string) => {
      const result = await adminListAllWorkspacesAction({
        page,
        pageSize: 20,
        search: search || undefined,
      });
      return { items: result.workspaces, totalPages: result.meta.totalPages };
    }, []),
    mapOption: useCallback(
      (ws: Workspace) => {
        const ownerDisplay =
          ws.ownerName ?? ws.ownerEmail ?? ws.ownerId.slice(0, 8) + "...";
        const alreadyGranted = accessWorkspaceIdsRef.current.has(ws.id);
        return {
          label: ws.name,
          value: ws.id,
          description: `${t("access.owner")}: ${ownerDisplay}${ws.isDefault ? " · default" : ""}`,
          icon: <Buildings className="h-4 w-4" weight="fill" />,
          disabled: alreadyGranted,
          meta: alreadyGranted ? (
            <CheckCircle className="h-4 w-4 text-healthy-ink" weight="fill" />
          ) : undefined,
        };
      },
      [t],
    ),
    enabled: isSystemAdmin,
  });

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncWhatsAppTemplateByIdAction(templateId);
      if (result.error) {
        toast({
          title: t("toast.syncError"),
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: t("toast.syncSuccess"),
          description: t("toast.templateSynced"),
        });
        if (result.template) {
          setTemplate(result.template);
        }
      }
    } catch {
      toast({
        title: t("toast.syncError"),
        description: t("error.default"),
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenReplicate = async () => {
    setReplicateOpen(true);
    setReplicateTarget(null);
    setReplicatePhonesLoading(true);
    try {
      const result = await listBusinessPhonesAction({ pageSize: 500 });
      if (result.error) {
        toast({
          title: t("toast.replicateError"),
          description: result.error,
          variant: "destructive",
        });
        setReplicatePhones([]);
      } else {
        const filtered = result.phones.filter(
          (p) => p.wabaId !== template?.wabaId,
        );
        setReplicatePhones(filtered);
      }
    } catch {
      setReplicatePhones([]);
    } finally {
      setReplicatePhonesLoading(false);
    }
  };

  const handleReplicate = async () => {
    if (!replicateTarget || !template) return;
    setReplicating(true);
    try {
      const result = await replicateWhatsAppTemplateAction(
        template.id,
        replicateTarget,
      );
      if (result.error) {
        toast({
          title: t("toast.replicateError"),
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: t("toast.replicateSuccess"),
          description: t("toast.replicateSuccessDesc"),
        });
        setReplicateOpen(false);
      }
    } catch {
      toast({
        title: t("toast.replicateError"),
        description: t("error.default"),
        variant: "destructive",
      });
    } finally {
      setReplicating(false);
    }
  };

  const handleSaveHeaderMedia = async (headerMediaUrl: string | null) => {
    setIsSavingMedia(true);
    try {
      const result = await updateWhatsAppTemplateHeaderMediaAction(templateId, {
        headerMediaUrl,
      });
      if (result.error) {
        toast({
          title: t("toast.updateMediaError"),
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: t("toast.updateMediaSuccess"),
          description: t("toast.updateMediaSuccessDesc"),
        });
        if (template) {
          setTemplate({ ...template, headerMediaUrl });
        }
        setIsEditModalOpen(false);
      }
    } catch {
      toast({
        title: t("toast.updateMediaError"),
        description: t("error.default"),
        variant: "destructive",
      });
    } finally {
      setIsSavingMedia(false);
    }
  };

  const handleGrantAccess = async (targetWorkspaceId: string) => {
    setGrantingWorkspaceId(targetWorkspaceId);
    try {
      const result = await grantTemplateAccessAction({
        workspaceId: targetWorkspaceId,
        templateId,
      });
      if (result.error) {
        toast({
          title: t("toast.accessGrantError"),
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: t("toast.accessGrantSuccess"),
          description: t("toast.accessGrantSuccessDesc"),
        });
        await fetchAccess();
      }
    } catch {
      toast({
        title: t("toast.accessGrantError"),
        description: t("access.error.default"),
        variant: "destructive",
      });
    } finally {
      setGrantingWorkspaceId(null);
    }
  };

  const handleRevokeAccess = async (targetWorkspaceId: string) => {
    setRevokingWorkspaceId(targetWorkspaceId);
    try {
      const result = await revokeTemplateAccessAction({
        workspaceId: targetWorkspaceId,
        templateId,
      });
      if (result.error) {
        toast({
          title: t("toast.accessRevokeError"),
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: t("toast.accessRevokeSuccess"),
          description: t("toast.accessRevokeSuccessDesc"),
        });
        await fetchAccess();
      }
    } catch {
      toast({
        title: t("toast.accessRevokeError"),
        description: t("access.error.default"),
        variant: "destructive",
      });
    } finally {
      setRevokingWorkspaceId(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-1/3 rounded-lg bg-muted" />
          <div className="h-40 rounded-[--radius] bg-muted" />
          <div className="h-64 rounded-[--radius] bg-muted" />
        </div>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="mx-auto flex max-w-5xl items-center justify-center p-6">
        <ElevatedContainer className="flex min-h-[320px] w-full max-w-md flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-[--radius] bg-muted text-destructive-ink">
            <WhatsappLogo className="h-7 w-7" weight="fill" />
          </div>
          <div>
            <p className="font-semibold text-foreground">{t("error.title")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {error || t("error.notFound")}
            </p>
          </div>
          <Button
            variant="outline"
            title={t("button.back")}
            icon={<ArrowLeft className="h-4 w-4" weight="bold" />}
            iconVisible
            iconSide="left"
            link="/dashboard/whatsapp-templates"
            newTab={false}
          />
        </ElevatedContainer>
      </div>
    );
  }

  const tone = statusTone(template.status);
  const StatusIcon = tone.icon;
  const isApproved = template.status === "APPROVED";

  return (
    <div className="mx-auto max-w-5xl p-6">
      <motion.div
        className="space-y-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Back link */}
        <motion.div variants={itemVariants}>
          <Link
            href="/dashboard/whatsapp-templates"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" weight="bold" />
            {t("detail.back")}
          </Link>
        </motion.div>

        {/* Identity + actions header */}
        <motion.div variants={itemVariants}>
          <ElevatedContainer className="p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[--radius] bg-muted text-healthy-ink">
                  <WhatsappLogo className="h-6 w-6" weight="fill" />
                </div>
                <div className="min-w-0">
                  <h1 className="break-words text-xl font-semibold text-foreground">
                    {template.name}
                  </h1>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {t("detail.language")}: {template.language} • ID:{" "}
                    <span className="font-mono">
                      {template.externalId || "—"}
                    </span>
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-[--radius] border px-2.5 py-0.5 text-xs font-medium",
                        tone.cls,
                      )}
                    >
                      <StatusIcon className="h-3.5 w-3.5" weight="fill" />
                      {t(
                        `status.${template.status?.toLowerCase() ?? "pending"}`,
                      )}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-[--radius] border px-2.5 py-0.5 text-xs font-medium",
                        categoryTone(template.category),
                      )}
                    >
                      {t(`category.${template.category.toLowerCase()}`)}
                    </span>
                  </div>
                </div>
              </div>

              {isAdmin && (
                <div className="flex shrink-0 items-center gap-2">
                  {isApproved && (
                    <Button
                      variant="primary"
                      size="sm"
                      title={t("button.sendMessage")}
                      icon={<PaperPlaneTilt className="h-4 w-4" weight="bold" />}
                      iconVisible
                      iconSide="left"
                      link={`/dashboard/whatsapp-templates/${template.id}/send`}
                      newTab={false}
                    />
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    title={syncing ? t("button.syncing") : t("button.syncTemplate")}
                    icon={
                      <ArrowClockwise
                        className={cn("h-4 w-4", syncing && "animate-spin")}
                        weight="bold"
                      />
                    }
                    iconVisible
                    iconSide="left"
                    onClick={handleSync}
                    disabled={syncing}
                  />

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={t("detail.moreActions")}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <DotsThreeVertical className="h-5 w-5" weight="bold" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onClick={handleOpenReplicate}>
                        <Copy className="mr-2 h-4 w-4" />
                        {t("button.replicate")}
                      </DropdownMenuItem>
                      {hasMediaHeader && (
                        <DropdownMenuItem
                          onClick={() => setIsEditModalOpen(true)}
                        >
                          <PencilSimple className="mr-2 h-4 w-4" />
                          {t("button.editMedia")}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          </ElevatedContainer>
        </motion.div>

        {/* Template preview */}
        <motion.div variants={itemVariants}>
          <ElevatedContainer className="p-6">
            <h2 className="mb-5 text-base font-semibold text-foreground">
              {t("detail.templatePreview")}
            </h2>
            <div className="mx-auto max-w-sm overflow-hidden rounded-[--radius] border border-border shadow-md">
              <WhatsAppPreview
                components={convertToDraggableComponents(
                  template.components,
                  template.headerMediaUrl,
                )}
                templateName={template.name}
                language={template.language}
              />
            </div>
          </ElevatedContainer>
        </motion.div>

        {/* Details */}
        <motion.div variants={itemVariants}>
          <ElevatedContainer className="p-6">
            <h2 className="mb-5 text-xs font-semibold text-muted-foreground">
              {t("detail.details")}
            </h2>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
              <Row label={t("detail.category")}>
                <span
                  className={cn(
                    "inline-flex items-center rounded-[--radius] border px-2 py-0.5 text-xs font-medium",
                    categoryTone(template.category),
                  )}
                >
                  {t(`category.${template.category.toLowerCase()}`)}
                </span>
              </Row>
              <Row label={t("detail.language")}>
                <span className="text-sm font-medium text-foreground">
                  {template.language}
                </span>
              </Row>
              <Row label={t("detail.templateComponents")}>
                <span className="text-sm font-medium text-foreground tabular-nums">
                  {template.components.length}
                </span>
              </Row>
              {template.usabilityStatus && (
                <Row label={t("detail.usability")}>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-[--radius] border px-2 py-0.5 text-xs font-medium",
                      usabilityTone(template.usabilityStatus),
                    )}
                  >
                    {t(`usability.${template.usabilityStatus}`)}
                  </span>
                </Row>
              )}
              {template.wabaId && (
                <Row label={t("detail.wabaId")} className="sm:col-span-2">
                  <span
                    className="block truncate font-mono text-sm text-foreground"
                    title={template.wabaId}
                  >
                    {template.wabaId}
                  </span>
                </Row>
              )}
              <Row label={t("detail.createdAt")}>
                <span className="text-sm text-foreground">
                  {new Date(template.createdAt).toLocaleString()}
                </span>
              </Row>
              <Row label={t("detail.updatedAt")}>
                <span className="text-sm text-foreground">
                  {new Date(template.updatedAt).toLocaleString()}
                </span>
              </Row>
            </dl>

            {template.usabilityMessage && (
              <p className="mt-4 text-xs text-muted-foreground">
                {template.usabilityMessage}
              </p>
            )}
          </ElevatedContainer>
        </motion.div>

        {/* Header media */}
        {hasMediaHeader && (
          <motion.div variants={itemVariants}>
            <ElevatedContainer className="p-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[--radius] bg-muted text-primary-ink">
                    <ImageIcon className="h-5 w-5" weight="fill" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-foreground">
                      {t("detail.headerMedia.title")}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {t("detail.headerMedia.description")}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  title={t("button.editMedia")}
                  icon={<PencilSimple className="h-4 w-4" weight="bold" />}
                  iconVisible
                  iconSide="left"
                  onClick={() => setIsEditModalOpen(true)}
                />
              </div>

              {template.headerMediaUrl ? (
                <div className="rounded-[--radius] border border-border bg-muted p-4">
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                    {t("detail.headerMedia.currentUrl")}
                  </p>
                  <p className="break-all font-mono text-sm text-foreground">
                    {template.headerMediaUrl}
                  </p>
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-[--radius] border border-border bg-muted p-4">
                  <p className="text-sm text-warning-ink">
                    {t("detail.headerMedia.notConfigured")}
                  </p>
                </div>
              )}
            </ElevatedContainer>
          </motion.div>
        )}

        {/* Access granted-by (non-admin) */}
        {!isSystemAdmin && myAccess?.grantor && (
          <motion.div variants={itemVariants}>
            <ElevatedContainer className="p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[--radius] bg-muted text-primary-ink">
                  <UserCircle className="h-5 w-5" weight="fill" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("access.grantedByLabel")}
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {myAccess.grantor.name || myAccess.grantor.email}
                  </p>
                  {myAccess.createdAt && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(myAccess.createdAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </ElevatedContainer>
          </motion.div>
        )}

        {/* Workspace access management (system admin) */}
        {isSystemAdmin && (
          <motion.div variants={itemVariants}>
            <ElevatedContainer className="p-6">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[--radius] bg-muted text-primary-ink">
                    <Buildings className="h-5 w-5" weight="fill" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-foreground">
                      {t("access.title")}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {t("access.description")}
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center rounded-[--radius] bg-muted px-3 py-1 text-xs font-semibold text-foreground">
                  {t("access.count", { count: accessMeta.totalItems })}
                </span>
              </div>

              <ElevatedCommandSelect
                label={t("access.searchLabel")}
                value={null}
                searchPlaceholder={t("access.searchLabel")}
                emptyMessage={t("access.noWorkspaces")}
                disabled={!!grantingWorkspaceId}
                fullWidth
                onValueChange={(val) => handleGrantAccess(val)}
                options={workspaceSelect.options}
                onSearch={workspaceSelect.onSearch}
                onScrollEnd={workspaceSelect.onScrollEnd}
                onOpenChange={workspaceSelect.onOpenChange}
                isLoading={workspaceSelect.isLoading}
              />

              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">
                    {t("access.grantedWorkspaces")}
                  </p>
                  {accessMeta.totalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        title={t("access.previous")}
                        onClick={() =>
                          setAccessPage((prev) => Math.max(1, prev - 1))
                        }
                        disabled={accessPage <= 1}
                      />
                      <span className="px-2 text-xs tabular-nums text-muted-foreground">
                        {accessPage} / {accessMeta.totalPages}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        title={t("access.next")}
                        onClick={() =>
                          setAccessPage((prev) =>
                            Math.min(accessMeta.totalPages, prev + 1),
                          )
                        }
                        disabled={accessPage >= accessMeta.totalPages}
                      />
                    </div>
                  )}
                </div>

                {accessLoading ? (
                  <div className="flex items-center justify-center gap-2 rounded-[--radius] border border-border bg-muted p-6 text-sm text-muted-foreground">
                    <CircleNotch className="h-4 w-4 animate-spin" weight="bold" />
                    {t("access.loading")}
                  </div>
                ) : accessError ? (
                  <div className="rounded-[--radius] border border-border bg-muted p-4 text-sm text-destructive-ink">
                    {accessError}
                  </div>
                ) : accessItems.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-[--radius] border border-dashed border-border bg-muted p-8 text-center">
                    <Buildings
                      className="h-8 w-8 text-muted-foreground"
                      weight="fill"
                    />
                    <p className="text-sm text-muted-foreground">
                      {t("access.noAccess")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("access.searchHint")}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border overflow-hidden rounded-[--radius] border border-border bg-card">
                    {accessItems.map((item) => {
                      const workspace = accessWorkspaces[item.workspaceId];
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[--radius] bg-muted text-primary-ink">
                              <Buildings className="h-4 w-4" weight="fill" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-semibold text-foreground">
                                  {workspace?.name ??
                                    item.workspace?.name ??
                                    commonT("loading")}
                                </p>
                                {workspace?.isDefault && (
                                  <span className="shrink-0 rounded-[--radius] bg-muted px-1.5 py-0.5 text-2xs font-medium text-muted-foreground">
                                    default
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {workspace?.ownerId && (
                                  <>
                                    {t("access.owner")}:{" "}
                                    {workspace.ownerName ??
                                      workspace.ownerEmail ??
                                      workspace.ownerId.slice(0, 8) + "..."}{" "}
                                    ·{" "}
                                  </>
                                )}
                                {t("access.grantedAt")}:{" "}
                                {new Date(item.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            title={t("access.revoke")}
                            icon={<Prohibit className="h-4 w-4" weight="bold" />}
                            iconVisible
                            disabled={revokingWorkspaceId === item.workspaceId}
                            onClick={() => handleRevokeAccess(item.workspaceId)}
                            className="shrink-0 text-destructive-ink hover:bg-muted hover:text-destructive-ink"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </ElevatedContainer>
          </motion.div>
        )}

        {/* Raw JSON (system admin) */}
        {isSystemAdmin && (
          <motion.div variants={itemVariants}>
            <ElevatedContainer className="p-6">
              <div className="mb-4 flex items-center gap-2">
                <Code className="h-5 w-5 text-muted-foreground" weight="bold" />
                <h2 className="text-base font-semibold text-foreground">
                  {t("detail.jsonPreview")}
                </h2>
              </div>
              <div className="overflow-x-auto rounded-[--radius] border border-border bg-muted p-4">
                <pre className="font-mono text-xs leading-relaxed text-slate-100">
                  {JSON.stringify(template, null, 2)}
                </pre>
              </div>
            </ElevatedContainer>
          </motion.div>
        )}
      </motion.div>

      {/* Edit Media Modal */}
      <TemplateEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        template={template}
        onSave={handleSaveHeaderMedia}
        isSaving={isSavingMedia}
      />

      {/* Replicate Template Modal */}
      {replicateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !replicating && setReplicateOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="relative z-10 mx-4 w-full max-w-lg rounded-[--radius] border border-border bg-card shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[--radius] bg-muted text-healthy-ink">
                  <Copy className="h-5 w-5" weight="fill" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    {t("replicate.title")}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {t("replicate.description")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !replicating && setReplicateOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" weight="bold" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="rounded-[--radius] border border-border bg-muted p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-healthy-ink">
                    <WhatsappLogo className="h-5 w-5" weight="fill" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {template.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {template.language} • {t(`category.${template.category.toLowerCase()}`)} • WABA:{" "}
                      {template.wabaId}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  {t("replicate.selectTarget")}
                </label>
                <p className="mb-3 text-xs text-muted-foreground">
                  {t("replicate.selectTargetHint")}
                </p>

                {replicatePhonesLoading ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                    <CircleNotch className="h-5 w-5 animate-spin" weight="bold" />
                    {t("replicate.loadingPhones")}
                  </div>
                ) : replicatePhones.length === 0 ? (
                  <div className="rounded-[--radius] border border-border bg-muted p-4">
                    <p className="text-sm text-warning-ink">
                      {t("replicate.noPhones")}
                    </p>
                  </div>
                ) : (
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {replicatePhones.map((phone) => {
                      const selected = replicateTarget === phone.id;
                      return (
                        <button
                          key={phone.id}
                          type="button"
                          onClick={() => setReplicateTarget(phone.id)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-[--radius] border p-3 text-left transition-all",
                            selected
                              ? "border-primary bg-muted ring-1 ring-primary"
                              : "border-border bg-card hover:border-foreground/20 hover:bg-muted",
                          )}
                        >
                          <div
                            className={cn(
                              "flex h-9 w-9 items-center justify-center rounded-lg",
                              selected
                                ? "bg-muted text-primary-ink"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            <Phone className="h-4 w-4" weight="fill" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {phone.verifiedName || phone.displayPhoneNumber}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {phone.displayPhoneNumber} • WABA: {phone.wabaId}
                            </p>
                          </div>
                          {selected && (
                            <CheckCircle
                              className="h-5 w-5 shrink-0 text-primary-ink"
                              weight="fill"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
              <Button
                variant="ghost"
                title={t("button.cancel")}
                onClick={() => !replicating && setReplicateOpen(false)}
                disabled={replicating}
              />
              <Button
                variant="primary"
                title={
                  replicating
                    ? t("replicate.replicating")
                    : t("replicate.confirm")
                }
                icon={
                  replicating ? (
                    <CircleNotch className="h-4 w-4 animate-spin" weight="bold" />
                  ) : (
                    <Copy className="h-4 w-4" weight="bold" />
                  )
                }
                iconVisible
                iconSide="left"
                onClick={handleReplicate}
                disabled={!replicateTarget || replicating}
              />
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 border-b border-border py-2",
        className,
      )}
    >
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}
