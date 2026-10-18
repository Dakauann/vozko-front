export interface KnowledgeBase {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  status: "active" | "processing" | "error";
  documentCount: number;
  chunkCount: number;
  totalSizeMB: number;
  config: KnowledgeBaseConfig;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeBaseConfig {
  chunkingStrategy: "fixed" | "sentence" | "paragraph" | "semantic";
  chunkSize: number;
  chunkOverlap: number;
  embeddingModel: string;
  embeddingDimension: number;
}

export interface KnowledgeBaseDocument {
  id: string;
  knowledgeBaseId: string;
  name: string;
  type: "text" | "pdf" | "docx" | "markdown" | "html" | "json";
  status: "pending" | "processing" | "ready" | "failed";
  sizeBytes: number;
  chunkCount: number;
  metadata: Record<string, string>;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}
