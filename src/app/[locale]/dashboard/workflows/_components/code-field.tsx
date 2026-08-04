"use client";

import type * as Monaco from "monaco-editor";

import type { BeforeMount, OnMount } from "@monaco-editor/react";
import { useEffect, useMemo, useRef } from "react";

import type { ConfigField } from "@/lib/workflows/types";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";


const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[260px] items-center justify-center rounded-md border border-border bg-muted text-xs text-muted-foreground">
      Carregando editor…
    </div>
  ),
});

const SANDBOX_DTS = `
/**
 * Frozen object representing the previous node's output.
 * Access fields directly, e.g. \`input.body\`, \`input.status\`.
 */
declare const input: Record<string, any>;

/** Workflow run state, shared across nodes in this execution. */
declare const state: {
  /**
   * Read a variable saved by an earlier node (or this script).
   *
   * Supports dotted-path traversal for nested objects, matching the
   * \`{{a.b.c}}\` syntax used in templates. Example: when an AI agent
   * stores \`ai_response = { tool_args: { query: "..." } }\`, you can
   * write \`state.get("ai_response.tool_args.query")\` to read the
   * nested field directly. Numeric segments index into arrays
   * (\`state.get("results.0.title")\`).
   *
   * Flat keys take precedence: if a key literally containing dots
   * was written via \`state.set\`, that exact key is returned first.
   *
   * Returns \`undefined\` when any segment is missing.
   */
  get(key: string): any;
  /** Persist a value under \`key\` (writes are audited). */
  set(key: string, value: any): void;
};

/** Append a structured entry to the run log. */
declare function log(
  level: "debug" | "info" | "warn" | "error",
  ...args: any[]
): void;

/** Pause execution. Counts toward the wall-clock budget. */
declare function sleep(ms: number): void;

/** SSRF-hardened HTTP client (HTTPS only by default). */
declare function fetch(
  urlOrOptions:
    | string
    | {
        url: string;
        method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD";
        headers?: Record<string, string>;
        body?: any;
        timeout_ms?: number;
        query?: Record<string, any>;
      },
): {
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  body: string;
  url: string;
  duration_ms: number;
};

/** Workspace secrets, non-enumerable; \`Object.keys(secrets)\` returns []. */
declare const secrets: {
  /** Throws if \`name\` is not in the workspace allowlist. */
  get(name: string): string;
};

declare const json: {
  parse(text: string): any;
  stringify(value: any): string;
};

declare const b64: {
  encode(value: string): string;
  decode(value: string): string;
};

declare const crypto: {
  /** RFC 4122 v4 UUID. */
  uuid(): string;
  /** Hex-encoded hash. \`alg\`: 'sha256' | 'sha1' | 'md5'. */
  hash(alg: "sha256" | "sha1" | "md5", data: string): string;
};
`;

export function CodeField({
  field,
  value,
  onChange,
  height = 360,
}: {
  field: ConfigField;
  value: unknown;
  onChange: (val: unknown) => void;
  height?: number;
}) {
  const { resolvedTheme } = useTheme();
  const monacoTheme = resolvedTheme === "dark" ? "vs-dark" : "vs";

  const code = typeof value === "string" ? value : "";
  const monacoRef = useRef<typeof Monaco | null>(null);
  const seededRef = useRef(false);

  useEffect(() => {
    if (seededRef.current) return;
    if (code.length > 0) {
      seededRef.current = true;
      return;
    }
    const placeholder =
      typeof field.placeholder === "string" ? field.placeholder : "";
    if (placeholder.length > 0) {
      seededRef.current = true;
      onChange(placeholder);
    }
  }, [code, field.placeholder, onChange]);

  const handleBeforeMount: BeforeMount = (monaco) => {
    monacoRef.current = monaco;
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2018,
      allowNonTsExtensions: true,
      lib: ["es2018"], // no DOM, sandbox has no window/document
    });
    const uri = "ts:scriptvm-sandbox.d.ts";
    monaco.languages.typescript.javascriptDefaults.addExtraLib(
      SANDBOX_DTS,
      uri,
    );
  };

  const handleMount: OnMount = (editor) => {
    editor.addCommand(
      // eslint-disable-next-line no-bitwise
      (monacoRef.current?.KeyMod.CtrlCmd ?? 2048) |
        (monacoRef.current?.KeyCode.KeyS ?? 49),
      () => {
        /* swallow; outer panel persists on change */
      },
    );
  };

  useEffect(() => {
    return () => {
      // Nothing to teardown, Monaco keeps extraLibs in a global registry,
      // and re-adding under the same URI replaces the previous entry.
    };
  }, []);

  const options = useMemo<Monaco.editor.IStandaloneEditorConstructionOptions>(
    () => ({
      fontSize: 13,
      fontFamily:
        "ui-monospace, SFMono-Regular, 'JetBrains Mono', 'Fira Code', Menlo, monospace",
      fontLigatures: true,
      lineNumbers: "on",
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      tabSize: 2,
      insertSpaces: true,
      wordWrap: "on",
      automaticLayout: true,
      renderLineHighlight: "all",
      bracketPairColorization: { enabled: true },
      guides: { indentation: true, bracketPairs: true },
      padding: { top: 12, bottom: 12 },
      quickSuggestions: {
        other: true,
        comments: false,
        strings: true,
      },
      suggestOnTriggerCharacters: true,
      formatOnPaste: true,
      formatOnType: true,
    }),
    [],
  );

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-foreground">
          {field.label}
          {field.required ? <span className="text-destructive"> *</span> : null}
        </label>
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          JavaScript · sandbox
        </span>
      </div>
      <div
        className="nodrag nopan nowheel overflow-hidden rounded-md border border-border bg-background"
        style={{ height }}
        onKeyDown={(e) => e.stopPropagation()}
        onKeyUp={(e) => e.stopPropagation()}
      >
        <MonacoEditor
          height="100%"
          defaultLanguage="javascript"
          language="javascript"
          path="file:///workflow-script.js"
          theme={monacoTheme}
          value={code}
          onChange={(v) => onChange(v ?? "")}
          beforeMount={handleBeforeMount}
          onMount={handleMount}
          options={options}
        />
      </div>
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        Tem acesso a <code>input</code>, <code>state</code>, <code>log</code>,{" "}
        <code>fetch</code>, <code>secrets</code>, <code>json</code>,{" "}
        <code>b64</code>, <code>crypto</code>, <code>sleep</code>,{" "}
        <code>Math</code>, <code>Date</code>. Sem <code>eval</code>,{" "}
        <code>require</code>, <code>setTimeout</code>, DOM ou rede privada.
        Retorne um objeto para virar a saída do nó.
      </p>
    </div>
  );
}
