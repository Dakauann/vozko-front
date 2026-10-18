"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { isActionError } from "@/app/actions/action-result";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSwitch } from "@/components/elevated-design/elevated-switch";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { ImageUploadField } from "@/components/elevated-design/image-upload-field";
import { uploadLibraryMedia } from "@/lib/media/upload-library-media";
import type { GroupDetail } from "@/lib/unofficial-whatsapp-groups/types";

import { GroupAvatar } from "../marks";
import type { ConflictGroup } from "../kit/notices";
import { GroupsPanel } from "../kit/panel";
import { SeriesApplyToggle } from "../kit/series";
import { useGroupName } from "../kit/use-groups-format";
import {
  DESCRIPTION_MAX_CHARS,
  GROUP_PHOTO_TYPES,
  SUBJECT_MAX_CHARS,
  groupPhotoProblem,
  hasAdminSeat,
  seriesBaseName,
  whatsAppDraftProblems,
  whatsAppPatch,
} from "./detail-model";
import { SETUP_TARGET } from "./settings-targets";
import type { GroupPermissions } from "./use-group-permissions";
import { useSaveGroup } from "./use-save-group";

function Counter({ used, max }: { used: number; max: number }) {
  const t = useTranslations("unofficialGroups.detail.settings.category");
  return (
    <p className={used > max ? "readout px-1 text-2xs tabular-nums text-destructive-ink" : "readout px-1 text-2xs tabular-nums text-muted-foreground"}>
      {t("counter", { used, max })}
    </p>
  );
}

export function WhatsAppDataSection({
  detail,
  permissions,
  onChanged,
  onConflict,
}: {
  detail: GroupDetail;
  permissions: GroupPermissions;
  onChanged: () => void;
  onConflict: (groups: ConflictGroup[] | null) => void;
}) {
  const t = useTranslations("unofficialGroups.detail.settingsTab.data");
  const tOld = useTranslations("unofficialGroups.detail.settings.data");
  const groupName = useGroupName();
  const { group, numbers, series } = detail;
  const adminReady = hasAdminSeat(numbers);
  const { saving, save } = useSaveGroup(group.id, series, onChanged, onConflict);
  const serverSubject = group.subject;
  const serverDescription = group.description ?? "";
  const [subject, setSubject] = useState(serverSubject);
  const [description, setDescription] = useState(serverDescription);
  const [baseline, setBaseline] = useState({ subject: serverSubject, description: serverDescription });
  const [photo, setPhoto] = useState<string | null>(null);
  const [applyToSeries, setApplyToSeries] = useState(false);

  if (baseline.subject !== serverSubject || baseline.description !== serverDescription) {
    setBaseline({ subject: serverSubject, description: serverDescription });
    if (subject === baseline.subject) setSubject(serverSubject);
    if (description === baseline.description) setDescription(serverDescription);
  }

  const problems = whatsAppDraftProblems({ subject, description });
  const payload = whatsAppPatch(group, { subject, description, imageUrl: photo ?? undefined, applyToSeries });
  const changed = Object.keys(payload).some((key) => key !== "applyToSeries");
  const invalid = Boolean(problems.subject || problems.description);
  const locked = !adminReady || saving;
  const subjectLength = Array.from(subject.trim()).length;
  const descriptionLength = Array.from(description.trim()).length;

  const problemText = (problem: "required" | "tooLong" | undefined, max: number) =>
    problem === "required" ? t("nameRequired") : problem === "tooLong" ? t("tooLong", { max }) : undefined;

  return (
    <GroupsPanel title={tOld("title")} subtitle={tOld("description")}>
      <div className="space-y-4">
        <form
          className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,14rem)]"
          onSubmit={(event) => {
            event.preventDefault();
            if (changed && !invalid) {
              void save(payload, tOld("saved")).then((ok) => {
                if (ok) setPhoto(null);
              });
            }
          }}
        >
          <div className="min-w-0 space-y-3">
            <div className="space-y-1">
              <ElevatedInput
                type="text"
                label={tOld("name")}
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                disabled={locked}
                controlSize="sm"
                error={problemText(problems.subject, SUBJECT_MAX_CHARS)}
              />
              <Counter used={subjectLength} max={SUBJECT_MAX_CHARS} />
            </div>
            <div className="space-y-1">
              <ElevatedTextarea
                id={SETUP_TARGET.description}
                label={tOld("descriptionLabel")}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={locked}
                autoResize
                maxHeight={220}
                rows={4}
                error={problemText(problems.description, DESCRIPTION_MAX_CHARS)}
              />
              <Counter used={descriptionLength} max={DESCRIPTION_MAX_CHARS} />
            </div>
            <SeriesApplyToggle
              series={series}
              checked={applyToSeries}
              onChange={setApplyToSeries}
              renamesSubject={payload.subject !== undefined}
              baseName={seriesBaseName(subject)}
              disabled={locked}
            />
          </div>
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <GroupAvatar group={{ subject: groupName(group.subject), pictureUrl: group.pictureUrl }} size="lg" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">{t("currentPhoto")}</p>
                <p className="text-2xs text-muted-foreground">{group.pictureUrl ? t("currentPhotoHint") : t("noPhoto")}</p>
              </div>
            </div>
            {permissions.uploadMedia ? (
              <ImageUploadField<string>
                labels={{
                  title: t("newPhoto"),
                  add: t("pickPhoto"),
                  replace: t("replacePhoto"),
                  remove: t("discardPhoto"),
                  uploading: t("uploading"),
                  hint: t("photoHint"),
                }}
                previewUrl={photo ?? ""}
                accept={GROUP_PHOTO_TYPES}
                check={(file) => {
                  const problem = groupPhotoProblem(file);
                  return problem === "type" ? t("photoType") : problem === "size" ? t("photoSize") : null;
                }}
                upload={async (file) => {
                  const uploaded = await uploadLibraryMedia(file, "image", group.subject, file.name);
                  return isActionError(uploaded) ? { error: t("photoFailed") } : { value: uploaded.data.mediaUrl };
                }}
                onUploaded={setPhoto}
                onRemove={() => setPhoto(null)}
                disabled={locked}
              />
            ) : (
              <p className="text-2xs text-muted-foreground">{t("noMediaPermission")}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:col-span-2">
            <Button type="submit" variant="primary" title={tOld("save")} disabled={!changed || invalid || locked} />
            {changed ? <span className="text-2xs text-muted-foreground">{payload.applyToSeries ? t("pendingSeries", { count: series.length }) : t("pending")}</span> : null}
          </div>
        </form>
      </div>
    </GroupsPanel>
  );
}

