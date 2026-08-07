"use client";

import {
  CaretLeft,
  CaretRight,
  CheckCircle,
  CircleNotch,
  File,
  Files,
  FloppyDisk,
  Trash,
  UploadSimple,
  X,
} from "@/components/icons";
import { useCallback, useRef, useState } from "react";

import Button from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedTextArea from "@/components/elevated-design/elevated-textarea";
import { apiClient } from "@/lib/api/browser-client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const createKnowledgeBaseSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

type CreateKnowledgeBaseForm = z.infer<typeof createKnowledgeBaseSchema>;

interface PendingFile {
  file: File;
  name: string;
  size: number;
  type: string;
}

interface KnowledgeBaseFormProps {
  mode: "create" | "edit";
  initialData?: {
    id?: string;
    name: string;
    description?: string;
  };
}

const ALLOWED_TYPES = [
  "text/plain",
  "text/markdown",
  "application/pdf",
  "text/csv",
  "application/json",
  "text/html",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; 
const MAX_DOCUMENTS = 120;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const StepIndicator = ({
  step,
  currentStep,
  label,
}: {
  step: number;
  currentStep: number;
  label: string;
}) => {
  const isCompleted = currentStep > step;
  const isCurrent = currentStep === step;

  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold transition-all",
          isCompleted && "border-healthy bg-healthy text-healthy-foreground",
          isCurrent && "border-primary bg-primary text-primary-foreground",
          !isCompleted &&
            !isCurrent &&
            "border-border bg-muted text-muted-foreground",
        )}
      >
        {isCompleted ? <CheckCircle className="h-5 w-5" weight="fill" /> : step}
      </div>
      <span
        className={cn(
          "text-sm font-medium",
          isCurrent ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </div>
  );
};

