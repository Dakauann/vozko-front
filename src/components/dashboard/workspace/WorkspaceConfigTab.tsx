"use client";

import * as React from "react";
import {
  CaretDown,
  ChatCircleDots,
  CircleNotch,
  FloppyDisk,
  Clock,
  Warning,
  UsersThree,
} from "@/components/icons";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ElevatedSwitch as Switch } from "@/components/elevated-design/elevated-switch";
import type {
  RouletteMode,
  WorkspaceConfig,
} from "@/lib/workspace/workspace-config/types";
import { updateWorkspaceConfigAction } from "@/app/actions/workspace-config";
import { WorkingHoursEditor } from "@/components/dashboard/working-hours/WorkingHoursEditor";
import {
  summarizeWorkingHours,
  validateWorkingHours,
  type WorkingHoursSpec,
} from "@/lib/working-hours/types";
import { cn } from "@/lib/utils";

type WorkspaceConfigTabProps = {
  workspaceId: string;
  config: WorkspaceConfig | null;
  onConfigChange: (config: WorkspaceConfig) => void;
};

/**
 * Owner-facing workspace policies. Every policy card ships collapsed
 * (solid icon tile, status solid icon tile, status
 * chip, caret, body only when expanded.
 */
export function WorkspaceConfigTab({
  workspaceId,
  config,
  onConfigChange,
}: WorkspaceConfigTabProps) {
  const t = useTranslations("workspaceSettings");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-foreground">
          {t("tabs.config")}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground max-w-2xl">
          {t("configTab.description")}
        </p>
      </div>

      <section className="space-y-3">
        <p className="text-2xs font-semibold text-muted-foreground">
          {t("configTab.sections.attendance")}
        </p>
        <DistributionConfigCard
          workspaceId={workspaceId}
          config={config}
          onConfigChange={onConfigChange}
        />
        <WorkingHoursConfigCard
          workspaceId={workspaceId}
          config={config}
          onConfigChange={onConfigChange}
        />
        <AutoCloseConfigCard
          workspaceId={workspaceId}
          config={config}
          onConfigChange={onConfigChange}
        />
      </section>
    </div>
  );
}

// ── Shared card chrome ──────────────────────────────────────────────

