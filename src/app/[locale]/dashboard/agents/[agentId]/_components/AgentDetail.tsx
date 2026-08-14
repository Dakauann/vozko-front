"use client";

import type {
  Agent,
  AgentOptions,
  AgentToolDefinition,
  ToolBinding,
  ToolVisibility,
} from "@/lib/agents/types";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowSquareOut,
  TestTube,
  Brain,
  CalendarCheck,
  CaretDown,
  CaretLeft,
  ChatCircle,
  CheckCircle,
  Clock,
  Code,
  Copy,
  Database,
  FileText,
  Gear,
  Globe,
  Hash,
  Image as ImageIcon,
  Lightning,
  Link,
  Microphone,
  Pause,
  Phone,
  Play,
  Robot,
  Sparkle,
  Tag,
  TextT,
  User,
  WhatsappLogo,
  Wrench,
  XCircle,
} from "@/components/icons";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import NextImage from "next/image";

import { getBusinessPhoneByIdAction } from "@/app/actions/whatsapp-business-phones";
import { toggleAgentStatusAction } from "@/app/actions/agents";
import Button from "@/components/elevated-design/button";
import { ModelBrandIcon } from "@/components/elevated-design/model-brand-icon";
import { softSurfaceShadow } from "@/components/elevated-design/shadow-presets";
import { useToast } from "@/hooks/use-toast";
import type { WhatsAppBusinessPhone } from "@/lib/whatsapp-business-phones/types";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

interface AgentDetailProps {
  agent: Agent;
  options: AgentOptions | null;
  tools: AgentToolDefinition[];
}

type Accent =
  | "blue"
  | "emerald"
  | "amber"
  | "rose"
  | "slate"
  | "violet"
  | "sky";

/*
 * Accent recipes.
 *
 * `icon` was `bg-muted` for all seven accents while IconTile hardcodes
 * `text-white` on the glyph — a white mark on a pale grey plate, which is not
 * a subtle tile but an invisible one. Every icon on this page was a ghost
 * square. It is the exact failure the shared guardrail names: a block whose
 * colour comes from a prop, carrying a white glyph, the moment a caller
 * passes a neutral fill.
 *
 * These are the shared plates now, so the glyph colour comes from the plate
 * rather than from IconTile, and each accent lands on the colour its mark
 * means elsewhere in the product.
 */
const accentClasses: Record<
  Accent,
  {
    icon: string;
    chip: string;
    border: string;
  }
> = {
  blue: {
    icon: "tile-1",
    chip: "bg-muted text-muted-foreground",
    border: "border-border",
  },
  emerald: {
    icon: "tile-healthy",
    chip: "bg-healthy text-healthy-foreground",
    border: "border-border",
  },
  amber: {
    icon: "tile-3",
    chip: "bg-warning text-warning-foreground",
    border: "border-border",
  },
  rose: {
    icon: "tile-fault",
    chip: "bg-destructive text-destructive-foreground",
    border: "border-border",
  },
  slate: {
    icon: "tile-neutral",
    chip: "bg-muted text-muted-foreground",
    border: "border-border",
  },
  violet: {
    icon: "tile-5",
    chip: "bg-muted text-muted-foreground",
    border: "border-border",
  },
  sky: {
    icon: "tile-4",
    chip: "bg-muted text-muted-foreground",
    border: "border-border",
  },
};

function formatDate(value?: string | null, locale: string = "pt-BR") {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function isConfigured(value?: string | null) {
  return Boolean(value && value.trim() !== "");
}

function copyToClipboard(value: string) {
  if (!navigator?.clipboard) {
    return;
  }
  navigator.clipboard.writeText(value);
}

function IconTile({
  children,
  accent = "blue",
  size = "md",
  className,
}: {
  children: ReactNode;
  accent?: Accent;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center shadow-sm",
        size === "sm" && "h-9 w-9 rounded-[--radius] [&>svg]:h-4 [&>svg]:w-4",
        size === "md" && "h-11 w-11 rounded-[--radius] [&>svg]:h-5 [&>svg]:w-5",
        size === "lg" && "h-14 w-14 rounded-[--radius] [&>svg]:h-7 [&>svg]:w-7",
        accentClasses[accent].icon,
        className,
      )}
    >
      {children}
    </span>
  );
}

