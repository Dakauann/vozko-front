"use client";

import { useTranslations } from "next-intl";

import { uploadNotificationImageAction } from "@/app/actions/admin-notifications";
import { isActionError } from "@/app/actions/action-result";
import { ImageUploadField } from "@/components/elevated-design/image-upload-field";
import { codedErrorMessage } from "@/lib/api/coded-error";
import { NOTIFICATION_IMAGE_TYPES, imageFileProblem } from "@/lib/notifications/broadcast";

export function NotificationImageField({ url, onChange }: { url: string; onChange: (url: string) => void }) {
  const t = useTranslations("adminNotifications.compose");
  const tNotifications = useTranslations("notifications");

  return (
    <ImageUploadField
      labels={{ title: t("image"), add: t("imageAdd"), replace: t("imageReplace"), remove: t("imageRemove"), uploading: t("imageUploading"), hint: t("imageHint") }}
      previewUrl={url}
      accept={NOTIFICATION_IMAGE_TYPES}
      check={(file) => {
        const problem = imageFileProblem(file);
        return problem ? tNotifications(`errors.${problem}`) : null;
      }}
      upload={async (file) => {
        const result = await uploadNotificationImageAction(file);
        return isActionError(result) ? { error: codedErrorMessage(tNotifications, result, t("failed")) } : { value: result.data.url };
      }}
      onUploaded={onChange}
      onRemove={() => onChange("")}
    />
  );
}
