import { IDENTIFIER_NAME_MAX_LENGTH, isIdentifierName } from "@/lib/workflows/identifier-name";

export const SECRET_NAME_MAX_LENGTH = IDENTIFIER_NAME_MAX_LENGTH;

export function isValidSecretName(name: string): boolean {
  return isIdentifierName(name);
}

export interface SecretUsageSnippets {
  template: string;
  code: string;
}

export function secretUsageSnippets(name: string): SecretUsageSnippets {
  return {
    template: `{{secret.${name}}}`,
    code: `secrets.get('${name}')`,
  };
}

export interface SecretTemplateGroup {
  label: string;
  vars: { template: string; description: string }[];
}

export function secretTemplateGroup(names: readonly string[]): SecretTemplateGroup | null {
  if (names.length === 0) return null;
  return {
    label: "Segredos",
    vars: names.map((name) => ({ template: secretUsageSnippets(name).template, description: name })),
  };
}