function ConfigCardShell({
  open,
  onToggle,
  icon,
  title,
  description,
  statusLabel,
  statusActive,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  statusLabel: string;
  statusActive: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[--radius] border border-border bg-card shadow-sm p-5 space-y-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-4 text-left"
      >
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[--radius] bg-primary text-primary-foreground shadow">
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
              {description}
            </p>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-2">
          {/*
            Par token-conhecido renderiza sólido (DESIGN.md, "Status chips &
            notices"). Estava `bg-muted text-healthy-ink`: tinta verde sobre o
            mesmo cinza do estado inativo, então os dois estados dividiam o
            fundo e a diferença ficava só na cor do texto — pouco sinal para a
            única coisa que o card comunica fechado.

            O estado inativo continua no cinza opaco de propósito: "desligado"
            é quieto, não é status.
          */}
          <span
            className={cn(
              "rounded-[--radius] px-2.5 py-1 text-2xs font-semibold",
              statusActive
                ? "bg-healthy text-healthy-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            {statusLabel}
          </span>
          <CaretDown
            weight="bold"
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </span>
      </button>
      {open ? <div className="space-y-4">{children}</div> : null}
    </div>
  );
}

// ── Assignment ──────────────────────────────────────────────────────────────

const ROULETTE_DEFAULTS = {
  mode: "online" as RouletteMode,
  windowHours: 48,
  rescueEnabled: true,
  rescueMinutes: 15,
};

const ROULETTE_LIMITS = {
  window: { min: 1, max: 168 },
  rescue: { min: 1, max: 1440 },
};

/**
 * Tudo que decide QUEM recebe uma conversa vive neste card.
 *
 * O card se chama "Distribuição", não "Atribuição a admins": a participação de
 * admins é UMA opção do pool, não o assunto do card, e usá-la como título fazia
 * o modo da roleta, a janela, o resgate e o horário parecerem detalhes de uma
 * preferência sobre administradores. A ordem também segue a decisão real —
 * primeiro COMO o pool é montado, depois quem entra nele, depois os ajustes que
 * só existem no modo escolhido.
 */
function DistributionConfigCard({
  workspaceId,
  config,
  onConfigChange,
}: WorkspaceConfigTabProps) {
  const t = useTranslations("workspaceSettings");
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // UI: checked = admins receive assignments (= !skipAdminAssignment)
  const adminsReceive = !(config?.skipAdminAssignment ?? false);
  const mode = config?.rouletteMode ?? ROULETTE_DEFAULTS.mode;

  const handleToggle = async (checked: boolean) => {
    if (!config) return;
    const skipValue = !checked;
    setSaving(true);
    onConfigChange({ ...config, skipAdminAssignment: skipValue });
    const result = await updateWorkspaceConfigAction(workspaceId, {
      skipAdminAssignment: skipValue,
    });
    if (result.error) {
      onConfigChange({ ...config, skipAdminAssignment: !skipValue });
      toast.error(result.error);
    } else if (result.config) {
      onConfigChange(result.config);
    }
    setSaving(false);
  };

  // The mode is a discrete choice, so it saves on change with optimistic
  // rollback, the same as the admin switch above. The numeric fields below are
  // not: they get an explicit Save, because a half-typed "4" in a window field
  // must never reach the server as a policy.
  const handleModeChange = async (next: RouletteMode) => {
    if (!config || next === mode) return;
    setSaving(true);
    onConfigChange({ ...config, rouletteMode: next });
    const result = await updateWorkspaceConfigAction(workspaceId, {
      rouletteMode: next,
    });
    if (result.error) {
      onConfigChange({ ...config, rouletteMode: mode });
      toast.error(result.error);
    } else if (result.config) {
      onConfigChange(result.config);
      toast.success(t("roulette.saveSuccess"));
    }
    setSaving(false);
  };

  return (
    <ConfigCardShell
      open={open}
      onToggle={() => setOpen((v) => !v)}
      icon={<UsersThree weight="fill" className="h-4.5 w-4.5" />}
      title={t("distribution.label")}
      description={t("distribution.description")}
      statusLabel={
        mode === "last_seen"
          ? t("roulette.statusLastSeen")
          : t("roulette.statusOnline")
      }
      statusActive={mode === "last_seen"}
    >
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">
          {t("roulette.modeLabel")}
        </p>
        <div
          role="radiogroup"
          aria-label={t("roulette.modeLabel")}
          className="grid gap-2 sm:grid-cols-2"
        >
          <RouletteModeOption
            selected={mode === "online"}
            disabled={saving || !config}
            title={t("roulette.onlineLabel")}
            description={t("roulette.onlineHint")}
            onSelect={() => handleModeChange("online")}
          />
          <RouletteModeOption
            selected={mode === "last_seen"}
            disabled={saving || !config}
            title={t("roulette.lastSeenLabel")}
            description={t("roulette.lastSeenHint")}
            onSelect={() => handleModeChange("last_seen")}
          />
        </div>
      </div>

      {/*
        Quem entra no pool é uma opção DENTRO da distribuição, e vem depois do
        modo: o modo decide COMO o pool é montado, este switch decide quem é
        elegível para ele. Na ordem inversa, uma preferência sobre admins
        parecia governar todo o resto.
      */}
      <div className="flex items-center justify-between gap-4 rounded-[--radius] border border-border px-4 py-3">
        <div className="pr-4 min-w-0">
          <p className="text-sm font-medium text-foreground">
            {t("skipAdminAssignment.enableLabel")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("skipAdminAssignment.enableHint")}
          </p>
        </div>
        <Switch
          checked={adminsReceive}
          onCheckedChange={handleToggle}
          disabled={saving || !config}
          aria-label={t("skipAdminAssignment.enableLabel")}
        />
      </div>

      {mode === "last_seen" ? (
        // Keyed on the saved policy so the panel remounts — and re-seeds its
        // inputs from props — whenever the server's values change, instead of
        // syncing them back with an effect. A save echoes what was stored, so
        // the fields end up showing the clamped value the server actually kept.
        <RouletteLastSeenSettings
          key={rouletteSettingsKey(config)}
          workspaceId={workspaceId}
          config={config}
          onConfigChange={onConfigChange}
        />
      ) : null}
    </ConfigCardShell>
  );
}

function RouletteModeOption({
  selected,
  disabled,
  title,
  description,
  onSelect,
}: {
  selected: boolean;
  disabled: boolean;
  title: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "rounded-[--radius] border px-4 py-3 text-left transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-60",
        // Seleção é SÓLIDA (DESIGN.md, 2026-09-01), a mesma gramática do botão
        // primário. O estado anterior era `border-primary bg-muted`: um fundo
        // cinza com a borda verde, exatamente o padrão que a regra substituiu —
        // medido, o item selecionado ficava mais apagado que o hover ao lado,
        // então o modo em vigor lia mais fraco do que o que estava só sob o
        // ponteiro.
        selected
          ? "border-primary bg-primary text-primary-foreground shadow-button-primary"
          : "border-border bg-card hover:border-primary/50",
      )}
    >
      <p
        className={cn(
          "text-sm font-medium",
          selected ? "text-primary-foreground" : "text-foreground",
        )}
      >
        {title}
      </p>
      {/*
        No sólido a descrição não pode usar --muted-foreground: é uma tinta
        medida para fundo neutro e sobre o verde ela desaparece. A própria tinta
        do primário a 85% mantém a hierarquia sem trocar de cor.
      */}
      <p
        className={cn(
          "mt-0.5 text-xs",
          selected ? "text-primary-foreground/85" : "text-muted-foreground",
        )}
      >
        {description}
      </p>
    </button>
  );
}

