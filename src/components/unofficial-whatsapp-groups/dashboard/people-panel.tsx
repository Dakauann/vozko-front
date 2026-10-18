"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { personSource } from "@/app/[locale]/dashboard/unofficial-whatsapp-groups/people/people-model";
import { listGroupPeopleAction } from "@/app/actions/unofficial-whatsapp-groups";
import { Skeleton } from "@/components/audience/shared";
import { UsersFour } from "@/components/icons";
import { PanelFault } from "@/components/unofficial-whatsapp-groups/kit/chart-panel";
import { QuietEmpty } from "@/components/unofficial-whatsapp-groups/kit/empty";
import { CountChip, SearchField, WindowToggle } from "@/components/unofficial-whatsapp-groups/kit/filters";
import { GroupLinks, PersonIdentity } from "@/components/unofficial-whatsapp-groups/kit/identity";
import { PagedFooter } from "@/components/unofficial-whatsapp-groups/kit/paged-footer";
import { GroupsPanel } from "@/components/unofficial-whatsapp-groups/kit/panel";
import { groupsRoutes } from "@/components/unofficial-whatsapp-groups/kit/routes";
import { Link } from "@/i18n/routing";
import type { GroupPerson } from "@/lib/unofficial-whatsapp-groups/types";

import { DEFAULT_MIN_GROUPS, MIN_GROUP_OPTIONS, payloadPeoplePage, PEOPLE_PAGE_SIZE, type PeoplePage } from "./dashboard-data";

const PERSON_GROUP_CHIPS = 4;

type MinGroups = (typeof MIN_GROUP_OPTIONS)[number];

interface FetchedPage extends PeoplePage {
  key: string;
}

export function CrossGroupPeoplePanel({
  people,
  total,
  pending = false,
  canOpenLeads,
  refreshKey,
  className,
}: {
  people: GroupPerson[];
  total: number;
  pending?: boolean;
  canOpenLeads: boolean;
  refreshKey: number;
  className?: string;
}) {
  const t = useTranslations("unofficialGroups.dashboard.peoplePanel");
  const [search, setSearch] = useState("");
  const [minGroups, setMinGroups] = useState<MinGroups>(DEFAULT_MIN_GROUPS);
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [fetched, setFetched] = useState<FetchedPage | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);

  const fromPayload = useMemo(
    () => (pending ? null : payloadPeoplePage(people, total, { search, minGroups, page })),
    [pending, people, total, search, minGroups, page],
  );
  const requestKey = `${search}#${minGroups}#${page}#${attempt}#${refreshKey}`;

  useEffect(() => {
    if (pending || fromPayload) return;
    let cancelled = false;
    void listGroupPeopleAction({ search: search || undefined, minGroups, page, pageSize: PEOPLE_PAGE_SIZE }).then((result) => {
      if (cancelled) return;
      if (result.error) {
        setError({ key: requestKey, message: result.error });
      } else {
        setError(null);
        setFetched({
          key: requestKey,
          items: result.items.map((person) => ({ ...person, groups: person.groups ?? [] })),
          totalItems: result.meta.totalItems,
          totalPages: result.meta.totalPages,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pending, fromPayload, search, minGroups, page, requestKey]);

  const current: PeoplePage | null = pending ? null : (fromPayload ?? (fetched?.key === requestKey ? fetched : null));
  const failed = !pending && !fromPayload && error?.key === requestKey ? error.message : null;
  const loading = !current && !failed;
  const shownPage = pending ? null : (current ?? fetched);
  const chipCount = fromPayload ? total : (current?.totalItems ?? fetched?.totalItems ?? total);

  return (
    <GroupsPanel
      title={t("title")}
      subtitle={t("subtitle")}
      meta={<CountChip count={chipCount} noun={(count) => t("count", { count })} filtered={search !== "" || minGroups !== DEFAULT_MIN_GROUPS} loading={loading} />}
      className={className}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchField
          value={search}
          onChange={(next) => {
            setSearch(next);
            setPage(1);
          }}
          placeholder={t("search")}
          ariaLabel={t("search")}
          className="min-w-[12rem] flex-1"
        />
        <WindowToggle<MinGroups>
          ariaLabel={t("minLabel")}
          value={minGroups}
          onChange={(next) => {
            setMinGroups(next);
            setPage(1);
          }}
          options={MIN_GROUP_OPTIONS.map((value) => ({ value, label: t("min", { count: value }) }))}
        />
      </div>
      {failed ? (
        <PanelFault error={{ message: failed, onRetry: () => setAttempt((value) => value + 1) }} />
      ) : loading && !shownPage ? (
        <div className="grid gap-x-6 gap-y-2.5 md:grid-cols-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : shownPage && shownPage.items.length === 0 ? (
        <QuietEmpty icon={<UsersFour />} message={search ? t("emptySearch", { search }) : t("empty", { count: minGroups })} />
      ) : shownPage ? (
        <div aria-busy={loading || undefined} className={loading ? "opacity-60" : undefined}>
          <ul className="grid gap-x-6 md:grid-cols-2">
            {shownPage.items.map((person) => (
              <li key={person.personKey} className="min-w-0 border-b border-border/60 py-2">
                <PersonIdentity
                  person={personSource(person)}
                  showJid
                  href={canOpenLeads && person.leadId ? groupsRoutes.lead(person.leadId) : undefined}
                  trailing={
                    <span className="readout ml-auto shrink-0 text-xs font-semibold tabular-nums text-foreground">
                      {t("groups", { count: person.groupCount })}
                    </span>
                  }
                />
                <div className="mt-1.5 pl-9">
                  <GroupLinks groups={person.groups} limit={PERSON_GROUP_CHIPS} />
                </div>
              </li>
            ))}
          </ul>
          <PagedFooter
            page={page}
            totalPages={shownPage.totalPages}
            totalItems={shownPage.totalItems}
            itemsLabel={(count) => t("count", { count })}
            onPage={setPage}
            busy={loading}
          />
        </div>
      ) : null}
      <div className="mt-3 flex justify-end">
        <Link
          href={groupsRoutes.people({ search: search || undefined, minGroups })}
          className="rounded-sm text-xs font-medium text-primary-ink underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("seeAll")}
        </Link>
      </div>
    </GroupsPanel>
  );
}