export function RulesSection({
  detail,
  onChanged,
  onConflict,
}: {
  detail: GroupDetail;
  onChanged: () => void;
  onConflict: (groups: ConflictGroup[] | null) => void;
}) {
  const t = useTranslations("unofficialGroups.detail.settingsTab.rules");
  const tOld = useTranslations("unofficialGroups.detail.settings.rules");
  const { group, numbers, series } = detail;
  const adminReady = hasAdminSeat(numbers);
  const { saving, save } = useSaveGroup(group.id, series, onChanged, onConflict);
  const [announce, setAnnounce] = useState(group.announce);
  const [locked, setLocked] = useState(group.locked);
  const [baseline, setBaseline] = useState({ announce: group.announce, locked: group.locked });
  const [announceSeries, setAnnounceSeries] = useState(false);
  const [lockedSeries, setLockedSeries] = useState(false);
  const disabled = !adminReady || saving;

  if (!saving && (baseline.announce !== group.announce || baseline.locked !== group.locked)) {
    setBaseline({ announce: group.announce, locked: group.locked });
    setAnnounce(group.announce);
    setLocked(group.locked);
  }

  const changeAnnounce = async (next: boolean) => {
    setAnnounce(next);
    const ok = await save({ adminsOnlyMessages: next, ...(announceSeries ? { applyToSeries: true } : {}) }, next ? tOld("announceOn") : tOld("announceOff"));
    if (!ok) setAnnounce(!next);
  };

  const changeLocked = async (next: boolean) => {
    setLocked(next);
    const ok = await save({ adminsOnlyEdit: next, ...(lockedSeries ? { applyToSeries: true } : {}) }, next ? tOld("editAdminsDone") : tOld("editEveryoneDone"));
    if (!ok) setLocked(!next);
  };

  return (
    <GroupsPanel title={tOld("title")} subtitle={tOld("description")}>
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <ElevatedSwitch
              id={SETUP_TARGET.admins_only}
              label={tOld("announce")}
              description={tOld("announceHint")}
              checked={announce}
              disabled={disabled}
              onCheckedChange={(checked) => void changeAnnounce(checked)}
            />
            <SeriesApplyToggle series={series} checked={announceSeries} onChange={setAnnounceSeries} disabled={disabled} />
          </div>
          <div className="space-y-2">
            <ElevatedSwitch
              label={t("locked")}
              description={t("lockedHint")}
              checked={locked}
              disabled={disabled}
              onCheckedChange={(checked) => void changeLocked(checked)}
            />
            <SeriesApplyToggle series={series} checked={lockedSeries} onChange={setLockedSeries} disabled={disabled} />
          </div>
        </div>
      </div>
    </GroupsPanel>
  );
}