function rouletteSettingsKey(config: WorkspaceConfig | null) {
  if (!config) return "empty";
  return [
    config.rouletteLastSeenWindowHours ?? ROULETTE_DEFAULTS.windowHours,
    config.rouletteRescueEnabled ?? ROULETTE_DEFAULTS.rescueEnabled,
    config.rouletteRescueAfterMinutes ?? ROULETTE_DEFAULTS.rescueMinutes,
  ].join("|");
}

/** Window + rescue. Only rendered in last_seen mode, where they mean something. */
function RouletteLastSeenSettings({
  workspaceId,
  config,
  onConfigChange,
}: WorkspaceConfigTabProps) {
  const t = useTranslations("workspaceSettings");
  const [saving, setSaving] = React.useState(false);
  const [windowHours, setWindowHours] = React.useState(
    config?.rouletteLastSeenWindowHours ?? ROULETTE_DEFAULTS.windowHours,
  );
  const [rescueOn, setRescueOn] = React.useState(
    config?.rouletteRescueEnabled ?? ROULETTE_DEFAULTS.rescueEnabled,
  );
  const [rescueMinutes, setRescueMinutes] = React.useState(
    config?.rouletteRescueAfterMinutes ?? ROULETTE_DEFAULTS.rescueMinutes,
  );

  const dirty =
    !!config &&
    ((config.rouletteLastSeenWindowHours ?? ROULETTE_DEFAULTS.windowHours) !==
      windowHours ||
      (config.rouletteRescueEnabled ?? ROULETTE_DEFAULTS.rescueEnabled) !==
        rescueOn ||
      (config.rouletteRescueAfterMinutes ?? ROULETTE_DEFAULTS.rescueMinutes) !==
        rescueMinutes);

  // Clamped client-side with the same bounds the server uses, so the field can
  // never display a value the server would have rewritten behind the admin's
  // back.
  const clamp = (raw: string, min: number, max: number, fallback: number) => {
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  };

  const handleSave = async () => {
    const w = clamp(
      String(windowHours),
      ROULETTE_LIMITS.window.min,
      ROULETTE_LIMITS.window.max,
      ROULETTE_DEFAULTS.windowHours,
    );
    const m = clamp(
      String(rescueMinutes),
      ROULETTE_LIMITS.rescue.min,
      ROULETTE_LIMITS.rescue.max,
      ROULETTE_DEFAULTS.rescueMinutes,
    );
    setWindowHours(w);
    setRescueMinutes(m);
    setSaving(true);
    const result = await updateWorkspaceConfigAction(workspaceId, {
      rouletteLastSeenWindowHours: w,
      rouletteRescueEnabled: rescueOn,
      rouletteRescueAfterMinutes: m,
    });
    if (result.error || !result.config) {
      toast.error(result.error ?? t("roulette.saveError"));
    } else {
      onConfigChange(result.config);
      toast.success(t("roulette.saveSuccess"));
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4 rounded-[--radius] border border-border p-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-foreground">
          {t("roulette.windowLabel")}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={ROULETTE_LIMITS.window.min}
            max={ROULETTE_LIMITS.window.max}
            value={windowHours}
            onChange={(e) =>
              setWindowHours(
                clamp(
                  e.target.value,
                  ROULETTE_LIMITS.window.min,
                  ROULETTE_LIMITS.window.max,
                  ROULETTE_DEFAULTS.windowHours,
                ),
              )
            }
            className="w-28 rounded-[--radius] border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
          <span className="text-xs text-muted-foreground">
            {t("roulette.hoursUnit")}
          </span>
        </div>
        <span className="mt-1 block text-2xs text-muted-foreground">
          {t("roulette.windowHint")}
        </span>
      </label>

      <div className="flex items-center justify-between gap-4 rounded-[--radius] border border-border px-4 py-3">
        <div className="pr-4 min-w-0">
          <p className="text-sm font-medium text-foreground">
            {t("roulette.rescueLabel")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("roulette.rescueHint")}
          </p>
        </div>
        <Switch
          checked={rescueOn}
          onCheckedChange={setRescueOn}
          aria-label={t("roulette.rescueLabel")}
        />
      </div>

      <div className={cn("space-y-2", !rescueOn && "opacity-50")}>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">
            {t("roulette.rescueMinutesLabel")}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={ROULETTE_LIMITS.rescue.min}
              max={ROULETTE_LIMITS.rescue.max}
              value={rescueMinutes}
              disabled={!rescueOn}
              onChange={(e) =>
                setRescueMinutes(
                  clamp(
                    e.target.value,
                    ROULETTE_LIMITS.rescue.min,
                    ROULETTE_LIMITS.rescue.max,
                    ROULETTE_DEFAULTS.rescueMinutes,
                  ),
                )
              }
              className="w-28 rounded-[--radius] border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary disabled:cursor-not-allowed"
            />
            <span className="text-xs text-muted-foreground">
              {t("roulette.minutesUnit")}
            </span>
          </div>
          <span className="mt-1 block text-2xs text-muted-foreground">
            {t("roulette.rescueMinutesHint")}
          </span>
        </label>
      </div>

      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!dirty || saving || !config}
        >
          {saving ? (
            <CircleNotch weight="bold" className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <FloppyDisk weight="fill" className="mr-1.5 h-4 w-4" />
          )}
          {t("roulette.save")}
        </Button>
      </div>
    </div>
  );
}