export default function KnowledgeBaseForm({
  mode,
  initialData,
}: KnowledgeBaseFormProps) {
  const router = useRouter();
  const t = useTranslations("knowledgeBase");
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<CreateKnowledgeBaseForm>({
    resolver: zodResolver(createKnowledgeBaseSchema),
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
    },
  });

  const name = watch("name");

  const handleFilesSelected = useCallback(
    (files: FileList | File[]) => {
      const newFiles: PendingFile[] = [];
      const fileArray = Array.from(files);

      const remaining = MAX_DOCUMENTS - pendingFiles.length;
      if (remaining <= 0) {
        toast.error(t("form.fileUpload.maxReached"));
        return;
      }

      const filesToProcess = fileArray.slice(0, remaining);
      if (filesToProcess.length < fileArray.length) {
        toast.warning(
          t("form.fileUpload.limitTruncated", {
            selected: fileArray.length,
            allowed: filesToProcess.length,
          }),
        );
      }

      for (const file of filesToProcess) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "";
        const allowedExtensions = [
          "txt",
          "md",
          "pdf",
          "csv",
          "json",
          "html",
          "docx",
          "xlsx",
          "xls",
        ];
        if (
          !ALLOWED_TYPES.includes(file.type) &&
          !allowedExtensions.includes(ext)
        ) {
          toast.error(t("form.fileUpload.invalidType", { name: file.name }));
          continue;
        }

        if (file.size > MAX_FILE_SIZE) {
          toast.error(t("form.fileUpload.tooLarge", { name: file.name }));
          continue;
        }

        if (pendingFiles.some((pf) => pf.name === file.name)) {
          toast.error(t("form.fileUpload.duplicate", { name: file.name }));
          continue;
        }

        newFiles.push({
          file,
          name: file.name,
          size: file.size,
          type: file.type || "text/plain",
        });
      }

      if (newFiles.length > 0) {
        setPendingFiles((prev) => [...prev, ...newFiles]);
        toast.success(t("form.fileUpload.added", { count: newFiles.length }));
      }
    },
    [pendingFiles, t],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        handleFilesSelected(e.dataTransfer.files);
      }
    },
    [handleFilesSelected],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removeFile = (fileName: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.name !== fileName));
  };

  const uploadDocuments = async (kbId: string): Promise<boolean> => {
    if (pendingFiles.length === 0) return true;

    try {
      const formData = new FormData();
      for (const pf of pendingFiles) {
        formData.append("files", pf.file, pf.name);
      }

      const { error } = await apiClient(
        `/knowledge-bases/${kbId}/documents/upload`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (error) {
        throw new Error(error.message || "Failed to upload documents");
      }

      setUploadProgress(100);
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload documents",
      );
      return false;
    }
  };

  const onSubmit = async (data: CreateKnowledgeBaseForm) => {
    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      const endpoint =
        mode === "create"
          ? "/knowledge-bases"
          : `/knowledge-bases/${initialData?.id}`;
      const method = mode === "create" ? "POST" : "PUT";

      const { data: result, error } = await apiClient<{ id?: string }>(
        endpoint,
        {
          method,
          body: JSON.stringify(data),
        },
      );

      if (error) {
        throw new Error(error.message || "Failed to save");
      }

      const kbId = result?.id || initialData?.id;

      if (mode === "create" && pendingFiles.length > 0 && kbId) {
        const uploadSuccess = await uploadDocuments(kbId);
        if (!uploadSuccess) {
          toast.warning(t("form.toast.partialUpload"));
        }
      }

      toast.success(
        mode === "create" ? t("form.toast.created") : t("form.toast.updated"),
      );
      router.push("/dashboard/knowledge-bases");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("form.toast.error"),
      );
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  const canProceedToStep2 = name.trim().length > 0;

  return (
    <form
      onSubmit={(e) => {
        if (currentStep === 1 && mode === "create") {
          e.preventDefault();
          if (canProceedToStep2) setCurrentStep(2);
          return;
        }
        if (
          currentStep === 2 &&
          mode === "create" &&
          pendingFiles.length === 0
        ) {
          e.preventDefault();
          toast.error(t("form.fileUpload.noFiles"));
          return;
        }
        handleSubmit(onSubmit)(e);
      }}
      className="space-y-6"
    >
      {/* Step indicators */}
      {mode === "create" && (
        <ElevatedContainer className="p-4">
          <div className="flex items-center justify-between">
            <StepIndicator
              step={1}
              currentStep={currentStep}
              label={t("form.steps.basicInfo")}
            />
            <div className="flex-1 mx-4 h-0.5 bg-border" />
            <StepIndicator
              step={2}
              currentStep={currentStep}
              label={t("form.steps.documents")}
            />
          </div>
        </ElevatedContainer>
      )}

      {/* Step 1: Basic Info */}
      {(currentStep === 1 || mode === "edit") && (
        <ElevatedContainer className="rounded-lg p-6 space-y-6 border border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-[--radius] bg-muted p-3">
              <Files className="h-6 w-6 text-primary-ink" weight="fill" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                {mode === "create" ? t("new.title") : t("edit.title")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {mode === "create"
                  ? t("new.description")
                  : t("edit.description")}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <ElevatedInput
              type="text"
              label={t("form.labels.name")}
              placeholder={t("form.placeholders.name")}
              {...register("name")}
              error={errors.name?.message}
            />

            <ElevatedTextArea
              label={t("form.labels.description")}
              placeholder={t("form.placeholders.description")}
              rows={4}
              {...register("description")}
              error={errors.description?.message}
            />
          </div>
        </ElevatedContainer>
      )}

      {/* Step 2: Documents */}
      {currentStep === 2 && mode === "create" && (
        <ElevatedContainer className="rounded-lg p-6 space-y-6 border border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-[--radius] bg-muted p-3">
              <UploadSimple className="h-6 w-6 text-primary-ink" weight="fill" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground">
                {t("form.fileUpload.title")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("form.fileUpload.description")}
              </p>
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {pendingFiles.length}/{MAX_DOCUMENTS}
            </span>
          </div>

          {/* File drop zone */}
          <div
            onDrop={
              pendingFiles.length >= MAX_DOCUMENTS ? undefined : handleDrop
            }
            onDragOver={
              pendingFiles.length >= MAX_DOCUMENTS ? undefined : handleDragOver
            }
            onDragLeave={
              pendingFiles.length >= MAX_DOCUMENTS ? undefined : handleDragLeave
            }
            onClick={() =>
              pendingFiles.length < MAX_DOCUMENTS &&
              fileInputRef.current?.click()
            }
            className={cn(
              "relative flex min-h-[200px] flex-col items-center justify-center rounded-[--radius] border border-dashed transition-all",
              pendingFiles.length >= MAX_DOCUMENTS
                ? "opacity-50 cursor-not-allowed border-border"
                : "cursor-pointer",
              isDragging
                ? "border-primary bg-muted"
                : "border-border hover:border-border hover:bg-muted",
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".txt,.md,.pdf,.csv,.json,.html,.docx,.xlsx,.xls"
              className="hidden"
              disabled={pendingFiles.length >= MAX_DOCUMENTS}
              onChange={(e) =>
                e.target.files && handleFilesSelected(e.target.files)
              }
            />

            <div className="flex flex-col items-center gap-3 text-center px-6">
              <div className="rounded-full bg-muted p-4">
                <UploadSimple className="h-8 w-8 text-primary-ink" weight="bold" />
              </div>
              <div>
                <p className="font-medium text-foreground">
                  {t("form.fileUpload.dropzone")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("form.fileUpload.formats")}
                </p>
              </div>
            </div>
          </div>

          {/* Pending files list */}
          {pendingFiles.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-foreground">
                  {t("form.fileUpload.selectedFiles", {
                    count: pendingFiles.length,
                  })}
                </h4>
                <button
                  type="button"
                  onClick={() => setPendingFiles([])}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {t("form.fileUpload.clearAll")}
                </button>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {pendingFiles.map((pf) => (
                  <div
                    key={pf.name}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                  >
                    <div className="rounded-lg bg-muted p-2">
                      <File className="h-4 w-4 text-primary-ink" weight="fill" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {pf.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(pf.size)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(pf.name)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <Trash className="h-4 w-4" weight="bold" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload progress */}
          {isSubmitting && uploadProgress > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("form.fileUpload.uploading")}
                </span>
                <span className="font-medium text-foreground">
                  {uploadProgress}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </ElevatedContainer>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-between gap-3">
        <div>
          {currentStep === 2 && mode === "create" && (
            <Button
              type="button"
              variant="ghost"
              title={t("form.buttons.back")}
              icon={<CaretLeft className="h-4 w-4" weight="bold" />}
              iconVisible
              iconSide="left"
              onClick={() => setCurrentStep(1)}
            />
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            title={t("form.buttons.cancel")}
            icon={<X className="h-4 w-4" weight="bold" />}
            iconVisible
            iconSide="left"
            onClick={() => router.push("/dashboard/knowledge-bases")}
          />

          {currentStep === 1 && mode === "create" ? (
            <Button
              type="button"
              variant="primary"
              title={t("form.buttons.next")}
              icon={<CaretRight className="h-4 w-4" weight="bold" />}
              iconVisible
              iconSide="right"
              onClick={() => canProceedToStep2 && setCurrentStep(2)}
              disabled={!canProceedToStep2}
            />
          ) : (
            <Button
              type="submit"
              variant="primary"
              title={
                isSubmitting
                  ? mode === "create"
                    ? t("form.buttons.creating")
                    : t("form.buttons.saving")
                  : mode === "create"
                    ? t("form.buttons.create")
                    : t("form.buttons.save")
              }
              icon={
                isSubmitting ? (
                  <CircleNotch className="h-4 w-4 animate-spin" weight="bold" />
                ) : (
                  <FloppyDisk className="h-4 w-4" weight="bold" />
                )
              }
              iconVisible
              iconSide="left"
              disabled={
                isSubmitting || (mode === "create" && pendingFiles.length === 0)
              }
            />
          )}
        </div>
      </div>
    </form>
  );
}