function StatusBadge({
  active,
  activeLabel,
  inactiveLabel,
}: {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[--radius] px-2.5 py-1 text-xs font-semibold text-white",
        active ? "bg-healthy" : "bg-muted",
      )}
    >
      {active ? (
        <CheckCircle weight="fill" className="h-3.5 w-3.5" />
      ) : (
        <XCircle weight="fill" className="h-3.5 w-3.5" />
      )}
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}

function Panel({
  icon,
  title,
  subtitle,
  accent = "blue",
  action,
  children,
  className,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  accent?: Accent;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[--radius] border border-border bg-card p-5",
        className,
      )}
      style={{ boxShadow: softSurfaceShadow }}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <IconTile accent={accent} size="sm">
            {icon}
          </IconTile>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            {subtitle ? (
              <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  icon,
  label,
  value,
  accent = "blue",
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  accent?: Accent;
}) {
  return (
    <div
      className="rounded-[--radius] border border-border bg-card p-4"
      style={{ boxShadow: softSurfaceShadow }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-muted-foreground">
            {label}
          </p>
          <div className="mt-2 min-w-0 text-base font-semibold text-foreground">
            {value}
          </div>
        </div>
        <IconTile accent={accent} size="sm">
          {icon}
        </IconTile>
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  mono,
  copyable,
}: {
  icon?: ReactNode;
  label: string;
  value?: string | null;
  mono?: boolean;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const displayValue = value || "-";

  const handleCopy = useCallback(() => {
    if (!value) {
      return;
    }
    copyToClipboard(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, [value]);

  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-0">
      <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        {icon ? (
          <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        ) : null}
        <span className="truncate">{label}</span>
      </div>
      <div className="flex min-w-0 items-center gap-2 text-right">
        <span
          className={cn(
            "truncate text-sm font-medium text-foreground",
            mono && "rounded-md bg-muted px-2 py-0.5 font-mono text-xs",
          )}
          title={displayValue}
        >
          {displayValue}
        </span>
        {copyable && value ? (
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Copiar"
          >
            {copied ? (
              <CheckCircle weight="fill" className="h-4 w-4 text-healthy-ink" />
            ) : (
              <Copy weight="bold" className="h-4 w-4" />
            )}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function PromptCard({
  label,
  value,
  icon,
  accent = "blue",
}: {
  label: string;
  value?: string | null;
  icon: ReactNode;
  accent?: Accent;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const empty = !isConfigured(value);
  const charCount = value?.length ?? 0;

  const handleCopy = useCallback(() => {
    if (!value) {
      return;
    }
    copyToClipboard(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, [value]);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[--radius] border bg-background transition-colors",
        empty ? "border-border" : accentClasses[accent].border,
      )}
    >
      <button
        type="button"
        disabled={empty}
        onClick={() => setIsOpen((current) => !current)}
        className={cn(
          "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors",
          empty ? "cursor-not-allowed opacity-60" : "hover:bg-muted",
        )}
      >
        <span className="flex min-w-0 items-center gap-3">
          <IconTile accent={empty ? "slate" : accent} size="sm">
            {icon}
          </IconTile>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-foreground">
              {label}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {empty
                ? "Não configurado"
                : `${charCount.toLocaleString()} caracteres`}
            </span>
          </span>
        </span>
        {!empty ? (
          <motion.span
            animate={{ rotate: isOpen ? 180 : 0 }}
            className="text-muted-foreground"
            transition={{ duration: 0.2 }}
          >
            <CaretDown weight="bold" className="h-4 w-4" />
          </motion.span>
        ) : null}
      </button>

      <AnimatePresence>
        {isOpen && !empty ? (
          <motion.div
            animate={{ height: "auto", opacity: 1 }}
            className="overflow-hidden"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="border-t border-border p-4">
              <div className="mb-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleCopy}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                    copied
                      ? "bg-healthy text-healthy-foreground"
                      : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {copied ? (
                    <CheckCircle weight="fill" className="h-3.5 w-3.5" />
                  ) : (
                    <Copy weight="bold" className="h-3.5 w-3.5" />
                  )}
                  {copied ? "Copiado" : "Copiar"}
                </button>
              </div>
              <pre className="max-h-[380px] overflow-y-auto whitespace-pre-wrap rounded-[--radius] border border-border bg-muted p-4 font-mono text-xs leading-relaxed text-foreground">
                {value}
              </pre>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function ToolCard({
  tool,
  definition,
}: {
  tool: ToolBinding;
  definition?: AgentToolDefinition;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasConfig = Boolean(tool.config && Object.keys(tool.config).length > 0);
  const hasVisibility = Boolean(tool.visibility && tool.visibility.length > 0);
  const displayName = definition?.displayName || tool.name;
  const displayDescription =
    definition?.displayDescription || definition?.description || null;

  const visibilityIcons: Record<ToolVisibility, ReactNode> = {
    messaging: <ChatCircle weight="fill" className="h-3.5 w-3.5" />,
    post_conversation: <Clock weight="fill" className="h-3.5 w-3.5" />,
  };

  const visibilityLabels: Record<ToolVisibility, string> = {
    messaging: "Mensagens",
    post_conversation: "Pós-conversa",
  };

  return (
    <div className="overflow-hidden rounded-[--radius] border border-border bg-background">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted"
      >
        <span className="flex min-w-0 items-center gap-3">
          <IconTile accent="amber" size="sm">
            <Wrench weight="fill" />
          </IconTile>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-foreground">
              {displayName}
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {displayDescription ||
                (hasVisibility
                  ? tool.visibility
                      ?.map((item) => visibilityLabels[item])
                      .join(" · ")
                  : "Sem disponibilidade definida")}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {hasConfig ? (
            <span className="inline-flex items-center gap-1.5 rounded-[--radius] bg-healthy px-2.5 py-1 text-[11px] font-semibold text-healthy-foreground">
              <Gear weight="fill" className="h-3 w-3" />
              Configurado
            </span>
          ) : null}
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            className="text-muted-foreground"
            transition={{ duration: 0.2 }}
          >
            <CaretDown weight="bold" className="h-4 w-4" />
          </motion.span>
        </span>
      </button>

      <AnimatePresence>
        {expanded ? (
          <motion.div
            animate={{ height: "auto", opacity: 1 }}
            className="overflow-hidden"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="space-y-3 border-t border-border p-4">
              {displayDescription ? (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {displayDescription}
                </p>
              ) : null}
              {hasVisibility ? (
                <div className="flex flex-wrap gap-2">
                  {tool.visibility?.map((visibility) => (
                    <span
                      key={visibility}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-xs font-medium text-foreground"
                    >
                      {visibilityIcons[visibility]}
                      {visibilityLabels[visibility]}
                    </span>
                  ))}
                </div>
              ) : null}
              {hasConfig ? (
                <pre className="max-h-[260px] overflow-y-auto whitespace-pre-wrap rounded-[--radius] border border-border bg-muted p-3 font-mono text-xs leading-relaxed text-foreground">
                  {JSON.stringify(tool.config, null, 2)}
                </pre>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Sem configuração adicional.
                </p>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function JsonPanel({ value }: { value: unknown }) {
  return (
    <pre className="max-h-[320px] overflow-y-auto whitespace-pre-wrap rounded-[--radius] border border-border bg-muted p-4 font-mono text-xs leading-relaxed text-foreground">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default function AgentDetail({
  agent,
  options,
  tools,
}: AgentDetailProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { can, permissionsLoading } = useWorkspace();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("agents");

  const providerName = useMemo(() => {
    const provider = options?.providers?.find(
      (item) => item.id === agent.provider,
    );
    return provider?.name ?? agent.provider;
  }, [options, agent.provider]);

  const toolDefinitionByName = useMemo(() => {
    return new Map(tools.map((tool) => [tool.name, tool]));
  }, [tools]);

  const [businessPhone, setBusinessPhone] =
    useState<WhatsAppBusinessPhone | null>(null);

  useEffect(() => {
    if (!agent.businessPhoneId) {
      return;
    }

    let active = true;
    getBusinessPhoneByIdAction(agent.businessPhoneId).then((result) => {
      if (active && result.phone) {
        setBusinessPhone(result.phone);
      }
    });

    return () => {
      active = false;
    };
  }, [agent.businessPhoneId]);

  const businessPhoneLabel = useMemo(() => {
    if (!businessPhone) {
      return agent.businessPhoneId ?? "-";
    }

    return businessPhone.verifiedName
      ? `${businessPhone.verifiedName} (${businessPhone.displayPhoneNumber})`
      : businessPhone.displayPhoneNumber;
  }, [businessPhone, agent.businessPhoneId]);

  const handleToggleStatus = () => {
    startTransition(async () => {
      const { error } = await toggleAgentStatusAction(
        agent.id,
        !agent.isActive,
      );

      if (error) {
        toast({
          title: t("detail.toast.error"),
          description: error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: agent.isActive
          ? t("detail.toast.deactivated")
          : t("detail.toast.activated"),
        description: `${agent.name} ${t("detail.toast.updated")}`,
      });

      router.refresh();
    });
  };

  const promptCount = [agent.initialMessage, agent.messagingPrompt].filter(
    isConfigured,
  ).length;
  const toolCount = agent.internalTools?.length ?? 0;
  const hasMetadata = Boolean(
    agent.metadata && Object.keys(agent.metadata).length > 0,
  );
  const hasMediaIds = Boolean(agent.mediaIds && agent.mediaIds.length > 0);
  const hasToolBindings = Boolean(
    agent.toolBindings && Object.keys(agent.toolBindings).length > 0,
  );
  const hasRagConfig = Boolean(
    agent.ragConfig && Object.keys(agent.ragConfig).length > 0,
  );
  const canUpdateAgent = !permissionsLoading && can("agents", "update");

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="w-full space-y-4"
      initial={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <section
        className="rounded-[--radius] border border-border bg-card p-5"
        style={{ boxShadow: softSurfaceShadow }}
      >
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
            {agent.avatarUrl ? (
              <NextImage
                alt={agent.name}
                className="h-14 w-14 shrink-0 rounded-[--radius] border border-border object-cover shadow-sm"
                height={56}
                src={agent.avatarUrl}
                width={56}
              />
            ) : (
              <IconTile accent="blue" size="lg">
                <Robot weight="fill" />
              </IconTile>
            )}

            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  className="text-xs font-semibold"
                  icon={<CaretLeft weight="bold" className="h-4 w-4" />}
                  iconSide="left"
                  iconVisible
                  link="/dashboard/agents"
                  newTab={false}
                  title={t("detail.back")}
                  variant="ghost"
                />
                <span className="inline-flex items-center gap-1.5 rounded-[--radius] bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                  <Robot weight="fill" className="h-3.5 w-3.5" />
                  {t("header.badge")}
                </span>
                <StatusBadge
                  active={agent.isActive}
                  activeLabel={t("card.status.active")}
                  inactiveLabel={t("card.status.inactive")}
                />
              </div>

              <div>
                <h1 className="text-2xl font-semibold tracking-normal text-foreground md:text-3xl">
                  {agent.name}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                  {agent.description || t("card.noDescription")}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 font-medium text-foreground">
                  <Robot weight="fill" className="h-3.5 w-3.5" />
                  {providerName}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 font-medium text-foreground">
                  <CalendarCheck weight="fill" className="h-3.5 w-3.5" />
                  {formatDate(agent.updatedAt)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            {canUpdateAgent ? (
              <>
                <Button
                  disabled={isPending}
                  icon={<TestTube weight="bold" className="h-4 w-4" />}
                  iconSide="left"
                  iconVisible
                  link={`/dashboard/agents/${agent.id}/simulator`}
                  newTab={false}
                  title={t("card.simulate")}
                  variant="outline-subtle"
                />
                <Button
                  disabled={isPending}
                  icon={<ArrowSquareOut weight="bold" className="h-4 w-4" />}
                  iconSide="left"
                  iconVisible
                  link={`/dashboard/agents/${agent.id}/edit`}
                  newTab={false}
                  title={t("card.edit")}
                  variant="outline-subtle"
                />
                <Button
                  className={cn(
                    agent.isActive && "text-warning-ink hover:bg-muted",
                  )}
                  disabled={isPending}
                  icon={
                    agent.isActive ? (
                      <Pause weight="fill" className="h-4 w-4" />
                    ) : (
                      <Play weight="fill" className="h-4 w-4" />
                    )
                  }
                  iconSide="left"
                  iconVisible
                  onClick={handleToggleStatus}
                  title={
                    agent.isActive
                      ? t("detail.deactivate")
                      : t("detail.activate")
                  }
                  type="button"
                  variant={agent.isActive ? "outline-subtle" : "primary"}
                />
              </>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          accent="emerald"
          icon={<ChatCircle weight="fill" />}
          label={t("detail.messagingModel")}
          value={
            <span
              className="flex min-w-0 items-center gap-1.5 truncate"
              title={agent.messagingModel || "-"}
            >
              {agent.messagingModel ? (
                <ModelBrandIcon modelId={agent.messagingModel} size={16} />
              ) : null}
              <span className="truncate">
                {agent.messagingModel?.split("/").pop() || "-"}
              </span>
            </span>
          }
        />
        <MetricCard
          accent="amber"
          icon={<Wrench weight="fill" />}
          label={t("detail.tools.title")}
          value={toolCount}
        />
      </div>

      <div className="space-y-4">
        <div className="space-y-4">
          <Panel
            accent="blue"
            action={
              <span className="rounded-[--radius] bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                {promptCount} / 4
              </span>
            }
            icon={<Code weight="bold" />}
            subtitle={t("detail.prompts.description")}
            title={t("detail.prompts.title")}
          >
            <div className="grid gap-3 lg:grid-cols-2">
              <PromptCard
                accent="violet"
                icon={<Sparkle weight="fill" />}
                label={t("detail.prompts.initial")}
                value={agent.initialMessage}
              />
              <PromptCard
                accent="emerald"
                icon={<ChatCircle weight="fill" />}
                label={t("detail.prompts.messaging")}
                value={agent.messagingPrompt}
              />
            </div>
          </Panel>

          <Panel
            accent="amber"
            action={
              <span className="rounded-full bg-warning px-2.5 py-1 text-xs font-semibold text-warning-foreground">
                {toolCount}
              </span>
            }
            icon={<Wrench weight="bold" />}
            subtitle={t("detail.tools.description")}
            title={t("detail.tools.title")}
          >
            {toolCount > 0 ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {agent.internalTools.map((tool) => (
                  <ToolCard
                    key={tool.name}
                    definition={toolDefinitionByName.get(tool.name)}
                    tool={tool}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-[--radius] border border-dashed border-border bg-background px-4 py-8 text-center">
                <Wrench
                  className="mx-auto h-7 w-7 text-muted-foreground"
                  weight="bold"
                />
                <p className="mt-3 text-sm font-medium text-foreground">
                  Nenhuma ferramenta vinculada
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Edite o agente para adicionar integrações internas.
                </p>
              </div>
            )}
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            {hasToolBindings ? (
              <Panel
                accent="rose"
                icon={<Link weight="bold" />}
                subtitle="Mapeamentos externos e aliases utilizados pelo agente."
                title="Bindings de ferramentas"
              >
                <JsonPanel value={agent.toolBindings} />
              </Panel>
            ) : null}

            {hasMetadata ? (
              <Panel
                accent="sky"
                icon={<Database weight="bold" />}
                subtitle="Dados adicionais armazenados com o agente."
                title="Metadados"
              >
                <JsonPanel value={agent.metadata} />
              </Panel>
            ) : null}
          </div>
        </div>

        <aside className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Panel
            accent="slate"
            icon={<Gear weight="bold" />}
            subtitle="IDs, modelos e integrações principais."
            title="Detalhes técnicos"
          >
            <div>
              <InfoRow
                copyable
                icon={<Hash weight="fill" />}
                label="ID do agente"
                mono
                value={agent.id}
              />
              <InfoRow
                copyable
                icon={<Link weight="fill" />}
                label="ID externo"
                mono
                value={agent.externalId}
              />
              <InfoRow
                icon={<Robot weight="fill" />}
                label={t("card.provider")}
                value={providerName}
              />
              <InfoRow
                icon={<FileText weight="fill" />}
                label="RAG"
                value={agent.ragEnabled ? t("card.ragOn") : t("card.ragOff")}
              />
            </div>
          </Panel>

          {agent.businessPhoneId || agent.whatsappTemplateId ? (
            <Panel
              accent="emerald"
              icon={<WhatsappLogo weight="fill" />}
              subtitle="Telefone e template usados em ações WhatsApp."
              title="WhatsApp"
            >
              <div>
                {agent.businessPhoneId ? (
                  <InfoRow
                    copyable
                    icon={<Phone weight="fill" />}
                    label={t("detail.businessPhone")}
                    value={businessPhoneLabel}
                  />
                ) : null}
                {agent.whatsappTemplateId ? (
                  <InfoRow
                    copyable
                    icon={<TextT weight="fill" />}
                    label="Template ID"
                    mono
                    value={agent.whatsappTemplateId}
                  />
                ) : null}
              </div>
            </Panel>
          ) : null}

          {agent.tags && agent.tags.length > 0 ? (
            <Panel
              accent="blue"
              icon={<Tag weight="bold" />}
              subtitle={`${agent.tags.length} tag${
                agent.tags.length === 1 ? "" : "s"
              } vinculada${agent.tags.length === 1 ? "" : "s"}.`}
              title="Tags"
            >
              <div className="flex flex-wrap gap-2">
                {agent.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 rounded-[--radius] bg-muted px-3 py-1 text-xs font-medium text-foreground"
                  >
                    <Hash
                      weight="bold"
                      className="h-3 w-3 text-muted-foreground"
                    />
                    {tag}
                  </span>
                ))}
              </div>
            </Panel>
          ) : null}

          {hasRagConfig ? (
            <Panel
              accent="sky"
              icon={<Database weight="bold" />}
              subtitle="Parâmetros de recuperação configurados para mensagens."
              title="Configuração RAG"
            >
              <JsonPanel value={agent.ragConfig} />
            </Panel>
          ) : null}

          {hasMediaIds ? (
            <Panel
              accent="rose"
              icon={<ImageIcon weight="bold" />}
              subtitle={`${agent.mediaIds?.length} arquivo${
                (agent.mediaIds?.length ?? 0) === 1 ? "" : "s"
              } vinculado${(agent.mediaIds?.length ?? 0) === 1 ? "" : "s"}.`}
              title="Mídias vinculadas"
            >
              <div className="space-y-2">
                {agent.mediaIds?.map((mediaId) => (
                  <div
                    key={mediaId}
                    className="flex items-center justify-between gap-2 rounded-[--radius] border border-border bg-background px-3 py-2"
                  >
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      {mediaId}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        copyToClipboard(mediaId);
                        toast({ title: "ID copiado" });
                      }}
                      className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title="Copiar"
                    >
                      <Copy weight="bold" className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}

          <Panel
            accent="slate"
            icon={<CalendarCheck weight="bold" />}
            subtitle="Histórico básico de criação e atualização."
            title="Datas"
          >
            <div>
              <InfoRow
                icon={<Clock weight="fill" />}
                label={t("detail.createdAt")}
                value={formatDate(agent.createdAt)}
              />
              <InfoRow
                icon={<CalendarCheck weight="fill" />}
                label={t("detail.updatedAt")}
                value={formatDate(agent.updatedAt)}
              />
            </div>
          </Panel>
        </aside>
      </div>
    </motion.div>
  );
}
