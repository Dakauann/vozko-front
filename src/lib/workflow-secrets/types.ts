export interface WorkflowSecret {
  name: string;
  updatedAt: string;
  updatedBy: string;
}

export interface WorkflowSecretResponse {
  name: string;
  updated_at: string;
  updated_by: string;
}

export interface WorkflowSecretListResponse {
  secrets?: WorkflowSecretResponse[] | null;
}