// ── Working hours ───────────────────────────────────────────────────────────

/**
 * O horário ganha o próprio card em vez de morar dentro da distribuição.
 *
 * São duas perguntas diferentes: "quem recebe" e "quando a operação está
 * aberta". Enfiar a segunda dentro da primeira era o mesmo erro que colocar o
 * modo da roleta debaixo de "atribuição a admins" — some do índice, e quem
 * procura horário de funcionamento não abre um card sobre distribuição.
 *
 * O card diz explicitamente o que a escala afeta hoje, e avisa quando não está
 * afetando nada — melhor do que uma tela que aceita a configuração em silêncio
 * e não faz efeito nenhum.
 */
function WorkingHoursConfigCard({
  workspaceId,
  config,
  onConfigChange,
}: WorkspaceConfigTabProps) {
  const tw = useTranslations("workingHours");
  const [open, setOpen] = React.useState(false);

  const saved = config?.workingHours ?? null;
  const summary = summarizeWorkingHours(saved);
  const rescueActive =
    (config?.rouletteMode ?? ROULETTE_DEFAULTS.mode) === "last_seen" &&
    (config?.rouletteRescueEnabled ?? ROULETTE_DEFAULTS.rescueEnabled);

  // O resumo estrutural vira frase aqui, e não num helper com o tipo do `t`
  // como parâmetro: passar a função de tradução adiante custa uma ginástica de
  // tipos que não paga por si.
  let statusLabel: string;
  switch (summary.kind) {
    case "alwaysOpen":
      statusLabel = tw("summaryAlwaysOpen");
      break;
    case "everyDay":
      statusLabel = tw("summaryEveryDay", {
        start: summary.start,
        end: summary.end,
      });
      break;
    case "weekdays":
      statusLabel = tw("summaryWeekdays", {
        start: summary.start,
        end: summary.end,
      });
      break;
    default:
      statusLabel = tw("summaryCustom", { count: summary.openDays });
  }

  return (
    <ConfigCardShell
      open={open}
      onToggle={() => setOpen((v) => !v)}
      icon={<Clock weight="fill" className="h-4.5 w-4.5" />}
      title={tw("title")}
      description={tw("workspaceDescription")}
      statusLabel={statusLabel}
      statusActive={!!saved}
    >
      {/*
        O aviso usa o Alert (a receita `.notice`) em vez de um cinza à mão:
        `bg-muted/40` era um fundo translúcido, e um fundo com alfa muda de cor
        conforme a superfície embaixo — a razão pela qual a receita fixa UM
        fundo opaco e gasta a cor no glifo e no título.
      */}
      {!rescueActive ? (
        <Alert variant="warning">
          <Warning weight="fill" className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {tw("inactiveNotice")}
          </AlertDescription>
        </Alert>
      ) : null}

      <WorkspaceWorkingHoursForm
        key={workingHoursKey(config)}
        workspaceId={workspaceId}
        config={config}
        onConfigChange={onConfigChange}
      />
    </ConfigCardShell>
  );
}

