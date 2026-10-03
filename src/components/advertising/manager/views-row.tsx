"use client";

import { useTranslations } from "next-intl";

import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { MagnifyingGlass } from "@/components/icons";
import { QUICK_VIEWS, type QuickView } from "@/lib/advertising/manager-views";

export function ViewsRow({
  view,
  onView,
  search,
  onSearch,
}: {
  view: QuickView;
  onView: (view: QuickView) => void;
  search: string;
  onSearch: (search: string) => void;
}) {
  const t = useTranslations("adsManager.views");
  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
      <div className="max-w-full overflow-x-auto">
        <ElevatedPillToggle<QuickView>
          aria-label={t("label")}
          size="md"
          value={view}
          onChange={onView}
          options={QUICK_VIEWS.map((option) => ({ value: option, label: t(option) }))}
        />
      </div>
      <div className="min-w-0 flex-1">
        <ElevatedInput
          type="search"
          placeholder={t("search")}
          aria-label={t("search")}
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          icon={<MagnifyingGlass className="h-4 w-4" weight="bold" />}
          controlSize="sm"
        />
      </div>
    </div>
  );
}
