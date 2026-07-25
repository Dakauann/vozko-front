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

export interface CreateKnowledgeBasePayload {
  name: string;
  description?: string;
  chunkingStrategy?: string;
  chunkSize?: number;
  chunkOverlap?: number;
  embeddingModel?: string;
}

export interface UpdateKnowledgeBasePayload {
  name?: string;
  description?: string;
  chunkingStrategy?: string;
  chunkSize?: number;
  chunkOverlap?: number;
  embeddingModel?: string;
}

export interface CreateDocumentPayload {
  name: string;
  type: string;
  content?: string;
  mediaId?: string;
  metadata?: Record<string, string>;
}

export interface QueryKnowledgeBasePayload {
  query: string;
  knowledgeBaseIds?: string[];
  maxResults?: number;
  minScore?: number;
}

export interface QueryResult {
  chunks: ChunkWithScore[];
  totalFound: number;
}

export interface ChunkWithScore {
  chunk: Chunk;
  score: number;
  documentId: string;
}

export interface Chunk {
  id: string;
  documentId: string;
  knowledgeBaseId: string;
  content: string;
  index: number;
  startOffset: number;
  endOffset: number;
  metadata: Record<string, string>;
  tokenCount: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
