"use client";

import type {
  CampaignType,
  EntryType,
  WhatsAppCampaignTypeFilter,
} from "@/lib/conversations/types";
import {
  CaretUpDown,
  ChartBar,
  ChatCircle,
  Check,
  Leaf,
  Megaphone,
  Phone,
  WhatsappLogo,
  X,
} from "@/components/icons";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ResourceAction, ResourceType } from "@/lib/workspace/types";
import {
  CHANNEL_FILTERS,
  campaignTypeFor,
  entryTypeFor,
  isCampaignChannel as isCampaignChannelFilter,
  type ChannelFilter,
} from "@/lib/live-chat/channel-filter";
import { ChannelLogo } from "@/components/icons/channel-logos";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import ConsoleBank from "@/components/crm/ConsoleBank";
import CrmLayout from "@/components/crm/CrmLayout";
import type { CrmTranslations } from "@/components/crm/CrmLayout";
import type { Icon } from "@/components/icons";
import LiveOpsPanel from "./LiveOpsPanel";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import ElevatedButton from "@/components/elevated-design/button";
import { cn } from "@/lib/utils";
import { listWhatsAppCampaignsAction } from "@/app/actions/whatsapp-campaigns";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

/**
 * The channel filter model lives in lib/live-chat/channel-filter — one table,
 * independently tested, so adding a channel is a row rather than four
 * coordinated edits across this file.
 *
 * Instagram, Telegram and unofficial WhatsApp have no campaigns, they have
 * accounts, so they narrow the inbox by CHANNEL. WhatsApp Cloud and voice keep
 * their campaign sub-filters; the others hide them, because there is nothing to
 * sub-filter.
 */

interface LiveChatTranslations extends CrmTranslations {
  title: string;
  description: string;
  badge: string;
  filterAll: string;
  filterInstagram: string;
  filterTelegram: string;
  filterUnofficialWhatsapp: string;
  filterWhatsapp: string;
  filterVoice: string;
  filterAllCampaigns: string;
  filterStandard: string;
  filterOrganic: string;
  campaignSelectorPlaceholder: string;
  campaignSelectorSearch: string;
  campaignSelectorAll: string;
  campaignSelectorEmpty: string;
  campaignSelectorLoadMore: string;
}

interface LiveChatClientProps {
  translations: LiveChatTranslations;
}

/**
 * The mark for a channel option.
 *
 * Brand logos come from channel-logos, the one module allowed to carry a
 * network's own colours. "all" has no network behind it, so it takes a neutral
 * glyph rather than borrowing one.
 */
function channelFilterMark(value: ChannelFilter, size: "trigger" | "row" = "trigger") {
  // The row is taller than the trigger and its label is a size up, so the mark
  // grows with it. Same mark, two registers — not two different marks.
  const box = size === "row" ? "h-[18px] w-[18px]" : "h-4 w-4";
  if (value === "all") {
    return (
      <ChatCircle
        size={size === "row" ? 18 : 15}
        className="shrink-0 text-muted-foreground"
      />
    );
  }
  return <ChannelLogo channel={value} className={`${box} shrink-0`} />;
}

/**
 * A dropdown, not a pill row.
 *
 * The row was five options wide once unofficial WhatsApp joined it, on a header
 * that already carries the campaign filter, the stage/label/assignee filters and
 * the view switcher. A filter that pushes the rest of the toolbar off the line
 * is costing more space than the one selected value is worth — and only one
 * value is ever active, which is precisely the shape a select is for.
 *
 * Options gated by permission stay VISIBLE and disabled rather than being
 * dropped: a channel missing from the list reads as "we don't support it", a
 * disabled one reads as "you can't see it", and those are different facts.
 */
