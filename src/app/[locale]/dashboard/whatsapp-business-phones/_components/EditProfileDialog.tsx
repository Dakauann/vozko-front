"use client";

import {
  Buildings,
  Camera,
  FloppyDisk,
  Spinner,
  Trash,
  UploadSimple,
} from "@phosphor-icons/react";
import type {
  BusinessProfile,
  BusinessVertical,
  UpdateBusinessProfilePayload,
} from "@/lib/whatsapp-business-phones/types";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import {
  updateBusinessProfileAction,
  uploadProfilePictureAction,
} from "@/app/actions/whatsapp-business-phones";
import { useEffect, useRef, useState } from "react";

import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phoneId: string;
  currentProfile: BusinessProfile | null;
  onSuccess: () => void;
}

const BUSINESS_VERTICALS: BusinessVertical[] = [
  "UNDEFINED",
  "OTHER",
  "AUTO",
  "BEAUTY",
  "APPAREL",
  "EDU",
  "ENTERTAIN",
  "EVENT_PLAN",
  "FINANCE",
  "GROCERY",
  "GOVT",
  "HOTEL",
  "HEALTH",
  "NONPROFIT",
  "PROF_SERVICES",
  "RETAIL",
  "TRAVEL",
  "RESTAURANT",
  "NOT_A_BIZ",
  "REAL_ESTATE",
  "MANUFACTURING",
];