/**
 * Remonta o editor quando o servidor devolve uma escala diferente, pelo mesmo
 * motivo de rouletteSettingsKey: re-semeia o rascunho a partir das props em vez
 * de sincronizar com um efeito.
 */
function workingHoursKey(config: WorkspaceConfig | null) {
  return JSON.stringify(config?.workingHours ?? null);
}

function WorkspaceWorkingHoursForm({
  workspaceId,
  config,
  onConfigChange,
}: WorkspaceConfigTabProps) {
  const tw = useTranslations("workingHours");
  const [saving, setSaving] = React.useState(false);
  const [draft, setDraft] = React.useState<WorkingHoursSpec | null>(
    config?.workingHours ?? null,
  );

  const saved = config?.workingHours ?? null;
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const issues = draft ? validateWorkingHours(draft) : [];

  const handleSave = async () => {
    setSaving(true);
    // `null` é enviado de propósito: é o que remove a escala. Omitir o campo
    // significaria "não mexa", e o botão nunca conseguiria desligar o horário.
    const result = await updateWorkspaceConfigAction(workspaceId, {
      workingHours: draft,
    });
    if (result.error || !result.config) {
      toast.error(result.error ?? tw("saveError"));
    } else {
      onConfigChange(result.config);
      setDraft(result.config.workingHours ?? null);
      toast.success(tw("saveSuccess"));
    }
    setSaving(false);
  };

  return (
    <div className="space-y-3">
      <WorkingHoursEditor
        value={draft}
        onChange={setDraft}
        disabled={saving || !config}
        offHint={tw("workspaceOffHint")}
      />

      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!dirty || saving || !config || issues.length > 0}
        >
          {saving ? (
            <CircleNotch weight="bold" className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <FloppyDisk weight="fill" className="mr-1.5 h-4 w-4" />
          )}
          {tw("save")}
        </Button>
      </div>
    </div>
  );
}

// ── Auto close ──────────────────────────────────────────────────────────────

