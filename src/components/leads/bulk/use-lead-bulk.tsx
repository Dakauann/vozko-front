"use client";

import { useCallback, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { fetchLeadSection } from "@/app/actions/leads";
import type { DashboardTableSelection } from "@/components/elevated-design/table/dashboard-table";
import type { MapSelectionBarView } from "@/components/leads/map/LeadsMapView";
import { LeadSendDialog } from "@/components/leads/sends/LeadSendDialog";
import { useLeadSendGate } from "@/components/leads/sends/use-lead-send-gate";
import { SelectionCount, type SelectionOffer } from "@/components/selection/SelectionCount";
import { useBulkSelection, type WideCount } from "@/components/selection/use-bulk-selection";
import { useAccess } from "@/hooks/use-access";
import { useDialTargets } from "@/hooks/use-dial-targets";
import { emptyCrmFilter, isEmptyCrmFilter, type CrmFilter } from "@/lib/crm/board";
import type { CustomFieldDefinition } from "@/lib/crm/custom-fields";
import type { LeadActionKind, LeadActionStart } from "@/lib/leads/actions";
import {
  effectiveLeadFilter,
  leadBulkAccess,
  leadBulkActionStates,
  leadSelection,
  leadSelectionScope,
  pickedAfterMapChange,
  visibleMapPicks,
  type MapPickGroups,
} from "@/lib/leads/bulk-selection";
import type { LeadSort } from "@/lib/leads/types";
import { offersAllMatching } from "@/lib/selection/bulk-state";

import { LeadActionDialog } from "./LeadActionDialog";
import { LeadBulkBar } from "./LeadBulkBar";
import { LeadSelectionModes } from "./LeadSelectionModes";
import { useLeadActionTracker } from "./use-lead-action-tracker";

const NAMESPACE = "leadsPage.selection";
const NO_DIALABLE_TRUNK = "no_dialable_trunk";

export interface UseLeadBulkOptions {
  filter: CrmFilter;
  search: string;
  sorts: readonly LeadSort[];
  filterInvalid: boolean;
  fields: readonly CustomFieldDefinition[];
  classificationKey?: string;
  onSettled: () => void;
}

export function useLeadBulk({ filter, search, sorts, filterInvalid, fields, classificationKey, onSettled }: UseLeadBulkOptions) {
  const t = useTranslations(NAMESPACE);
  const tMap = useTranslations("leadMap.selection");
  const { decideCapabilities } = useAccess();
  const context = { filter, search, sorts };
  const scope = leadSelectionScope(context);
  const selection = useBulkSelection(scope);
  const { setPicked, clear, select, widen } = selection;

  const [mapPicks, setMapPicks] = useState<{ scope: string; picks: MapPickGroups }>({ scope, picks: {} });
  if (mapPicks.scope !== scope) setMapPicks({ scope, picks: {} });
  const shownPicks = mapPicks.scope === scope ? visibleMapPicks(mapPicks.picks, selection.picked) : {};

  const [dialog, setDialog] = useState<LeadActionKind | null>(null);

  const track = useLeadActionTracker({ onSettled });
  const started = useCallback(
    (start: LeadActionStart) => {
      if (start.run) clear();
      track(start);
    },
    [clear, track],
  );

  const access = leadBulkAccess(decideCapabilities);
  const sends = useLeadSendGate();
  const dialLines = useDialTargets({ enabled: access.permissions.manageCallLists });
  const noDialableLine = dialLines.blocker === NO_DIALABLE_TRUNK;
  const chosen = leadSelection(selection.state, context);
  const filtered = !isEmptyCrmFilter(effectiveLeadFilter(filter, search));
  const statesFor = (hasSelection: boolean) =>
    leadBulkActionStates({
      filterInvalid,
      hasSelection,
      hasEditableFields: fields.length > 0,
      checking: access.checking,
      permissions: access.permissions,
      sends,
      noDialableLine,
    });
  const states = statesFor(chosen !== null);
  const engaged = selection.size > 0 || selection.wide !== null || selection.counting !== null;

  const countEveryone = useCallback(async (): Promise<WideCount | null> => {
    try {
      const summary = await fetchLeadSection("summary", { filter: emptyCrmFilter, q: "" });
      return { matched: summary.total };
    } catch {
      toast.error(t("countFailed"));
      return null;
    }
  }, [t]);

  const chooseEveryone = useCallback(
    (total: number) => {
      if (filtered) void widen("everyone", countEveryone);
      else select({ mode: "everyone", matched: total });
    },
    [filtered, widen, countEveryone, select],
  );

  const sort = sorts[0];
  const sortLabel = sort ? t("sortLabel", { field: t(`sortKeys.${sort.key}`), direction: t(`sortDirections.${sort.direction}`) }) : t("sortDefault");

  const countLabel = (total: number | null, offer: SelectionOffer | null): ReactNode => (
    <SelectionCount
      namespace={NAMESPACE}
      picked={selection.picked.size}
      wide={selection.wide}
      counting={selection.counting !== null}
      offer={offer}
      onSelectAll={() => {
        if (!offer) return;
        if (offer.mode === "everyone") chooseEveryone(offer.count);
        else select({ mode: "all_matching", matched: offer.count });
      }}
      onClear={clear}
      modes={
        total === null ? null : (
          <LeadSelectionModes
            quantityReason={filtered ? null : t("quantityNeedsFilter")}
            sortLabel={sortLabel}
            onQuantity={(limit) => select({ mode: "first_n", matched: total, limit })}
            onEveryone={() => chooseEveryone(total)}
          />
        )
      }
    />
  );

  const bar = <LeadBulkBar states={states} onAction={setDialog} onClear={clear} />;

  const offerFor = (total: number, eligible: boolean): SelectionOffer | null =>
    eligible ? { count: total, mode: filtered ? "all_matching" : "everyone" } : null;

  const tableSelection = (pageKeys: readonly string[], total: number): DashboardTableSelection | undefined =>
    filterInvalid
      ? undefined
      : {
          selectedKeys: selection.picked,
          onSelectionChange: setPicked,
          active: engaged,
          actions: () => bar,
          label: () => countLabel(total, offerFor(total, offersAllMatching(selection.picked, pageKeys, total))),
          selectAllLabel: t("selectPage"),
          selectRowLabel: t("selectRow"),
        };

  const mapBar = ({ total, inArea }: MapSelectionBarView): ReactNode => {
    if (filterInvalid) return null;
    if (engaged) {
      const offer = selection.wide === null && total !== null ? offerFor(total, total > selection.picked.size) : null;
      return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border bg-card px-4 py-2">
          {countLabel(total, offer)}
          {bar}
        </div>
      );
    }
    if (!filtered || total === null || total < 1) return null;
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border bg-card px-4 py-2">
        <span className="whitespace-nowrap text-sm font-semibold text-primary-ink" aria-live="polite">
          {inArea ? tMap("inArea", { count: total }) : t("inFilter", { count: total })}
        </span>
        <LeadBulkBar
          states={statesFor(true)}
          onAction={(action) => {
            select({ mode: "all_matching", matched: total });
            setDialog(action);
          }}
        />
      </div>
    );
  };

  const onMapPicksChange = (next: MapPickGroups) => {
    setPicked(pickedAfterMapChange(selection.picked, shownPicks, next));
    setMapPicks({ scope, picks: next });
  };

  const sendDialog =
    chosen && (dialog === "send_template" || dialog === "send_unofficial") ? (
      <LeadSendDialog action={dialog} selection={chosen} size={selection.size} onClose={() => setDialog(null)} />
    ) : null;

  const dialogElement =
    sendDialog ??
    (dialog && chosen ? (
      <LeadActionDialog
        action={dialog}
        selection={chosen}
        size={selection.size}
        fields={fields}
        defaultField={classificationKey}
        readsAddresses={access.readsAddresses}
        readsSensitive={access.readsSensitive}
        onClose={() => setDialog(null)}
        onStarted={started}
      />
    ) : null);

  return { selection, tableSelection, mapBar, mapPicks: shownPicks, onMapPicksChange, dialog: dialogElement };
}