export function EditProfileDialog({
  open,
  onOpenChange,
  phoneId,
  currentProfile,
  onSuccess,
}: EditProfileDialogProps) {
  const t = useTranslations("whatsappBusinessPhones");
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [profilePictureHandle, setProfilePictureHandle] = useState<
    string | null
  >(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [formData, setFormData] = useState<UpdateBusinessProfilePayload>({
    about: "",
    address: "",
    description: "",
    email: "",
    vertical: "UNDEFINED",
    websites: [],
  });
  const [websitesInput, setWebsitesInput] = useState("");

  useEffect(() => {
    if (currentProfile) {
      setFormData({
        about: currentProfile.about || "",
        address: currentProfile.address || "",
        description: currentProfile.description || "",
        email: currentProfile.email || "",
        vertical: currentProfile.vertical || "UNDEFINED",
        websites: currentProfile.websites || [],
      });
      setWebsitesInput(currentProfile.websites?.join("\n") || "");
      setPreviewUrl(currentProfile.profilePictureUrl || null);
      setProfilePictureHandle(null);
    }
  }, [currentProfile]);

  const handleImageSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.match(/^image\/(jpeg|png)$/)) {
      toast({
        title: t("profile.invalidImageType"),
        description: t("profile.invalidImageTypeDesc"),
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: t("profile.imageTooLarge"),
        description: t("profile.imageTooLargeDesc"),
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    setUploadingImage(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);

      const result = await uploadProfilePictureAction(formDataUpload);

      if (result.error) {
        toast({
          title: t("profile.uploadFailed"),
          description: result.error,
          variant: "destructive",
        });
        setPreviewUrl(currentProfile?.profilePictureUrl || null);
      } else if (result.handle) {
        setProfilePictureHandle(result.handle);
        toast({
          title: t("profile.uploadSuccess"),
          description: t("profile.uploadSuccessDesc"),
        });
      }
    } catch {
      toast({
        title: t("profile.uploadFailed"),
        description: t("toast.unknownError"),
        variant: "destructive",
      });
      setPreviewUrl(currentProfile?.profilePictureUrl || null);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setPreviewUrl(null);
    setProfilePictureHandle(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const websites = websitesInput
        .split("\n")
        .map((url) => url.trim())
        .filter((url) => url.length > 0);

      const payload: UpdateBusinessProfilePayload = {
        ...formData,
        websites,
      };

      if (profilePictureHandle) {
        payload.profilePictureHandle = profilePictureHandle;
      }

      const result = await updateBusinessProfileAction(phoneId, payload);

      if (!result.error) {
        toast({
          title: t("toast.profileUpdated"),
          description: t("toast.profileUpdatedDesc"),
        });
        onSuccess();
        onOpenChange(false);
      } else {
        toast({
          title: t("toast.profileUpdateFailed"),
          description: result.error || t("toast.unknownError"),
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: t("toast.profileUpdateFailed"),
        description: t("toast.unknownError"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ElevatedDialog open={open} onOpenChange={onOpenChange}>
      <ElevatedDialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{t("profile.editTitle")}</ElevatedDialogTitle>
          <ElevatedDialogDescription>
            {t("profile.editDescription")}
          </ElevatedDialogDescription>
        </ElevatedDialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
            <Buildings className="w-6 h-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {t("profile.editHint")}
            </p>
          </div>

          <div className="space-y-4">
            {/* Profile Picture Section */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t("profile.profilePicture")}
              </label>
              <div className="flex items-center gap-4">
                <div className="relative">
                  {previewUrl ? (
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt={t("profile.profilePicture")}
                        className="w-20 h-20 rounded-full object-cover border-2 border-border"
                      />
                      {uploadingImage && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                          <Spinner className="w-6 h-6 text-white animate-spin" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-foreground/20 dark:border-slate-600">
                      <Camera className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    title={t("profile.uploadImage")}
                    icon={<UploadSimple className="w-4 h-4" />}
                    iconVisible
                    iconSide="left"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                  />
                  {previewUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      title={t("profile.removeImage")}
                      icon={<Trash className="w-4 h-4" />}
                      iconVisible
                      iconSide="left"
                      onClick={handleRemoveImage}
                      disabled={uploadingImage}
                      className="text-red-600 hover:text-red-700 hover:bg-destructive/10"
                    />
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {t("profile.profilePictureHint")}
              </p>
            </div>

            <div>
              <ElevatedInput
                label={t("profile.about")}
                placeholder={t("profile.aboutPlaceholder")}
                value={formData.about || ""}
                onChange={(e) =>
                  setFormData({ ...formData, about: e.target.value })
                }
                maxLength={139}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("profile.aboutHint")}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t("profile.description")}
              </label>
              <textarea
                value={formData.description || ""}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder={t("profile.descriptionPlaceholder")}
                rows={3}
                maxLength={512}
                className="w-full px-4 py-3 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("profile.descriptionHint")}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t("profile.vertical")}
              </label>
              <select
                value={formData.vertical || "UNDEFINED"}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    vertical: e.target.value as BusinessVertical,
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
              >
                {BUSINESS_VERTICALS.map((vertical) => (
                  <option key={vertical} value={vertical}>
                    {t(`vertical.${vertical}`)}
                  </option>
                ))}
              </select>
            </div>

            <ElevatedInput
              label={t("profile.email")}
              type="email"
              placeholder={t("profile.emailPlaceholder")}
              value={formData.email || ""}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
            />

            <ElevatedInput
              label={t("profile.address")}
              placeholder={t("profile.addressPlaceholder")}
              value={formData.address || ""}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              maxLength={256}
            />

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t("profile.websites")}
              </label>
              <textarea
                value={websitesInput}
                onChange={(e) => setWebsitesInput(e.target.value)}
                placeholder={t("profile.websitesPlaceholder")}
                rows={3}
                className="w-full px-4 py-3 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground resize-none font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("profile.websitesHint")}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              title={t("button.cancel")}
              onClick={() => onOpenChange(false)}
            />
            <Button
              variant="primary"
              title={loading ? t("button.saving") : t("button.save")}
              icon={
                loading ? (
                  <Spinner className="w-4 h-4 animate-spin" />
                ) : (
                  <FloppyDisk className="w-4 h-4" />
                )
              }
              iconVisible
              iconSide="left"
              onClick={handleSubmit}
              disabled={loading}
            />
          </div>
        </div>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
