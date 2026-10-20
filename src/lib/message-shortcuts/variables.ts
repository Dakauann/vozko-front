export interface ShortcutVariableValues {
  leadName?: string | null;
  leadPhone?: string | null;
  operatorName?: string | null;
}

export const SHORTCUT_VARIABLES = [
  { name: "nome", labelKey: "nome" },
  { name: "primeiro_nome", labelKey: "primeiroNome" },
  { name: "telefone", labelKey: "telefone" },
  { name: "atendente", labelKey: "atendente" },
] as const;

export type ShortcutVariableName = (typeof SHORTCUT_VARIABLES)[number]["name"];

export interface ResolvedShortcut {
  text: string;
  unresolved: string[];
}

const PLACEHOLDER = /\{\{\s*([^{}]+?)\s*\}\}/g;

function present(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function personName(value: string | null | undefined): string | null {
  const name = present(value);
  return name && /\p{L}/u.test(name) ? name : null;
}

function valueOf(name: string, values: ShortcutVariableValues): string | null {
  switch (name as ShortcutVariableName) {
    case "nome":
      return personName(values.leadName);
    case "primeiro_nome":
      return personName(values.leadName)?.split(/\s+/)[0] ?? null;
    case "telefone":
      return present(values.leadPhone);
    case "atendente":
      return present(values.operatorName);
    default:
      return null;
  }
}

function distinct(names: string[]): string[] {
  return [...new Set(names)];
}

export function unresolvedVariables(text: string): string[] {
  return distinct([...text.matchAll(PLACEHOLDER)].map((match) => match[1].toLowerCase()));
}

export function resolveShortcutVariables(content: string, values: ShortcutVariableValues): ResolvedShortcut {
  const unresolved: string[] = [];
  const text = content.replace(PLACEHOLDER, (placeholder, rawName: string) => {
    const name = rawName.toLowerCase();
    const value = valueOf(name, values);
    if (value === null) {
      unresolved.push(name);
      return placeholder;
    }
    return value;
  });
  return { text, unresolved: distinct(unresolved) };
}
