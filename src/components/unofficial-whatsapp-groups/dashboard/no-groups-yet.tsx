"use client";

import { useTranslations } from "next-intl";

import { CircuitTraces } from "@/components/brand/circuit";
import { LightPool } from "@/components/brand/light-pool";
import Button from "@/components/elevated-design/button";
import { LinkSimple, MagnifyingGlass, Plus, SignIn, UsersThree } from "@/components/icons";
import { groupsRoutes } from "@/components/unofficial-whatsapp-groups/kit/routes";
import { screenPaths } from "@/lib/navigation/routes";

export function NoGroupsYet({
  hasNumbers,
  canDiscover,
  canCreate,
  canConnect,
}: {
  hasNumbers: boolean;
  canDiscover: boolean;
  canCreate: boolean;
  canConnect: boolean;
}) {
  const t = useTranslations("unofficialGroups.dashboard.noGroups");
  const anyAction = (!hasNumbers && canConnect) || (hasNumbers && (canDiscover || canCreate));

  return (
    <section className="relative flex flex-col items-center overflow-hidden rounded-[--radius] border border-border bg-card px-6 py-16 text-center shadow-sm">
      <LightPool />
      <CircuitTraces aria-hidden="true" className="pointer-events-none absolute left-1/2 top-2 h-40 w-40 -translate-x-1/2 sm:h-48 sm:w-48" />
      <div className="relative mb-3 flex h-14 w-14 items-center justify-center rounded-[--radius] bg-muted text-muted-foreground [&_svg]:h-7 [&_svg]:w-7">
        <UsersThree aria-hidden />
      </div>
      <h2 className="relative mb-1 font-display text-base font-semibold tracking-[0.01em] text-foreground">{t("title")}</h2>
      <p className="relative mb-5 max-w-md text-sm text-muted-foreground">{hasNumbers ? t("description") : t("descriptionNoNumbers")}</p>
      <div className="relative flex flex-wrap items-center justify-center gap-2">
        {!hasNumbers && canConnect ? (
          <Button
            variant="primary"
            link={screenPaths.unofficial_number_connect}
            newTab={false}
            title={t("connect")}
            icon={<LinkSimple className="h-4 w-4" weight="bold" />}
            iconVisible
            iconSide="left"
          />
        ) : null}
        {hasNumbers && canDiscover ? (
          <Button
            variant="primary"
            link={groupsRoutes.all({ action: "discover" })}
            newTab={false}
            title={t("discover")}
            icon={<MagnifyingGlass className="h-4 w-4" weight="bold" />}
            iconVisible
            iconSide="left"
          />
        ) : null}
        {hasNumbers && canCreate ? (
          <>
            <Button
              variant="secondary"
              link={groupsRoutes.all({ action: "join" })}
              newTab={false}
              title={t("join")}
              icon={<SignIn className="h-4 w-4" weight="bold" />}
              iconVisible
              iconSide="left"
            />
            <Button
              variant="secondary"
              link={groupsRoutes.all({ action: "create" })}
              newTab={false}
              title={t("create")}
              icon={<Plus className="h-4 w-4" weight="bold" />}
              iconVisible
              iconSide="left"
            />
          </>
        ) : null}
      </div>
      {!anyAction ? <p className="relative text-xs text-muted-foreground">{hasNumbers ? t("askAdmin") : t("askAdminConnect")}</p> : null}
    </section>
  );
}