function ChannelFilterToggle({
  activeFilter,
  onFilterChange,
  translations: t,
  canRead,
}: {
  activeFilter: ChannelFilter;
  onFilterChange: (f: ChannelFilter) => void;
  translations: LiveChatTranslations;
  canRead: (resource: ResourceType, action: ResourceAction) => boolean;
}) {
  const label = (key: string) =>
    (t as unknown as Record<string, string>)[key] ?? key;

  return (
    <ElevatedSelect
      value={activeFilter}
      onValueChange={(v) => onFilterChange(v as ChannelFilter)}
      aria-label={t.filterAll}
      contentClassName="min-w-[13rem]"
      trigger={
        // Geometry copied from the campaign selector standing next to it —
        // h-8, text-xs, px-2.5, gap-1.5, CaretUpDown at 12/50%. A control that
        // is one step taller and one size larger than its neighbour reads as a
        // mistake even when nothing about it is wrong on its own, and this row
        // is where the two sit side by side.
        <button
          type="button"
          className={cn(
            "flex h-8 w-auto max-w-[14rem] shrink-0 items-center gap-1.5 rounded-[--radius] border border-control-edge bg-card px-2.5 text-xs font-medium transition-colors",
            activeFilter === "all"
              ? "text-muted-foreground hover:text-foreground"
              : "text-foreground",
          )}
        >
          {channelFilterMark(activeFilter)}
          <span className="min-w-0 flex-1 truncate text-left">
            {label(
              CHANNEL_FILTERS.find((s) => s.value === activeFilter)?.labelKey ??
                "filterAll",
            )}
          </span>
          <CaretUpDown size={12} className="shrink-0 opacity-50" />
        </button>
      }
    >
      {CHANNEL_FILTERS.map(({ value, labelKey, permission }) => (
        <ElevatedSelectItem
          key={value}
          value={value}
          disabled={
            permission != null &&
            !canRead(
              permission.resource as ResourceType,
              permission.action as ResourceAction,
            )
          }
          icon={channelFilterMark(value, "row")}
          // iconStyled defaults to TRUE, which puts the mark on a solid
          // bg-primary plate. That is right for a monochrome glyph meant to be
          // read as --primary-foreground, and wrong for every mark here:
          // WhatsApp's logo is green, so it vanished into the green plate, and
          // Instagram's is a multi-colour gradient sitting on a saturated block
          // of an unrelated hue — the "prop-coloured block under a coloured
          // glyph" the design rules single out. Channel marks carry their own
          // fixed colours and are never recoloured or re-grounded; they belong
          // on the plain popover surface, the way the inbox rows show them.
          iconStyled={false}
        >
          {label(labelKey)}
        </ElevatedSelectItem>
      ))}
    </ElevatedSelect>
  );
}

type WACampaignFilter = "all" | WhatsAppCampaignTypeFilter;

const waCampaignFilterOptions: {
  value: WACampaignFilter;
  icon: Icon;
  labelKey: keyof Pick<
    LiveChatTranslations,
    "filterAllCampaigns" | "filterStandard" | "filterOrganic"
  >;
}[] = [
  { value: "all", icon: ChatCircle, labelKey: "filterAllCampaigns" },
  { value: "standard", icon: Megaphone, labelKey: "filterStandard" },
  { value: "organic", icon: Leaf, labelKey: "filterOrganic" },
];

function WACampaignFilterToggle({
  activeFilter,
  onFilterChange,
  translations: t,
}: {
  activeFilter: WACampaignFilter;
  onFilterChange: (f: WACampaignFilter) => void;
  translations: LiveChatTranslations;
}) {
  const options = useMemo(
    () =>
      waCampaignFilterOptions.map(({ value, icon: Icon, labelKey }) => ({
        value,
        label: t[labelKey],
        icon: (
          <Icon
            size={14}
            weight={activeFilter === value ? "fill" : "regular"}
          />
        ),
      })),
    [activeFilter, t],
  );

  return (
    <ElevatedPillToggle
      bare
      options={options}
      value={activeFilter}
      onChange={onFilterChange}
      size="md"
      collapseLabels="md"
      aria-label={t.filterAllCampaigns}
    />
  );
}


interface CampaignOption {
  id: string;
  name: string;
  type: "voice" | "whatsapp";
}

