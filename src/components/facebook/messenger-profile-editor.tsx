"use client";

import { ArrowClockwise, Plus, Trash, Warning } from "@/components/icons";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { getMessengerProfileAction, updateMessengerProfileAction } from "@/app/actions/facebook";
import Button from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import Textarea from "@/components/elevated-design/elevated-textarea";
import { useFacebookError } from "@/components/facebook/use-facebook-error";
import {
  DEFAULT_PROFILE_LOCALE,
  GET_STARTED_PAYLOAD,
  MAX_GREETING_CHARS,
  MAX_ICE_BREAKERS,
  MAX_MENU_ITEMS,
  MAX_MENU_TITLE_CHARS,
  greetingFor,
  iceBreakersFor,
  isProfileLocale,
  menuFor,
  normalizeMessengerProfile,
  profileLocales,
  profileProblems,
  withGreeting,
  withIceBreakers,
  withMenu,
} from "@/lib/facebook/messenger-profile";
import type { MessengerMenuItem, MessengerProfile } from "@/lib/facebook/types";

type LoadState =
  | { status: "loading" }
  | { status: "failed"; message: string }
  | { status: "ready"; profile: MessengerProfile };

export function MessengerProfileEditor({
  pageId,
  canEdit,
  disabledReason,
}: {
  pageId: string;
  canEdit: boolean;
  disabledReason?: string;
}) {
  const t = useTranslations("facebook.profile");
  const describeError = useFacebookError();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [locale, setLocale] = useState(DEFAULT_PROFILE_LOCALE);
  const [extraLocales, setExtraLocales] = useState<string[]>([]);
  const [newLocale, setNewLocale] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getMessengerProfileAction(pageId).then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        setState({ status: "failed", message: describeError(result) });
        return;
      }
      setState({ status: "ready", profile: normalizeMessengerProfile(result.profile) });
    });
    return () => {
      cancelled = true;
    };
  }, [pageId, reloadKey, describeError]);

  if (state.status === "loading") {
    return <div className="h-64 animate-pulse rounded-[--radius] bg-muted" />;
  }

  if (state.status === "failed") {
    return (
      <ElevatedContainer className="flex flex-col items-start gap-3 p-5 text-sm">
        <p className="flex items-start gap-2 text-destructive-ink">
          <Warning className="mt-0.5 h-4 w-4 shrink-0" />
          {t("loadFailed", { error: state.message })}
        </p>
        <Button
          variant="secondary"
          size="sm"
          title={t("retry")}
          icon={<ArrowClockwise className="h-3.5 w-3.5" />}
          onClick={() => {
            setState({ status: "loading" });
            setReloadKey((k) => k + 1);
          }}
        />
      </ElevatedContainer>
    );
  }

  const profile = state.profile;
  const update = (next: MessengerProfile) => {
    setSaved(false);
    setState({ status: "ready", profile: next });
  };
  const locales = [...new Set([...profileLocales(profile), ...extraLocales])];
  const greeting = greetingFor(profile, locale);
  const iceBreakers = iceBreakersFor(profile, locale);
  const menu = menuFor(profile, locale);
  const problems = profileProblems(profile);
  const disabled = !canEdit || saving;

  const setMenuItems = (items: MessengerMenuItem[]) =>
    update(withMenu(profile, locale, { locale, composerInputDisabled: menu?.composerInputDisabled ?? false, items }));

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    const result = await updateMessengerProfileAction(pageId, profile);
    setSaving(false);
    if ("error" in result) {
      setSaveError(describeError(result));
      return;
    }
    setState({ status: "ready", profile: normalizeMessengerProfile(result.profile) });
    setSaved(true);
  };

  return (
    <ElevatedContainer className="overflow-hidden !p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{t("title")}</h2>
          <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex items-end gap-2">
          <div className="w-40">
            <ElevatedSelect label={t("locale")} value={locale} onValueChange={setLocale}>
              {locales.map((code) => (
                <ElevatedSelectItem key={code} value={code}>
                  {code === DEFAULT_PROFILE_LOCALE ? t("localeDefault") : code}
                </ElevatedSelectItem>
              ))}
            </ElevatedSelect>
          </div>
          <div className="w-28">
            <ElevatedInput
              label={t("addLocale")}
              value={newLocale}
              placeholder="pt_BR"
              disabled={disabled}
              onChange={(e) => setNewLocale(e.target.value.trim())}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || !isProfileLocale(newLocale)) return;
                setExtraLocales((prev) => [...prev, newLocale]);
                setLocale(newLocale);
                setNewLocale("");
              }}
            />
          </div>
        </div>
      </div>

      <div className="space-y-6 p-5">
        {!canEdit && disabledReason ? (
          <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">{disabledReason}</p>
        ) : null}

        <section className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">{t("greeting")}</label>
          <Textarea
            value={greeting}
            rows={2}
            disabled={disabled}
            placeholder={t("greetingPlaceholder")}
            onChange={(e) => update(withGreeting(profile, locale, e.target.value))}
          />
          <p className="flex justify-between text-2xs text-muted-foreground">
            <span>{t("greetingHint")}</span>
            <span className="tabular-nums">
              {Array.from(greeting).length}/{MAX_GREETING_CHARS}
            </span>
          </p>
        </section>

        <section className="flex items-start justify-between gap-4 border-t border-border pt-5">
          <div className="min-w-0 space-y-0.5">
            <span className="text-sm font-medium text-foreground">{t("getStarted")}</span>
            <p className="text-xs text-muted-foreground">{t("getStartedHint")}</p>
          </div>
          <ElevatedSwitch
            checked={profile.getStarted !== null}
            disabled={disabled}
            aria-label={t("getStarted")}
            onCheckedChange={(on: boolean) =>
              update({ ...profile, getStarted: on ? (profile.getStarted ?? { payload: GET_STARTED_PAYLOAD }) : null })
            }
          />
        </section>

        <section className="space-y-2 border-t border-border pt-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-sm font-medium text-foreground">{t("iceBreakers")}</span>
              <p className="text-xs text-muted-foreground">{t("iceBreakersHint", { max: MAX_ICE_BREAKERS })}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              title={t("add")}
              icon={<Plus className="h-3.5 w-3.5" />}
              disabled={disabled || iceBreakers.length >= MAX_ICE_BREAKERS}
              onClick={() => update(withIceBreakers(profile, locale, [...iceBreakers, { question: "", payload: "" }]))}
            />
          </div>
          {iceBreakers.map((item, index) => (
            <div key={index} className="flex items-end gap-2">
              <ElevatedInput
                label={t("question")}
                value={item.question}
                disabled={disabled}
                className="flex-1"
                onChange={(e) =>
                  update(
                    withIceBreakers(
                      profile,
                      locale,
                      iceBreakers.map((b, i) => (i === index ? { ...b, question: e.target.value } : b)),
                    ),
                  )
                }
              />
              <ElevatedInput
                label={t("payload")}
                value={item.payload}
                disabled={disabled}
                className="w-40"
                onChange={(e) =>
                  update(
                    withIceBreakers(
                      profile,
                      locale,
                      iceBreakers.map((b, i) => (i === index ? { ...b, payload: e.target.value } : b)),
                    ),
                  )
                }
              />
              <RemoveButton
                label={t("remove")}
                disabled={disabled}
                onClick={() => update(withIceBreakers(profile, locale, iceBreakers.filter((_, i) => i !== index)))}
              />
            </div>
          ))}
        </section>

        <section className="space-y-2 border-t border-border pt-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-sm font-medium text-foreground">{t("menu")}</span>
              <p className="text-xs text-muted-foreground">
                {t("menuHint", { max: MAX_MENU_ITEMS, title: MAX_MENU_TITLE_CHARS })}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              title={t("add")}
              icon={<Plus className="h-3.5 w-3.5" />}
              disabled={disabled || (menu?.items.length ?? 0) >= MAX_MENU_ITEMS}
              onClick={() => setMenuItems([...(menu?.items ?? []), { type: "postback", title: "", payload: "" }])}
            />
          </div>

          {menu ? (
            <div className="flex items-center justify-between gap-4 rounded-lg bg-muted px-3 py-2">
              <span className="text-xs text-foreground">{t("composerDisabled")}</span>
              <ElevatedSwitch
                checked={menu.composerInputDisabled}
                disabled={disabled}
                aria-label={t("composerDisabled")}
                onCheckedChange={(on: boolean) => update(withMenu(profile, locale, { ...menu, composerInputDisabled: on }))}
              />
            </div>
          ) : null}

          {(menu?.items ?? []).map((item, index) => {
            const items = menu?.items ?? [];
            const replace = (next: MessengerMenuItem) => setMenuItems(items.map((m, i) => (i === index ? next : m)));
            return (
              <div key={index} className="flex flex-wrap items-end gap-2">
                <div className="w-36">
                  <ElevatedSelect
                    label={t("itemType")}
                    value={item.type}
                    disabled={disabled}
                    onValueChange={(type: string) =>
                      replace(
                        type === "web_url"
                          ? { type: "web_url", title: item.title, url: "" }
                          : { type: "postback", title: item.title, payload: "" },
                      )
                    }
                  >
                    <ElevatedSelectItem value="postback">{t("typePostback")}</ElevatedSelectItem>
                    <ElevatedSelectItem value="web_url">{t("typeLink")}</ElevatedSelectItem>
                  </ElevatedSelect>
                </div>
                <ElevatedInput
                  label={t("itemTitle")}
                  value={item.title}
                  maxLength={MAX_MENU_TITLE_CHARS}
                  disabled={disabled}
                  className="min-w-40 flex-1"
                  onChange={(e) => replace({ ...item, title: e.target.value })}
                />
                {item.type === "web_url" ? (
                  <ElevatedInput
                    label={t("itemUrl")}
                    value={item.url}
                    placeholder="https://"
                    disabled={disabled}
                    className="min-w-48 flex-1"
                    onChange={(e) => replace({ ...item, url: e.target.value })}
                  />
                ) : (
                  <ElevatedInput
                    label={t("payload")}
                    value={item.payload}
                    disabled={disabled}
                    className="w-40"
                    onChange={(e) => replace({ ...item, payload: e.target.value })}
                  />
                )}
                <RemoveButton
                  label={t("remove")}
                  disabled={disabled}
                  onClick={() => {
                    const next = items.filter((_, i) => i !== index);
                    update(withMenu(profile, locale, next.length > 0 ? { ...(menu as NonNullable<typeof menu>), items: next } : null));
                  }}
                />
              </div>
            );
          })}
        </section>

        {problems.length > 0 ? (
          <ul className="space-y-1 text-xs text-warning-ink">
            {problems.map((problem) => (
              <li key={problem} className="flex items-start gap-1.5">
                <Warning className="mt-0.5 h-3 w-3 shrink-0" />
                {t(`problem.${problem}`, { max: MAX_ICE_BREAKERS, items: MAX_MENU_ITEMS, title: MAX_MENU_TITLE_CHARS, greeting: MAX_GREETING_CHARS })}
              </li>
            ))}
          </ul>
        ) : null}

        {saveError ? (
          <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-destructive-ink">
            <Warning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {saveError}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
          {saved ? <span className="text-xs text-healthy-ink">{t("saved")}</span> : null}
          <Button
            variant="primary"
            title={saving ? t("saving") : t("save")}
            disabled={disabled || problems.length > 0}
            onClick={() => void save()}
          />
        </div>
      </div>
    </ElevatedContainer>
  );
}

function RemoveButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="mb-1 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive-ink disabled:opacity-40"
    >
      <Trash className="h-4 w-4" />
    </button>
  );
}
