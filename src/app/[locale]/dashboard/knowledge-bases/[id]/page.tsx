"use client";

import {
  CircleNotch,
  FileText,
  Files,
  PencilSimple,
  Trash,
  UploadSimple,
} from "@/components/icons";
import type {
  KnowledgeBase,
  KnowledgeBaseDocument,
} from "@/lib/knowledge-base/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { apiClient } from "@/lib/api/browser-client";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { IconBox } from "@/components/elevated-design/listing-card";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";
import { useTranslations } from "next-intl";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1] as const,
    },
  },
};

export default function KnowledgeBaseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const t = useTranslations("knowledgeBase");
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase | null>(
    null,
  );
  const [documents, setDocuments] = useState<KnowledgeBaseDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const { data: kbData, error: kbError } = await apiClient<KnowledgeBase>(
        `/knowledge-bases/${params.id}`,
      );
      if (kbError || !kbData) {
        throw new Error("Failed to fetch knowledge base");
      }
      setKnowledgeBase(kbData);

      const pageSize = 100;
      let allDocs: KnowledgeBaseDocument[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const { data: docsData } = await apiClient<{
          data?: KnowledgeBaseDocument[];
          meta?: { totalPages: number };
        }>(
          `/knowledge-bases/${params.id}/documents?page=${page}&pageSize=${pageSize}`,
        );
        if (docsData) {
          const docs = docsData.data || [];
          allDocs = [...allDocs, ...docs];
          const meta = docsData.meta;
          hasMore = !!meta && page < meta.totalPages;
          page++;
        } else {
          hasMore = false;
        }
      }

      setDocuments(allDocs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const hasProcessing = documents.some(
      (doc) => doc.status === "pending" || doc.status === "processing",
    );

    if (hasProcessing) {
      pollRef.current = setInterval(() => {
        fetchData();
      }, 5000);
    } else if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [documents, fetchData]);

  const MAX_DOCUMENTS = 120;

  const uploadDocuments = async (files: File[]) => {
    if (files.length === 0) return;

    const remaining = MAX_DOCUMENTS - documents.length;
    if (remaining <= 0) {
      toast.error(t("documents.maxReached"));
      return;
    }

    const filesToUpload = files.slice(0, remaining);
    if (filesToUpload.length < files.length) {
      toast.warning(
        t("documents.limitTruncated", {
          selected: files.length,
          allowed: filesToUpload.length,
        }),
      );
    }

    setUploading(true);
    try {
      const formData = new FormData();
      for (const file of filesToUpload) {
        formData.append("files", file, file.name);
      }

      const { error } = await apiClient(
        `/knowledge-bases/${params.id}/documents/upload`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (error) {
        throw new Error(error.message || t("documents.uploadFailed"));
      }

      toast.success(
        t("documents.uploadSuccessMulti", { count: filesToUpload.length }),
      );
      fetchData();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("documents.uploadFailed"),
      );
    } finally {
      setUploading(false);
    }
  };

  const deleteDocument = async (documentId: string) => {
    try {
      const { error } = await apiClient(
        `/knowledge-bases/${params.id}/documents/${documentId}`,
        {
          method: "DELETE",
        },
      );

      if (error) {
        throw new Error("Failed to delete document");
      }

      setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
      toast.success("Document deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        uploadDocuments(acceptedFiles);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params.id, documents.length],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "text/plain": [".txt"],
      "text/csv": [".csv"],
      "text/markdown": [".md"],
      "application/json": [".json"],
      "text/html": [".html"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "application/vnd.ms-excel": [".xls"],
    },
    maxSize: 10 * 1024 * 1024, // 10MB per file
    multiple: true,
    disabled: uploading || documents.length >= MAX_DOCUMENTS,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <CircleNotch
          className="h-8 w-8 animate-spin text-primary-ink"
          weight="bold"
        />
      </div>
    );
  }

  if (error || !knowledgeBase) {
    return (
      <ElevatedContainer className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">
          {error || "Knowledge base not found"}
        </p>
      </ElevatedContainer>
    );
  }

  const totalChunks = documents.reduce(
    (acc, doc) => acc + (doc.chunkCount || 0),
    0,
  );

  return (
    <motion.main
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full space-y-6"
    >
      <motion.div variants={itemVariants}>
        <DashboardPageHeader
          back={{
            onClick: () => router.push("/dashboard/knowledge-bases"),
            label: t("detail.back"),
          }}
          icon={<Files className="h-5 w-5" weight="fill" />}
          badge={t("header.badge")}
          title={knowledgeBase.name}
          description={knowledgeBase.description || t("card.noDescription")}
          colorClass="text-info-ink"
          actions={
            <Button
              variant="secondary"
              title={t("card.edit")}
              icon={<PencilSimple className="h-4 w-4" weight="bold" />}
              iconVisible
              iconSide="left"
              link={`/dashboard/knowledge-bases/${params.id}/edit`}
              newTab={false}
            />
          }
        />
      </motion.div>

      <motion.div
        variants={containerVariants}
        className="grid gap-4 sm:grid-cols-3"
      >
        <motion.div variants={itemVariants}>
          <ElevatedContainer className="p-4 text-center">
            <p className="text-2xl font-semibold text-foreground">
              {documents.length}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("detail.documents")}
            </p>
          </ElevatedContainer>
        </motion.div>
        <motion.div variants={itemVariants}>
          <ElevatedContainer className="p-4 text-center">
            <p className="text-2xl font-semibold text-foreground">{totalChunks}</p>
            <p className="text-sm text-muted-foreground">
              {t("detail.chunks")}
            </p>
          </ElevatedContainer>
        </motion.div>
        <motion.div variants={itemVariants}>
          <ElevatedContainer className="p-4 text-center">
            <p className="text-2xl font-semibold text-foreground">
              {new Date(knowledgeBase.createdAt).toLocaleDateString()}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("detail.createdAt")}
            </p>
          </ElevatedContainer>
        </motion.div>
      </motion.div>

      <motion.div variants={itemVariants}>
        <ElevatedContainer className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                {t("documents.title")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("documents.description")}
              </p>
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {documents.length}/{MAX_DOCUMENTS}
            </span>
          </div>

          <div
            {...getRootProps()}
            className={cn(
              "border border-dashed rounded-[--radius] p-8 text-center cursor-pointer transition-colors mb-6",
              documents.length >= MAX_DOCUMENTS &&
                "opacity-50 cursor-not-allowed",
              isDragActive
                ? "border-info bg-muted"
                : "border-border hover:border-info/50 hover:bg-muted",
            )}
          >
            <input {...getInputProps()} />
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <CircleNotch className="h-8 w-8 animate-spin text-info-ink" />
                <p className="text-sm text-muted-foreground">
                  {t("documents.uploading")}
                </p>
              </div>
            ) : documents.length >= MAX_DOCUMENTS ? (
              <div className="flex flex-col items-center gap-2">
                <IconBox color="amber" size="md">
                  <UploadSimple weight="bold" />
                </IconBox>
                <p className="font-medium text-foreground">
                  {t("documents.maxReached")}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <IconBox color="cyan" size="md">
                  <UploadSimple weight="bold" />
                </IconBox>
                <p className="font-medium text-foreground">
                  {t("documents.dropzone.title")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("documents.dropzone.subtitle")}
                </p>
              </div>
            )}
          </div>

          {documents.length === 0 ? (
            <div className="text-center py-8">
              <FileText
                className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4"
                weight="fill"
              />
              <p className="font-medium text-foreground">
                {t("documents.empty")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("documents.emptyDescription")}
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4 rounded-[--radius] border border-border bg-card hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <IconBox color="cyan" size="sm">
                      <FileText weight="fill" />
                    </IconBox>
                    <div>
                      <p className="font-medium text-foreground">{doc.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-[--radius] px-2 py-0.5 text-[11px] font-semibold",
                            doc.status === "ready" &&
                              "bg-healthy text-healthy-foreground",
                            doc.status === "processing" &&
                              "bg-warning text-warning-foreground",
                            doc.status === "pending" &&
                              "bg-muted text-muted-foreground",
                            doc.status === "failed" &&
                              "bg-destructive text-destructive-foreground",
                          )}
                        >
                          {(doc.status === "processing" ||
                            doc.status === "pending") && (
                            <CircleNotch className="h-3 w-3 animate-spin" />
                          )}
                          {doc.status === "ready"
                            ? t("documents.ready")
                            : doc.status === "processing"
                              ? t("documents.processing")
                              : doc.status === "pending"
                                ? t("documents.pending")
                                : t("documents.failed")}
                        </span>
                        {doc.status === "ready" && (
                          <span className="text-xs text-muted-foreground">
                            {doc.chunkCount || 0} {t("card.chunks")}
                          </span>
                        )}
                        {doc.status === "failed" && doc.errorMessage && (
                          <span className="text-xs text-destructive/70 truncate max-w-[200px]">
                            {doc.errorMessage}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteDocument(doc.id)}
                    className="rounded-lg p-2 text-muted-foreground hover:text-destructive-ink hover:bg-muted transition-colors"
                  >
                    <Trash className="h-4 w-4" weight="bold" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </ElevatedContainer>
      </motion.div>
    </motion.main>
  );
}