function CampaignSelector({
  channelFilter,
  waTypeFilter,
  selectedId,
  onSelect,
  translations: t,
}: {
  channelFilter: ChannelFilter;
  waTypeFilter: WACampaignFilter;
  selectedId: string;
  onSelect: (id: string, type: CampaignType | undefined) => void;
  translations: LiveChatTranslations;
}) {
  const { currentWorkspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [waPage, setWaPage] = useState(1);
  const [waTotalPages, setWaTotalPages] = useState(1);
  const loadingMore = useRef(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const load = async () => {
      const results: CampaignOption[] = [];

      if (channelFilter === "whatsapp" || channelFilter === "all") {
        const waType = waTypeFilter === "all" ? undefined : waTypeFilter;
        const r = await listWhatsAppCampaignsAction(
          1,
          50,
          "desc",
          currentWorkspace?.id,
          waType,
        );
        if (!cancelled && r.campaigns) {
          for (const c of r.campaigns) {
            results.push({ id: c.id, name: c.name, type: "whatsapp" });
          }
          setWaTotalPages(r.meta?.totalPages ?? 1);
        }
      }

      if (!cancelled) {
        setCampaigns(results);
        setLoading(false);
      }
    };

    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setCampaigns([]);
      setWaPage(1);
      setWaTotalPages(1);
    });
    load();
    return () => {
      cancelled = true;
    };
  }, [open, channelFilter, waTypeFilter, currentWorkspace?.id]);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore.current || waPage >= waTotalPages) return;
    loadingMore.current = true;
    const nextPage = waPage + 1;
    const waType = waTypeFilter === "all" ? undefined : waTypeFilter;
    const r = await listWhatsAppCampaignsAction(
      nextPage,
      50,
      "desc",
      currentWorkspace?.id,
      waType,
    );
    if (r.campaigns) {
      setCampaigns((prev) => [
        ...prev,
        ...r.campaigns.map((c) => ({
          id: c.id,
          name: c.name,
          type: "whatsapp" as const,
        })),
      ]);
      setWaPage(nextPage);
      setWaTotalPages(r.meta?.totalPages ?? 1);
    }
    loadingMore.current = false;
  }, [waPage, waTotalPages, waTypeFilter, currentWorkspace?.id]);

  const selectedCampaign = campaigns.find((c) => c.id === selectedId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex h-8 w-auto max-w-[16rem] shrink-0 items-center gap-1.5 rounded-[--radius] border border-control-edge bg-card px-2.5 text-xs font-medium transition-colors",
            selectedId
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Megaphone size={14} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            {selectedCampaign?.name ?? t.campaignSelectorPlaceholder}
          </span>
          {selectedId ? (
            <X
              size={12}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onSelect("", undefined);
              }}
            />
          ) : (
            <CaretUpDown size={12} className="shrink-0 opacity-50" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0" align="start">
        <Command>
          <CommandInput placeholder={t.campaignSelectorSearch} />
          <CommandList>
            <CommandEmpty>
              {loading ? "..." : t.campaignSelectorEmpty}
            </CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__all__"
                onSelect={() => {
                  onSelect("", undefined);
                  setOpen(false);
                }}
              >
                <Check
                  size={14}
                  className={cn(
                    "mr-2 shrink-0",
                    !selectedId ? "opacity-100" : "opacity-0",
                  )}
                />
                {t.campaignSelectorAll}
              </CommandItem>
              {campaigns.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.name}
                  onSelect={() => {
                    onSelect(c.id, c.type);
                    setOpen(false);
                  }}
                >
                  <Check
                    size={14}
                    className={cn(
                      "mr-2 shrink-0",
                      selectedId === c.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="flex items-center gap-1.5 truncate">
                    {c.type === "whatsapp" ? (
                      <WhatsappLogo size={12} className="shrink-0" />
                    ) : (
                      <Phone size={12} className="shrink-0" />
                    )}
                    {c.name} {c.id}
                  </span>
                </CommandItem>
              ))}
              {channelFilter !== "voice" && waPage < waTotalPages && (
                <CommandItem
                  value="__load_more__"
                  onSelect={handleLoadMore}
                  className="justify-center text-xs text-muted-foreground"
                >
                  {t.campaignSelectorLoadMore}
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}


function LiveChatContent({
  translations: t,
}: {
  translations: LiveChatTranslations;
}) {
  const { can, permissionsLoading } = useWorkspace();
  const tOps = useTranslations("liveChat.opsDashboard");
  const tBoard = useTranslations("crmBoard");

  /** Owner/admin always can; members need attendance:read (metrics RBAC). */
  const canUseOpsMetrics = !permissionsLoading && can("attendance", "read");

  const [activeFilter, setActiveFilter] = useState<ChannelFilter>("all");
  const [waCampaignFilter, setWaCampaignFilter] =
    useState<WACampaignFilter>("all");
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [selectedCampaignType, setSelectedCampaignType] = useState<
    CampaignType | undefined
  >(undefined);
  const [opsOpen, setOpsOpen] = useState(false);

  useEffect(() => {
    if (!canUseOpsMetrics && opsOpen) setOpsOpen(false);
  }, [canUseOpsMetrics, opsOpen]);

  // Both narrowings come from the shared table now. They used to be two inline
  // ternaries listing channels by hand, which is why adding one meant editing
  // several expressions and the miss was silent: a channel present in the button
  // list but absent from the entry-type ternary looks like a working filter and
  // selects nothing.
  const isCampaignChannel = isCampaignChannelFilter(activeFilter);
  const campaignType: CampaignType | undefined =
    selectedCampaignId && selectedCampaignType
      ? selectedCampaignType
      : campaignTypeFor(activeFilter);

  const channelFilter: EntryType | undefined = entryTypeFor(activeFilter);

  const whatsappCampaignType: WhatsAppCampaignTypeFilter | undefined =
    waCampaignFilter === "all" ? undefined : waCampaignFilter;

  const handleFilterChange = useCallback((filter: ChannelFilter) => {
    setActiveFilter(filter);
    setSelectedCampaignId("");
    setSelectedCampaignType(undefined);
  }, []);

  const handleWaCampaignFilterChange = useCallback(
    (filter: WACampaignFilter) => {
      setWaCampaignFilter(filter);
      setSelectedCampaignId("");
      setSelectedCampaignType(undefined);
    },
    [],
  );

  const handleCampaignSelect = useCallback(
    (id: string, type: CampaignType | undefined) => {
      setSelectedCampaignId(id);
      setSelectedCampaignType(type);
    },
    [],
  );

  // Campaign controls only mean something for channels that HAVE campaigns.
  // Instagram and Telegram are organised by account, so both the type toggle
  // and the campaign picker are hidden for them rather than shown empty.
  const showWaCampaignFilter = activeFilter === "whatsapp" || activeFilter === "all";
  const showCampaignPicker = isCampaignChannel || activeFilter === "all";

  return (
    <div className="relative -m-3 h-[calc(100dvh-3rem)] min-h-[480px] w-[calc(100%+1.5rem)] overflow-hidden sm:-m-6 sm:w-[calc(100%+3rem)]">
      <CrmLayout
        campaignType={campaignType}
        channelFilter={channelFilter}
        whatsappCampaignType={
          showWaCampaignFilter ? whatsappCampaignType : undefined
        }
        translations={t}
        embedded
        toolbarExtra={
          <>
            <ConsoleBank
              className="[&>div]:contents"
              legend={tBoard("bank.channel")}
            >
              <span data-tour="live-chat-filters" className="contents">
                <ChannelFilterToggle
                  activeFilter={activeFilter}
                  onFilterChange={handleFilterChange}
                  translations={t}
                  canRead={can}
                />
              </span>
            </ConsoleBank>
            {showWaCampaignFilter || showCampaignPicker ? (
              <ConsoleBank legend={tBoard("bank.campaign")}>
                {showWaCampaignFilter && (
                  <WACampaignFilterToggle
                    activeFilter={waCampaignFilter}
                    onFilterChange={handleWaCampaignFilterChange}
                    translations={t}
                  />
                )}
                {showCampaignPicker && (
                  <CampaignSelector
                    channelFilter={activeFilter}
                    waTypeFilter={waCampaignFilter}
                    selectedId={selectedCampaignId}
                    onSelect={handleCampaignSelect}
                    translations={t}
                  />
                )}
              </ConsoleBank>
            ) : null}
          </>
        }
        toolbarBeforeUsers={
          canUseOpsMetrics ? (
            <ElevatedButton
              type="button"
              variant={opsOpen ? "primary" : "outline-subtle"}
              size="sm"
              className="shrink-0"
              title={tOps("buttonLabel")}
              titleClassName="max-md:sr-only"
              aria-label={tOps("openTooltip")}
              aria-pressed={opsOpen}
              onClick={() => setOpsOpen((v) => !v)}
              icon={
                <ChartBar
                  className="h-4 w-4"
                  weight={opsOpen ? "fill" : "bold"}
                />
              }
              iconVisible
            />
          ) : null
        }
      />
      {canUseOpsMetrics ? (
        <LiveOpsPanel
          open={opsOpen}
          onClose={() => setOpsOpen(false)}
          campaignType={campaignType}
        />
      ) : null}
    </div>
  );
}

export default function LiveChatClient({ translations }: LiveChatClientProps) {
  return <LiveChatContent translations={translations} />;
}
