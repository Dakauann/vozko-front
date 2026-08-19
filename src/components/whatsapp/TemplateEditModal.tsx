"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle,
  CircleNotch,
  Copy,
  File as FileIcon,
  Gif,
  Image as ImageIcon,
  Info,
  Link,
  MapPin,
  Phone,
  UploadSimple,
  VideoCamera,
  Warning,
  WhatsappLogo,
  X,
} from "@/components/icons";
import type {
  TemplateComponent,
  WhatsAppTemplate,
} from "@/lib/whatsapp-templates/types";

import Button from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { IconBox } from "@/components/elevated-design/listing-card";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { getBrand } from "@/config/brand";
import { uploadMediaAction } from "@/app/actions/medias";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

interface TemplateEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: WhatsAppTemplate;
  onSave: (headerMediaUrl: string | null) => Promise<void>;
  isSaving?: boolean;
}

export default function TemplateEditModal({
  isOpen,
  onClose,
  template,
  onSave,
  isSaving = false,
}: TemplateEditModalProps) {
  const t = useTranslations("whatsappTemplates.editModal");
  // Status and category labels live at the namespace root, shared with the list
  // and detail pages, so the same enum never renders two different ways.
  const tTemplates = useTranslations("whatsappTemplates");
  const [headerMediaUrl, setHeaderMediaUrl] = useState(
    template.headerMediaUrl || "",
  );
  const [hasChanges, setHasChanges] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUrlChange = (value: string) => {
    setHeaderMediaUrl(value);
    setHasChanges(value !== (template.headerMediaUrl || ""));
  };

  const handleSave = async () => {
    await onSave(headerMediaUrl || null);
    setHasChanges(false);
  };

  const handleClose = () => {
    setHeaderMediaUrl(template.headerMediaUrl || "");
    setHasChanges(false);
    setUploadError(null);
    setIsUploading(false);
    setIsDragging(false);
    onClose();
  };

  const headerComponent = template.components.find((c) => c.type === "HEADER");
  const headerFormat = headerComponent?.format;
  const isMediaHeader =
    headerFormat &&
    ["IMAGE", "VIDEO", "DOCUMENT", "GIF"].includes(headerFormat);

  // Map the template's header format to the backend media type + a sensible
  // file picker filter. The upload reuses the same /medias endpoint the rest of
  // the app uses, returning a public URL we drop into the media URL field.
  const uploadMediaType =
    headerFormat === "VIDEO"
      ? "video"
      : headerFormat === "DOCUMENT"
        ? "document"
        : "image";
  // Image accept is intentionally narrowed to what the backend's UploadMedia
  // usecase actually stores for the "image" type (jpg/jpeg/png/webp). Allowing
  // image/* would let users pick gif/heic/avif/svg and hit a server rejection.
  const uploadAccept =
    headerFormat === "VIDEO"
      ? "video/*"
      : headerFormat === "DOCUMENT"
        ? ".pdf,.doc,.docx,application/pdf"
        : "image/jpeg,image/png,image/webp";

  const handleFileUpload = async (file: File) => {
    setUploadError(null);
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("media", file);
      formData.append("mediaType", uploadMediaType);
      formData.append("description", file.name);

      const result = await uploadMediaAction(formData);

      if (result.error || !result.mediaUrl) {
        setUploadError(result.error || t("upload.error"));
        return;
      }

      handleUrlChange(result.mediaUrl);
    } catch {
      setUploadError(t("upload.error"));
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleFileUpload(file);
    }
    // Reset so selecting the same file again still triggers onChange.
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isUploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleFileUpload(file);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="w-full max-w-4xl max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <ElevatedContainer className="bg-card rounded-[--radius] shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <IconBox color="green" size="sm">
                  <WhatsappLogo weight="fill" />
                </IconBox>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {t("title")}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {template.name}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-lg text-muted-foreground hover:text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" weight="bold" />
              </button>
            </div>

            {/* Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 max-h-[calc(90vh-180px)] overflow-y-auto">
              {/* Left: Preview */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-muted text-muted-foreground shadow-lg">
                    <WhatsappLogo className="h-3.5 w-3.5" weight="fill" />
                  </span>
                  {t("preview")}
                </h3>

                <div className="bg-muted rounded-[--radius] p-3 shadow-xl">
                  <div className="rounded-[--radius] overflow-hidden">
                    <TemplatePreview
                      template={template}
                      headerMediaUrl={headerMediaUrl}
                    />
                  </div>
                </div>
              </div>

              {/* Right: Editor */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Info className="h-3.5 w-3.5" weight="fill" />
                  </span>
                  {t("settings")}
                </h3>

                {isMediaHeader ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-[--radius] bg-muted border border-border">
                      <div className="flex items-start gap-3">
                        <Info
                          className="h-5 w-5 text-primary-ink flex-shrink-0 mt-0.5"
                          weight="fill"
                        />
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-primary-ink mb-1">
                            {t("mediaInfo.title")}
                          </h4>
                          <p className="text-xs text-primary-ink leading-relaxed">
                            {t("mediaInfo.description")}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-foreground">
                        {t("headerMediaUrl.label")}
                      </label>
                      <ElevatedInput
                        type="url"
                        placeholder={t("headerMediaUrl.placeholder", {
                          format: headerFormat?.toLowerCase() || "media",
                        })}
                        value={headerMediaUrl}
                        onChange={(e) => handleUrlChange(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        {t("headerMediaUrl.hint")}
                      </p>
                    </div>

                    {/* Divider: URL or upload from computer */}
                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-xs font-medium text-muted-foreground">
                        {t("upload.or")}
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>

                    {/* Upload from computer */}
                    <div
                      onClick={() =>
                        !isUploading && fileInputRef.current?.click()
                      }
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (!isUploading) setIsDragging(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                      }}
                      onDrop={handleDrop}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 rounded-[--radius] border border-dashed px-4 py-6 text-center transition-colors",
                        isUploading
                          ? "cursor-default opacity-70"
                          : "cursor-pointer",
                        isDragging
                          ? "border-primary bg-muted"
                          : "border-border hover:border-border hover:bg-muted",
                      )}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={uploadAccept}
                        className="hidden"
                        onChange={handleFileSelect}
                        disabled={isUploading}
                      />
                      {isUploading ? (
                        <>
                          <CircleNotch className="h-6 w-6 animate-spin text-primary-ink" />
                          <p className="text-sm font-medium text-foreground">
                            {t("upload.uploading")}
                          </p>
                        </>
                      ) : (
                        <>
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                            <UploadSimple
                              className="h-5 w-5 text-primary-ink"
                              weight="bold"
                            />
                          </span>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {t("upload.cta")}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {t("upload.hint")}
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    {uploadError && (
                      <div className="p-3 rounded-lg bg-muted border border-border">
                        <div className="flex items-center gap-2">
                          <Warning
                            className="h-4 w-4 text-destructive-ink"
                            weight="fill"
                          />
                          <p className="text-xs text-destructive-ink font-medium">
                            {uploadError}
                          </p>
                        </div>
                      </div>
                    )}

                    {headerMediaUrl && (
                      <div className="p-3 rounded-lg bg-muted border border-border">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          {t("currentUrl")}
                        </p>
                        <p className="text-xs text-foreground break-all font-mono">
                          {headerMediaUrl}
                        </p>
                      </div>
                    )}

                    {hasChanges && (
                      <div className="p-3 rounded-lg bg-muted border border-border">
                        <div className="flex items-center gap-2">
                          <Warning
                            className="h-4 w-4 text-warning-ink"
                            weight="fill"
                          />
                          <p className="text-xs text-warning-ink font-medium">
                            {t("unsavedChanges")}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 rounded-[--radius] bg-muted border border-border">
                    <div className="flex items-start gap-3">
                      <Info
                        className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5"
                        weight="fill"
                      />
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-foreground mb-1">
                          {t("noMediaHeader.title")}
                        </h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {t("noMediaHeader.description")}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Template Info */}
                <div className="p-4 rounded-[--radius] bg-muted border border-border">
                  <h4 className="text-sm font-semibold text-foreground mb-3">
                    {t("templateInfo")}
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {t("status")}
                      </span>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full font-medium",
                          template.status === "APPROVED"
                            ? "bg-healthy text-healthy-foreground"
                            : template.status === "PENDING"
                              ? "bg-warning text-warning-foreground"
                              : template.status === "REJECTED"
                                ? "bg-destructive text-destructive-foreground"
                                : "bg-muted text-foreground",
                        )}
                      >
                        {tTemplates(`status.${template.status.toLowerCase()}`)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {t("category")}
                      </span>
                      <span className="font-medium text-foreground">
                        {tTemplates(`category.${template.category.toLowerCase()}`)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {t("language")}
                      </span>
                      <span className="font-medium text-foreground">
                        {template.language}
                      </span>
                    </div>
                    {headerFormat && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {t("headerFormat")}
                        </span>
                        <span className="font-medium text-foreground">
                          {headerFormat}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted">
              <Button
                variant="secondary"
                title={t("cancel")}
                onClick={handleClose}
                disabled={isSaving}
              />
              {isMediaHeader && (
                <Button
                  variant="primary"
                  title={isSaving ? t("saving") : t("save")}
                  icon={
                    isSaving ? (
                      <CircleNotch className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" weight="fill" />
                    )
                  }
                  iconVisible
                  iconSide="left"
                  onClick={handleSave}
                  disabled={isSaving || !hasChanges}
                />
              )}
            </div>
          </ElevatedContainer>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

interface TemplatePreviewProps {
  template: WhatsAppTemplate;
  headerMediaUrl?: string;
}

function TemplatePreview({ template, headerMediaUrl }: TemplatePreviewProps) {
  const headerComponent = template.components.find((c) => c.type === "HEADER");
  const bodyComponent = template.components.find((c) => c.type === "BODY");
  const footerComponent = template.components.find((c) => c.type === "FOOTER");
  const buttonsComponent = template.components.find(
    (c) => c.type === "BUTTONS",
  );

  return (
    <div className="flex flex-col h-full">
      {/* WhatsApp Header */}
      <div className="flex-shrink-0 bg-muted px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card">
            <span className="text-sm font-semibold text-muted-foreground">V</span>
          </div>
          <div className="flex-1">
            <h3 className="text-white font-semibold text-sm">{getBrand().name}</h3>
            <p className="text-healthy-ink text-xs">
              Typically replies instantly
            </p>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div
        className="flex-1 bg-[#efeae2] p-4 min-h-[350px]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d9d9d9' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      >
        <div className="mb-3 text-center">
          <div className="inline-block bg-card px-3 py-1.5 rounded-full">
            <p className="text-2xs text-muted-foreground font-medium">
              Template: {template.name} ({template.language.toUpperCase()})
            </p>
          </div>
        </div>

        <div className="max-w-sm">
          <div className="bg-card rounded-[--radius] shadow-sm overflow-hidden">
            {headerComponent && (
              <HeaderPreview
                component={headerComponent}
                headerMediaUrl={headerMediaUrl}
              />
            )}

            <div className="px-4 py-3">
              {bodyComponent ? (
                <BodyPreview component={bodyComponent} />
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  No body content
                </p>
              )}

              {footerComponent && footerComponent.text && (
                <p className="text-xs text-muted-foreground mt-2 italic">
                  {footerComponent.text}
                </p>
              )}
            </div>

            {buttonsComponent?.buttons &&
              buttonsComponent.buttons.length > 0 && (
                <ButtonsPreview component={buttonsComponent} />
              )}
          </div>

          <div className="flex justify-end mt-1 px-1">
            <span className="text-2xs text-muted-foreground">
              {new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeaderPreview({
  component,
  headerMediaUrl,
}: {
  component: TemplateComponent;
  headerMediaUrl?: string;
}) {
  const { format, text } = component;
  const mediaUrl = headerMediaUrl || component.example?.header_handle?.[0];

  if (format === "TEXT") {
    return (
      <div className="px-4 pt-4 pb-2">
        <p className="text-sm font-semibold text-foreground">
          {text || (
            <span className="text-muted-foreground italic">Header text</span>
          )}
        </p>
      </div>
    );
  }

  if (format === "IMAGE") {
    return (
      <div className="aspect-video bg-muted flex items-center justify-center border-b border-border relative">
        {mediaUrl ? (
          <Image src={mediaUrl} alt="Header" fill className="object-cover" />
        ) : (
          <div className="text-center">
            <ImageIcon
              className="h-12 w-12 text-slate-300 mx-auto mb-2"
              weight="duotone"
            />
            <p className="text-xs text-muted-foreground">Image header</p>
          </div>
        )}
      </div>
    );
  }

  if (format === "VIDEO") {
    return (
      <div className="aspect-video bg-muted flex items-center justify-center border-b border-border">
        {mediaUrl ? (
          <video src={mediaUrl} controls className="w-full h-full" />
        ) : (
          <div className="text-center">
            <VideoCamera
              className="h-12 w-12 text-slate-300 mx-auto mb-2"
              weight="duotone"
            />
            <p className="text-xs text-muted-foreground">Video header</p>
          </div>
        )}
      </div>
    );
  }

  if (format === "DOCUMENT") {
    return (
      <div className="px-4 pt-4 pb-2 border-b border-border">
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
          <div className="h-10 w-10 rounded-lg tile-brand flex items-center justify-center flex-shrink-0">
            <FileIcon className="h-5 w-5 text-primary-ink" weight="duotone" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">
              Document.pdf
            </p>
            <p className="text-xs text-muted-foreground">PDF • 1.2 MB</p>
          </div>
        </div>
      </div>
    );
  }

  if (format === "LOCATION") {
    return (
      <div className="aspect-video bg-muted flex items-center justify-center border-b border-border relative">
        <div className="absolute inset-0 bg-muted" />
        <div className="relative text-center">
          <MapPin
            className="h-12 w-12 text-healthy-ink mx-auto mb-2"
            weight="duotone"
          />
          <p className="text-xs font-medium text-foreground">Location</p>
        </div>
      </div>
    );
  }

  if (format === "GIF") {
    return (
      <div className="aspect-video bg-muted flex items-center justify-center border-b border-border relative">
        {mediaUrl ? (
          <Image src={mediaUrl} alt="GIF" fill className="object-cover" />
        ) : (
          <div className="text-center">
            <Gif
              className="h-12 w-12 text-slate-300 mx-auto mb-2"
              weight="duotone"
            />
            <p className="text-xs text-muted-foreground">GIF header</p>
          </div>
        )}
      </div>
    );
  }

  return null;
}

function BodyPreview({ component }: { component: TemplateComponent }) {
  const { text } = component;

  if (!text) {
    return (
      <p className="text-xs text-muted-foreground italic">No message text</p>
    );
  }

  const renderText = text
    .replace(/\{\{1\}\}/g, "John")
    .replace(/\{\{2\}\}/g, "Smith")
    .replace(/\{\{3\}\}/g, "Premium")
    .replace(/\{\{name\}\}/gi, "John")
    .replace(/\{\{lastname\}\}/gi, "Smith")
    .replace(/\{\{product\}\}/gi, "Premium");

  return (
    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
      {renderText}
    </p>
  );
}

function ButtonsPreview({ component }: { component: TemplateComponent }) {
  const buttons = component.buttons || [];

  return (
    <div className="border-t border-border">
      {buttons.map((button, index: number) => (
        <button
          key={index}
          className={`w-full px-4 py-3 text-center text-sm font-medium text-primary-ink hover:bg-muted transition-colors ${
            index !== buttons.length - 1 ? "border-b border-border" : ""
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            {button.type === "PHONE_NUMBER" && (
              <Phone className="h-4 w-4" weight="bold" />
            )}
            {button.type === "URL" && (
              <Link className="h-4 w-4" weight="bold" />
            )}
            {button.type === "COPY_CODE" && (
              <Copy className="h-4 w-4" weight="bold" />
            )}
            <span>
              {button.type === "QUICK_REPLY" && (button.text || "Quick Reply")}
              {button.type === "URL" && (button.text || "Visit Website")}
              {button.type === "PHONE_NUMBER" && (button.text || "Call Us")}
              {button.type === "COPY_CODE" && "Copy Offer Code"}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