function AutoCloseConfigCard({
  workspaceId,
  config,
  onConfigChange,
}: WorkspaceConfigTabProps) {
  const t = useTranslations("workspaceSettings");
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [enabled, setEnabled] = React.useState(config?.autoCloseEnabled ?? true);
  const [hours, setHours] = React.useState(config?.autoCloseIdleAfterHours ?? 24);
  const [maxAgeOn, setMaxAgeOn] = React.useState(
    config?.autoCloseMaxAgeEnabled ?? true,
  );
  const [maxAgeHours, setMaxAgeHours] = React.useState(
    config?.autoCloseMaxAgeAfterHours ?? 168,
  );

  React.useEffect(() => {
    if (!config) return;
    setEnabled(config.autoCloseEnabled ?? true);
    setHours(config.autoCloseIdleAfterHours ?? 24);
    setMaxAgeOn(config.autoCloseMaxAgeEnabled ?? true);
    setMaxAgeHours(config.autoCloseMaxAgeAfterHours ?? 168);
  }, [config]);

  const dirty =
    !!config &&
    ((config.autoCloseEnabled ?? true) !== enabled ||
      (config.autoCloseIdleAfterHours ?? 24) !== hours ||
      (config.autoCloseMaxAgeEnabled ?? true) !== maxAgeOn ||
      (config.autoCloseMaxAgeAfterHours ?? 168) !== maxAgeHours);

  const handleSave = async () => {
    const clamped = Math.min(168, Math.max(1, Math.round(hours) || 24));
    const maxClamped = Math.min(2160, Math.max(24, Math.round(maxAgeHours) || 168));
    setHours(clamped);
    setMaxAgeHours(maxClamped);
    setSaving(true);
    const result = await updateWorkspaceConfigAction(workspaceId, {
      autoCloseEnabled: enabled,
      autoCloseIdleAfterHours: clamped,
      autoCloseMaxAgeEnabled: maxAgeOn,
      autoCloseMaxAgeAfterHours: maxClamped,
    });
    if (result.error || !result.config) {
      toast.error(result.error ?? t("autoClose.saveError"));
    } else {
      onConfigChange(result.config);
      toast.success(t("autoClose.saveSuccess"));
    }
    setSaving(false);
  };

  const clampHours = (raw: string, min: number, max: number, fallback: number) => {
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  };

  const anyOn = (config?.autoCloseEnabled ?? true) || (config?.autoCloseMaxAgeEnabled ?? true);

  return (
    <ConfigCardShell
      open={open}
      onToggle={() => setOpen((v) => !v)}
      icon={<ChatCircleDots weight="fill" className="h-4.5 w-4.5" />}
      title={t("autoClose.title")}
      description={t("autoClose.description")}
      statusLabel={anyOn ? t("configCard.active") : t("configCard.inactive")}
      statusActive={anyOn}
    >
      {/* Policy A: waiting on customer */}
      <div className="flex items-center justify-between gap-4 rounded-[--radius] border border-border px-4 py-3">
        <div className="pr-4 min-w-0">
          <p className="text-sm font-medium text-foreground">
            {t("autoClose.enableLabel")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("autoClose.enableHint")}
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={setEnabled}
          aria-label={t("autoClose.enableLabel")}
        />
      </div>

      <div className={cn("space-y-2", !enabled && "opacity-50")}>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">
            {t("autoClose.hoursLabel")}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={1}
              max={168}
              value={hours}
              disabled={!enabled}
              onChange={(e) =>
                setHours(clampHours(e.target.value, 1, 168, 24))
              }
              className="w-28 rounded-[--radius] border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary disabled:cursor-not-allowed"
            />
            <span className="text-xs text-muted-foreground">
              {t("autoClose.hoursUnit")}
            </span>
          </div>
          <span className="mt-1 block text-2xs text-muted-foreground">
            {t("autoClose.hint")}
          </span>
        </label>
      </div>

      {/* Policy C: absolute max age */}
      <div className="flex items-center justify-between gap-4 rounded-[--radius] border border-border px-4 py-3">
        <div className="pr-4 min-w-0">
          <p className="text-sm font-medium text-foreground">
            {t("autoClose.maxAgeEnableLabel")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("autoClose.maxAgeEnableHint")}
          </p>
        </div>
        <Switch
          checked={maxAgeOn}
          onCheckedChange={setMaxAgeOn}
          aria-label={t("autoClose.maxAgeEnableLabel")}
        />
      </div>

      <div className={cn("space-y-2", !maxAgeOn && "opacity-50")}>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">
            {t("autoClose.maxAgeHoursLabel")}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={24}
              max={2160}
              value={maxAgeHours}
              disabled={!maxAgeOn}
              onChange={(e) =>
                setMaxAgeHours(clampHours(e.target.value, 24, 2160, 168))
              }
              className="w-28 rounded-[--radius] border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary disabled:cursor-not-allowed"
            />
            <span className="text-xs text-muted-foreground">
              {t("autoClose.hoursUnit")}
            </span>
          </div>
          <span className="mt-1 block text-2xs text-muted-foreground">
            {t("autoClose.maxAgeHint")}
          </span>
        </label>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          disabled={saving || !dirty}
          onClick={handleSave}
          className="rounded-lg"
        >
          {saving ? (
            <CircleNotch className="h-3.5 w-3.5 animate-spin" weight="bold" />
          ) : (
            <FloppyDisk className="h-3.5 w-3.5" weight="bold" />
          )}
          {t("autoClose.save")}
        </Button>
      </div>
    </ConfigCardShell>
  );
}
