export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  created_by: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface CreatedApiKey extends ApiKey {
  key: string;
}

export interface ApiKeyScope {
  scope: string;
  description: string;
}

export interface ApiKeyProduct {
  key: string;
  scopes: ApiKeyScope[];
}

export interface ApiKeyList {
  keys: ApiKey[];
  products: ApiKeyProduct[];
}

export interface CreateApiKeyInput {
  name: string;
  scopes: string[];
}
