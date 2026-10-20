import { describe, expect, it } from "vitest";

import { codeTemplateSuggestion, plainSecretFix } from "./plain-secret";
import type { LintIssue } from "./types";

const SECRET = "NODE_SECRET_IN_PLAIN_TEXT";

function issue(field: string, path: string | undefined): LintIssue {
  return {
    code: SECRET,
    severity: "advisory",
    nodeId: "n1",
    field,
    path,
    message: "Secret in plain text",
    hint: "Mova o valor para os segredos do workspace.",
  };
}

describe("plainSecretFix", () => {
  it("moves a credential header to a secret placeholder and keeps the other headers", () => {
    const fix = plainSecretFix(issue("headers", "headers.X-Api-Key"), {
      url: "https://api",
      headers: { Accept: "json", "X-Api-Key": "abc123" },
    });
    expect(fix?.value).toBe("abc123");
    expect(fix?.suggestedName).toBe("x_api_key");
    expect(fix?.replace("chave_api")).toEqual({
      url: "https://api",
      headers: { Accept: "json", "X-Api-Key": "{{secret.chave_api}}" },
    });
  });

  it("reads headers stored as JSON text", () => {
    const fix = plainSecretFix(issue("headers", "headers.Authorization"), { headers: '{"Authorization":"Bearer abc"}' });
    expect(fix?.value).toBe("Bearer abc");
    expect(fix?.replace("token")).toEqual({ headers: { Authorization: "{{secret.token}}" } });
  });

  it("moves the auth token", () => {
    const fix = plainSecretFix(issue("auth_token", "auth_token"), { auth_type: "bearer", auth_token: "tok" });
    expect(fix?.value).toBe("tok");
    expect(fix?.suggestedName).toBe("auth_token");
    expect(fix?.replace("api_token")).toEqual({ auth_type: "bearer", auth_token: "{{secret.api_token}}" });
  });

  it("replaces the nested body credential the path names, keeping the author's formatting", () => {
    const body = '{\n  "login": {\n    "usuario": "{{input.user}}",\n    "senha": "s3nh@"\n  }\n}';
    const fix = plainSecretFix(issue("body", "body.login.senha"), { body });
    expect(fix?.value).toBe("s3nh@");
    expect(fix?.suggestedName).toBe("senha");
    expect(fix?.replace("unifecaf_senha")).toEqual({
      body: '{\n  "login": {\n    "usuario": "{{input.user}}",\n    "senha": "{{secret.unifecaf_senha}}"\n  }\n}',
    });
  });

  it("follows the path, not the first key with the same name", () => {
    const body = '{"a":{"senha":"{{secret.a}}"},"b":{"senha":"plain"}}';
    const fix = plainSecretFix(issue("body", "body.b.senha"), { body });
    expect(fix?.value).toBe("plain");
    expect(JSON.parse(fix?.replace("b_senha").body as string)).toEqual({ a: { senha: "{{secret.a}}" }, b: { senha: "{{secret.b_senha}}" } });
  });

  it("rewrites the JSON when the same pair appears twice, so only the named one changes", () => {
    const body = '{"a":{"pin":"1"},"b":{"pin":"1"}}';
    const fix = plainSecretFix(issue("body", "body.b.pin"), { body });
    expect(JSON.parse(fix?.replace("pin").body as string)).toEqual({ a: { pin: "1" }, b: { pin: "{{secret.pin}}" } });
  });

  it("moves a numeric body credential as text", () => {
    const fix = plainSecretFix(issue("body", "body.pin"), { body: '{"pin": 1234}' });
    expect(fix?.value).toBe("1234");
    expect(fix?.replace("pin")).toEqual({ body: '{"pin": "{{secret.pin}}"}' });
  });

  it("moves a set_variable literal, naming the secret after the variable", () => {
    const fix = plainSecretFix(issue("value", "config.value"), { variable: "unifecafToken", value: "abc" });
    expect(fix?.value).toBe("abc");
    expect(fix?.suggestedName).toBe("unifecaf_token");
    expect(fix?.replace("token")).toEqual({ variable: "unifecafToken", value: "{{secret.token}}" });
  });

  it("moves a JavaScript literal to secrets.get", () => {
    const code = "const user = 'ana';\nconst password = \"p@ss\";\nreturn { user };";
    const fix = plainSecretFix(issue("code", "code:password"), { code });
    expect(fix?.value).toBe("p@ss");
    expect(fix?.suggestedName).toBe("password");
    expect(fix?.replace("senha_api")).toEqual({
      code: "const user = 'ana';\nconst password = secrets.get('senha_api');\nreturn { user };",
    });
  });

  it("skips template literals with interpolation, like the lint", () => {
    const code = "const token = `${a}`;\nconst token2 = 'x';";
    expect(plainSecretFix(issue("code", "code:token"), { code })).toBeNull();
  });

  it("offers nothing when the alert carries no path", () => {
    expect(plainSecretFix(issue("headers", undefined), { headers: { Authorization: "b" } })).toBeNull();
  });

  it("offers nothing when the path points at nothing the node still holds", () => {
    expect(plainSecretFix(issue("headers", "headers.Authorization"), { headers: { Authorization: "{{secret.authorization}}" } })).toBeNull();
    expect(plainSecretFix(issue("auth_token", "auth_token"), {})).toBeNull();
    expect(plainSecretFix(issue("body", "body.login.senha"), { body: '{"login":{}}' })).toBeNull();
    expect(plainSecretFix(issue("body", "body.senha"), { body: "not json" })).toBeNull();
    expect(plainSecretFix(issue("code", "code:missing"), { code: "const a = 'b';" })).toBeNull();
  });

  it("offers nothing for a path shape it does not know", () => {
    expect(plainSecretFix(issue("query", "query.token"), { query: { token: "x" } })).toBeNull();
  });

  it("offers nothing for another alert", () => {
    expect(plainSecretFix({ ...issue("auth_token", "auth_token"), code: "OTHER" }, { auth_token: "x" })).toBeNull();
  });
});

