"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { isActionError } from "@/app/actions/action-result";
import { createLeadCompanyAction, updateLeadCompanyAction } from "@/app/actions/lead-companies";
import Button from "@/components/elevated-design/button";
import {
  ElevatedDialog,
  ElevatedDialogBody,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import { ImageUploadField } from "@/components/elevated-design/image-upload-field";
import { ExplainerHint } from "@/components/explainers/ExplainerHint";
import { useWorkspace } from "@/contexts/workspace-context";
import { useRefreshLeadCompanies } from "@/hooks/use-lead-companies";
import {
  LEAD_COMPANY_IMAGE_TYPES,
  LEAD_COMPANY_NAME_MAX,
  companyChange,
  companyImageProblem,
  companyImageUrl,
  type LeadCompany,
} from "@/lib/leads/companies";
import { uploadLibraryMedia } from "@/lib/media/upload-library-media";

import { useCompanyError } from "./use-company-error";

const IMAGE_DESCRIPTION = "lead-company-image";

interface DialogImage {
  mediaId: string;
  url: string;
}

function imageOf(company: LeadCompany | null): DialogImage | null {
  return company?.image ? { mediaId: company.image.mediaId, url: companyImageUrl(company) } : null;
}

export function LeadCompanyDialog({ company, onClose }: { company: LeadCompany | null; onClose: () => void }) {
  const t = useTranslations("leadCompanies");
  const { can } = useWorkspace();
  const errorText = useCompanyError();
  const refresh = useRefreshLeadCompanies();
  const [name, setName] = useState(company?.name ?? "");
  const [acceptsLeads, setAcceptsLeads] = useState(company?.acceptsLeads ?? true);
  const [image, setImage] = useState<DialogImage | null>(imageOf(company));
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const uploads = can("media", "create");

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setFailure(t("errors.lead_company_name_required"));
      return;
    }
    setBusy(true);
    setFailure(null);
    const draft = { name: trimmed, acceptsLeads, imageMediaId: image?.mediaId ?? "" };
    const answer = company
      ? await updateLeadCompanyAction(company.id, companyChange(company, draft))
      : await createLeadCompanyAction(image ? draft : { name: trimmed, acceptsLeads });
    setBusy(false);
    if (answer.error) {
      setFailure(errorText(answer.error));
      return;
    }
    await refresh();
    toast.success(company ? t("dialog.saved") : t("dialog.created"));
    onClose();
  };

  return (
    <ElevatedDialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <ElevatedDialogContent className="max-w-lg">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{company ? t("dialog.editTitle", { name: company.name }) : t("dialog.createTitle")}</ElevatedDialogTitle>
          <ElevatedDialogDescription>{t("dialog.description")}</ElevatedDialogDescription>
        </ElevatedDialogHeader>
        <ElevatedDialogBody className="space-y-5">
          <ElevatedInput
            label={t("dialog.name")}
            value={name}
            maxLength={LEAD_COMPANY_NAME_MAX}
            disabled={busy}
            onChange={(event) => {
              setName(event.target.value);
              setFailure(null);
            }}
          />
          <ImageUploadField<DialogImage>
            labels={{
              title: t("image.title"),
              add: t("image.add"),
              replace: t("image.replace"),
              remove: t("image.remove"),
              uploading: t("image.uploading"),
              hint: uploads ? t("image.hint") : t("image.noPermission"),
            }}
            previewUrl={image?.url ?? ""}
            accept={LEAD_COMPANY_IMAGE_TYPES}
            check={(file) => {
              const problem = companyImageProblem(file);
              return problem ? t(`errors.${problem}`) : null;
            }}
            upload={async (file) => {
              const uploaded = await uploadLibraryMedia(file, "image", IMAGE_DESCRIPTION, file.name);
              return isActionError(uploaded) ? { error: t("image.failed") } : { value: { mediaId: uploaded.data.mediaId, url: uploaded.data.mediaUrl } };
            }}
            onUploaded={setImage}
            onRemove={() => setImage(null)}
            disabled={busy || !uploads}
          />
          <ElevatedSwitch
            label={t("dialog.accepts")}
            description={t("dialog.acceptsHint")}
            checked={acceptsLeads}
            disabled={busy}
            onCheckedChange={setAcceptsLeads}
            explainer={<ExplainerHint id="crm.companyAcceptsLeads" />}
          />
          {failure ? (
            <p role="alert" className="text-sm text-destructive-ink">
              {failure}
            </p>
          ) : null}
        </ElevatedDialogBody>
        <ElevatedDialogFooter>
          <Button variant="secondary" title={t("dialog.cancel")} onClick={onClose} disabled={busy} />
          <Button variant="primary" title={busy ? t("dialog.saving") : t("dialog.save")} onClick={() => void save()} disabled={busy} />
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
