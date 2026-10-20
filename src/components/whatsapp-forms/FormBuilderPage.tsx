"use client";

import { useTranslations } from "next-intl";

import { ScreenLoader } from "@/components/brand/screen-loader";
import Button from "@/components/elevated-design/button";
import { Notice } from "@/components/ui/notice";
import { useFormAccess, useFormDetail, useFormOptions } from "@/hooks/use-whatsapp-forms";

import { FormBuilder } from "./builder/FormBuilder";

export function FormBuilderPage({ formId }: { formId: string }) {
  const t = useTranslations("whatsappForms");
  const access = useFormAccess();
  const detail = useFormDetail(formId);
  const options = useFormOptions();

  if (detail.isPending || options.isPending) return <ScreenLoader fit="fill" />;
  if (!detail.data || !options.data) {
    return (
      <div className="w-full space-y-4">
        <Notice tone="fault">{t("common.errorTitle")}</Notice>
        <Button
          variant="secondary"
          title={t("common.retry")}
          onClick={() => {
            void detail.refetch();
            void options.refetch();
          }}
        />
      </div>
    );
  }

  return (
    <FormBuilder
      key={detail.data.form.id}
      detail={detail.data}
      options={options.data}
      canEdit={access.edit && !detail.data.form.archivedAt && detail.data.form.kind === "built"}
      canPublish={access.publish && !detail.data.form.archivedAt}
    />
  );
}