describe("codeTemplateSuggestion", () => {
  const base: LintIssue = {
    code: "NODE_CODE_READS_TEMPLATE",
    severity: "advisory",
    nodeId: "n56",
    field: "code",
    path: "code",
    message: "Code reads a template",
    hint: "Leia a saída do nó anterior com input.<campo> e a de outro nó com state.get('node.<id>.<campo>'). Aqui: state.get('node.n55.status_code').",
  };

  it("pairs the template found in the node code with the concrete replacement", () => {
    expect(codeTemplateSuggestion(base, { code: "if ({{ node.n55.status_code }} === 200) return {};" })).toEqual({
      template: "{{ node.n55.status_code }}",
      replacement: "state.get('node.n55.status_code')",
    });
  });

  it("suggests secrets.get for a secret template", () => {
    expect(
      codeTemplateSuggestion(
        { ...base, hint: "Leia o segredo do workspace com secrets.get('senha')." },
        { code: 'const s = "{{secret.senha}}";' },
      ),
    ).toEqual({ template: "{{secret.senha}}", replacement: "secrets.get('senha')" });
  });

  it("has no concrete replacement for system values", () => {
    expect(
      codeTemplateSuggestion(
        { ...base, hint: "Leia a saída do nó anterior com input.<campo> e a de outro nó com state.get('node.<id>.<campo>')." },
        { code: "const d = '{{sys.date}}';" },
      ),
    ).toEqual({ template: "{{sys.date}}", replacement: null });
  });

  it("is null when the code no longer has a template, the path is not the code, or for another alert", () => {
    expect(codeTemplateSuggestion(base, { code: "return {};" })).toBeNull();
    expect(codeTemplateSuggestion({ ...base, path: undefined }, { code: "{{a}}" })).toBeNull();
    expect(codeTemplateSuggestion({ ...base, code: "OTHER" }, { code: "{{a}}" })).toBeNull();
    expect(codeTemplateSuggestion(base, undefined)).toBeNull();
  });
});
