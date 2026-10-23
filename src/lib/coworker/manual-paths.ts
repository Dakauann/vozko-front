export interface ManualPath {
  file: string;
  control: string;
  how: string;
}

export type ManualEntry = { paths: readonly ManualPath[] } | { pending: string };

export type ToolEntry = ManualEntry | { perception: string };

export function by(...paths: ManualPath[]): ManualEntry {
  return { paths };
}

export function at(file: string, control: string, how: string): ManualPath {
  return { file, control, how };
}
