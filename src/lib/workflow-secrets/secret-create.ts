import { isValidSecretName } from "./secret-name";

export interface SecretNameList {
  names: ReadonlySet<string>;
  loading: boolean;
  failed: boolean;
}

export type SecretCreateBlock = "invalid" | "taken" | "unverified";

export type SecretField = "name" | "value";

const FIELD_OF_CODE: Record<string, SecretField> = {
  invalid_name: "name",
  value_required: "value",
  value_too_long: "value",
};

export function secretCreateBlock(name: string, list: SecretNameList): SecretCreateBlock | null {
  if (!isValidSecretName(name)) return "invalid";
  if (list.names.has(name)) return "taken";
  if (list.loading || list.failed) return "unverified";
  return null;
}

export function secretFieldOfCode(code: string | undefined): SecretField | null {
  return (code && FIELD_OF_CODE[code]) || null;
}
