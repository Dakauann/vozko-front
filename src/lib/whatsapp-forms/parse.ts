import { isCount, isJson, isText, type Json } from "@/lib/json/guards";

import {
  APPLY_STATUSES,
  AUTOMATION_USES,
  BINDING_TARGETS,
  CATEGORIES,
  CUSTOM_FIELD_TYPES,
  DISPLAY_KINDS,
  FIELD_KINDS,
  MATCH_RESULTS,
  PUBLICATION_STATUSES,
  SEND_ORIGINS,
  SEND_STATUSES,
  type Answer,
  type AnswerFile,
  type AnswerProblem,
  type Answers,
  type ApplyReport,
  type Binding,
  type BindingOption,
  type Block,
  type Branch,
  type Category,
  type Condition,
  type CustomFieldOption,
  type DayStat,
  type Display,
  type DisplayKind,
  type Distribution,
  type Document,
  type Field,
  type FieldKind,
  type FileOutcome,
  type Form,
  type FormAutomation,
  type FormDetail,
  type FormSummary,
  type Limits,
  type Option,
  type Options,
  type OriginStat,
  type Outcome,
  type Page,
  type Preview,
  type Problem,
  type Publication,
  type PublicationBrief,
  type PublishResult,
  type Response,
  type ResponseDetail,
  type ResponseRow,
  type Route,
  type Screen,
  type Send,
  type SendableForm,
  type SendStatus,
  type Starter,
  type Stats,
  type Version,
} from "./types";

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function oneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

function texts<K extends string>(value: Json, keys: readonly K[]): Partial<Record<K, string>> {
  const found: Partial<Record<K, string>> = {};
  for (const key of keys) {
    const text = value[key];
    if (isText(text)) found[key] = text;
  }
  return found;
}

function numbers<K extends string>(value: Json, keys: readonly K[]): Partial<Record<K, number>> {
  const found: Partial<Record<K, number>> = {};
  for (const key of keys) {
    const n = value[key];
    if (isNumber(n)) found[key] = n;
  }
  return found;
}

function strictList<T>(value: unknown, parse: (item: unknown) => T | null): T[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;
  const items: T[] = [];
  for (const item of value) {
    const parsed = parse(item);
    if (parsed === null) return null;
    items.push(parsed);
  }
  return items;
}

function knownList<T extends string>(values: readonly T[], value: unknown): T[] {
  return Array.isArray(value) ? value.filter((item): item is T => oneOf(values, item)) : [];
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(isString) : [];
}

function countRecord(value: unknown): Record<string, number> | null {
  if (!isJson(value)) return null;
  const record: Record<string, number> = {};
  for (const [key, n] of Object.entries(value)) {
    if (isCount(n)) record[key] = n;
  }
  return record;
}

function parseOption(value: unknown): Option | null {
  if (!isJson(value) || !isText(value.id) || !isString(value.title)) return null;
  return { id: value.id, title: value.title, ...texts(value, ["description"] as const) };
}

function parseBinding(value: unknown): Binding | null {
  if (!isJson(value) || !oneOf(BINDING_TARGETS, value.target)) return null;
  return { target: value.target, ...texts(value, ["customFieldKey"] as const) };
}

function parseCondition(value: unknown): Condition | null {
  if (!isJson(value) || !isText(value.fieldKey) || !isString(value.value)) return null;
  return { fieldKey: value.fieldKey, value: value.value, ...(value.negate === true ? { negate: true } : {}) };
}

function parseField(value: unknown): Field | null {
  if (!isJson(value) || !isText(value.key) || !oneOf(FIELD_KINDS, value.kind) || !isString(value.label)) return null;
  const options = value.options === undefined ? undefined : strictList(value.options, parseOption);
  if (options === null) return null;
  const binding = value.binding === undefined || value.binding === null ? undefined : parseBinding(value.binding);
  if (binding === null) return null;
  const mimeTypes = stringList(value.mimeTypes);
  return {
    key: value.key,
    kind: value.kind,
    label: value.label,
    required: value.required === true,
    sensitive: value.sensitive === true,
    ...texts(value, ["question", "help", "pattern", "minDate", "maxDate", "termsUrl"] as const),
    ...numbers(value, ["min", "max"] as const),
    ...(options && options.length > 0 ? { options } : {}),
    ...(mimeTypes.length > 0 ? { mimeTypes } : {}),
    ...(binding ? { binding } : {}),
  };
}

function parseDisplay(value: unknown): Display | null {
  if (!isJson(value) || !oneOf(DISPLAY_KINDS, value.kind)) return null;
  return { kind: value.kind, ...texts(value, ["text", "mediaId", "url"] as const) };
}

function parseBlock(value: unknown): Block | null {
  if (!isJson(value) || !isText(value.key)) return null;
  const display = value.display === undefined || value.display === null ? undefined : parseDisplay(value.display);
  const field = value.field === undefined || value.field === null ? undefined : parseField(value.field);
  const visibleIf = value.visibleIf === undefined || value.visibleIf === null ? undefined : parseCondition(value.visibleIf);
  if (display === null || field === null || visibleIf === null) return null;
  if (!display && !field) return null;
  return { key: value.key, ...(display ? { display } : {}), ...(field ? { field } : {}), ...(visibleIf ? { visibleIf } : {}) };
}

function parseBranch(value: unknown): Branch | null {
  if (!isJson(value) || !isText(value.optionId) || !isText(value.next)) return null;
  return { optionId: value.optionId, next: value.next };
}

function parseRoute(value: unknown): Route | null {
  if (value === undefined || value === null) return {};
  if (!isJson(value)) return null;
  const branches = strictList(value.branches, parseBranch);
  if (branches === null) return null;
  return { ...texts(value, ["next", "branchOn"] as const), ...(branches.length > 0 ? { branches } : {}) };
}

function parseScreen(value: unknown): Screen | null {
  if (!isJson(value) || !isText(value.key) || !isString(value.title)) return null;
  const blocks = strictList(value.blocks, parseBlock);
  const route = parseRoute(value.route);
  if (blocks === null || route === null) return null;
  return { key: value.key, title: value.title, blocks, route, submitLabel: isString(value.submitLabel) ? value.submitLabel : "" };
}

export function parseDocument(value: unknown): Document | null {
  if (!isJson(value) || !isCount(value.schema)) return null;
  const screens = strictList(value.screens, parseScreen);
  if (screens === null) return null;
  return { schema: value.schema, categories: knownList<Category>(CATEGORIES, value.categories), screens };
}

export function parseProblem(value: unknown): Problem | null {
  if (!isJson(value) || !isText(value.code)) return null;
  return {
    code: value.code,
    ...texts(value, ["screen", "block", "property", "message"] as const),
    ...numbers(value, ["limit"] as const),
  };
}

export function parseProblems(value: unknown): Problem[] | null {
  if (!isJson(value)) return null;
  return strictList(value.problems, parseProblem);
}

export function parseVersion(value: unknown): Version | null {
  if (!isJson(value) || !isText(value.id) || !isText(value.formId) || !isCount(value.number) || !isText(value.createdAt)) return null;
  const document = parseDocument(value.document);
  const problems = strictList(value.problems, parseProblem);
  if (!document || problems === null) return null;
  return {
    id: value.id,
    workspaceId: isString(value.workspaceId) ? value.workspaceId : "",
    formId: value.formId,
    number: value.number,
    document,
    createdAt: value.createdAt,
    ...texts(value, ["flowVersion", "compilerVersion", "hash", "createdBy"] as const),
    ...(problems.length > 0 ? { problems } : {}),
  };
}

export function parseForm(value: unknown): Form | null {
  if (!isJson(value) || !isText(value.id) || !isString(value.name) || !isText(value.createdAt) || !isText(value.updatedAt)) return null;
  return {
    id: value.id,
    workspaceId: isString(value.workspaceId) ? value.workspaceId : "",
    name: value.name,
    kind: value.kind === "external" ? "external" : "built",
    draftVersionId: isString(value.draftVersionId) ? value.draftVersionId : "",
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    ...texts(value, ["description", "publishedVersionId", "createdBy", "archivedAt"] as const),
  };
}

function parsePublicationBrief(value: unknown): PublicationBrief | null {
  if (!isJson(value) || !isText(value.metaWabaId) || !oneOf(PUBLICATION_STATUSES, value.status)) return null;
  return { metaWabaId: value.metaWabaId, status: value.status, versionId: isString(value.versionId) ? value.versionId : "" };
}

function parseFormSummary(value: unknown): FormSummary | null {
  if (!isJson(value)) return null;
  const form = parseForm(value.form);
  const publications = strictList(value.publications, parsePublicationBrief);
  if (!form || publications === null) return null;
  return {
    form,
    publications,
    sent: isCount(value.sent) ? value.sent : 0,
    responses: isCount(value.responses) ? value.responses : 0,
    ...texts(value, ["lastResponseAt"] as const),
  };
}

export function parseFormSummaries(value: unknown): FormSummary[] | null {
  if (!isJson(value)) return null;
  return strictList(value.items, parseFormSummary);
}

export function parsePublication(value: unknown): Publication | null {
  if (!isJson(value) || !isText(value.id) || !isText(value.metaWabaId) || !oneOf(PUBLICATION_STATUSES, value.status)) return null;
  const problems = strictList(value.problems, parseProblem);
  if (problems === null) return null;
  return {
    id: value.id,
    workspaceId: isString(value.workspaceId) ? value.workspaceId : "",
    formId: isString(value.formId) ? value.formId : "",
    wabaId: isString(value.wabaId) ? value.wabaId : "",
    metaWabaId: value.metaWabaId,
    metaName: isString(value.metaName) ? value.metaName : "",
    versionId: isString(value.versionId) ? value.versionId : "",
    status: value.status,
    createdAt: isString(value.createdAt) ? value.createdAt : "",
    updatedAt: isString(value.updatedAt) ? value.updatedAt : "",
    ...texts(value, ["metaFlowId", "lastError", "previewUrl", "previewExpiresAt", "publishedAt"] as const),
    ...(problems.length > 0 ? { problems } : {}),
  };
}

export function parseFormDetail(value: unknown): FormDetail | null {
  if (!isJson(value)) return null;
  const form = parseForm(value.form);
  const draft = parseVersion(value.draft);
  const published = value.published === undefined || value.published === null ? undefined : parseVersion(value.published);
  const publications = strictList(value.publications, parsePublication);
  if (!form || !draft || published === null || publications === null) return null;
  return { form, draft, publications, ...(published ? { published } : {}) };
}

export function parseDraftSaved(value: unknown): Version | null {
  return isJson(value) ? parseVersion(value.draft) : null;
}

function parseOutcome(value: unknown): Outcome | null {
  if (!isJson(value) || !isText(value.metaWabaId) || !oneOf(PUBLICATION_STATUSES, value.status)) return null;
  const problems = strictList(value.problems, parseProblem);
  if (problems === null) return null;
  return {
    metaWabaId: value.metaWabaId,
    status: value.status,
    ...texts(value, ["error", "code"] as const),
    ...(problems.length > 0 ? { problems } : {}),
  };
}

export function parsePublishResult(value: unknown): PublishResult | null {
  if (!isJson(value)) return null;
  const outcomes = strictList(value.outcomes, parseOutcome);
  const form = parseFormDetail(value.form);
  if (outcomes === null || !form) return null;
  return { outcomes, form };
}

export function parsePreview(value: unknown): Preview | null {
  if (!isJson(value) || !isText(value.previewUrl)) return null;
  return { previewUrl: value.previewUrl, expiresAt: isString(value.expiresAt) ? value.expiresAt : "" };
}

export function parseVersions(value: unknown): Version[] | null {
  if (!isJson(value)) return null;
  return strictList(value.items, parseVersion);
}

function parseSendableForm(value: unknown): SendableForm | null {
  if (!isJson(value) || !isText(value.formId) || !isString(value.name) || !isText(value.metaFlowId)) return null;
  return {
    formId: value.formId,
    name: value.name,
    versionId: isString(value.versionId) ? value.versionId : "",
    metaFlowId: value.metaFlowId,
    firstScreen: isString(value.firstScreen) ? value.firstScreen : "",
  };
}

export function parseSendableForms(value: unknown): SendableForm[] | null {
  if (!isJson(value)) return null;
  return strictList(value.items, parseSendableForm);
}

function parseAutomation(value: unknown): FormAutomation | null {
  if (!isJson(value) || !isText(value.workflowId) || !oneOf(AUTOMATION_USES, value.use)) return null;
  return { workflowId: value.workflowId, name: isString(value.name) ? value.name : "", active: value.active === true, use: value.use };
}

export function parseAutomations(value: unknown): FormAutomation[] | null {
  if (!isJson(value)) return null;
  return strictList(value.items, parseAutomation);
}

export function parseCreatedAutomation(value: unknown): { workflowId: string } | null {
  return isJson(value) && isText(value.workflowId) ? { workflowId: value.workflowId } : null;
}

export function parseSend(value: unknown): Send | null {
  if (!isJson(value) || !isText(value.id) || !isText(value.formId) || !oneOf(SEND_ORIGINS, value.origin) || !oneOf(SEND_STATUSES, value.status)) return null;
  if (!isText(value.createdAt)) return null;
  return {
    id: value.id,
    workspaceId: isString(value.workspaceId) ? value.workspaceId : "",
    formId: value.formId,
    versionId: isString(value.versionId) ? value.versionId : "",
    publicationId: isString(value.publicationId) ? value.publicationId : "",
    origin: value.origin,
    businessPhoneId: isString(value.businessPhoneId) ? value.businessPhoneId : "",
    contactNumber: isString(value.contactNumber) ? value.contactNumber : "",
    status: value.status,
    createdAt: value.createdAt,
    ...texts(value, [
      "originRef",
      "entryId",
      "entryType",
      "conversationId",
      "leadId",
      "messageId",
      "templateId",
      "workflowRunId",
      "sentBy",
      "failureReason",
      "sentAt",
      "respondedAt",
    ] as const),
  };
}

function parsePage<T>(value: unknown, parse: (item: unknown) => T | null): Page<T> | null {
  if (!isJson(value)) return null;
  const items = strictList(value.items, parse);
  if (items === null) return null;
  return { items, ...texts(value, ["next"] as const) };
}

export function parseSendPage(value: unknown): Page<Send> | null {
  return parsePage(value, parseSend);
}

function parseAnswerFile(value: unknown): AnswerFile | null {
  if (!isJson(value) || !isText(value.id)) return null;
  return {
    id: value.id,
    name: isString(value.name) ? value.name : "",
    mimeType: isString(value.mimeType) ? value.mimeType : "",
    ...texts(value, ["sha256"] as const),
  };
}

function parseAnswer(value: unknown): Answer | null {
  if (!isJson(value) || !isText(value.key) || !oneOf(FIELD_KINDS, value.kind)) return null;
  const files = strictList(value.files, parseAnswerFile);
  if (files === null) return null;
  const optionIds = stringList(value.optionIds);
  const range = isJson(value.range) && isString(value.range.start) && isString(value.range.end) ? { start: value.range.start, end: value.range.end } : undefined;
  return {
    key: value.key,
    kind: value.kind,
    ...texts(value, ["text"] as const),
    ...(optionIds.length > 0 ? { optionIds } : {}),
    ...(typeof value.checked === "boolean" ? { checked: value.checked } : {}),
    ...(range ? { range } : {}),
    ...(files.length > 0 ? { files } : {}),
  };
}

function parseAnswerProblem(value: unknown): AnswerProblem | null {
  return isJson(value) && isText(value.key) && isText(value.code) ? { key: value.key, code: value.code } : null;
}

export function parseAnswers(value: unknown): Answers | null {
  if (!isJson(value)) return null;
  const values: Record<string, Answer> = {};
  if (isJson(value.values)) {
    for (const [key, raw] of Object.entries(value.values)) {
      const answer = parseAnswer(raw);
      if (answer) values[key] = answer;
    }
  }
  const problems = strictList(value.problems, parseAnswerProblem) ?? [];
  return {
    values,
    ...(isJson(value.unknown) ? { unknown: value.unknown } : {}),
    ...(problems.length > 0 ? { problems } : {}),
  };
}

function parseFileOutcome(value: unknown): FileOutcome | null {
  if (!isJson(value) || !isText(value.key) || !isText(value.fileId)) return null;
  return { key: value.key, fileId: value.fileId, ...texts(value, ["mediaId", "problem"] as const) };
}

function parseApplyReport(value: unknown): ApplyReport {
  if (!isJson(value)) return {};
  const changed = stringList(value.changed);
  const conflicts = stringList(value.conflicts);
  const refused = stringList(value.refused);
  const files = strictList(value.files, parseFileOutcome) ?? [];
  return {
    ...(changed.length > 0 ? { changed } : {}),
    ...(conflicts.length > 0 ? { conflicts } : {}),
    ...(refused.length > 0 ? { refused } : {}),
    ...(files.length > 0 ? { files } : {}),
    ...(value.triggered === true ? { triggered: true } : {}),
    ...texts(value, ["consent", "resumed"] as const),
  };
}

export function parseResponse(value: unknown): Response | null {
  if (!isJson(value) || !isText(value.id) || !oneOf(MATCH_RESULTS, value.match) || !isText(value.submittedAt)) return null;
  const answers = parseAnswers(value.answers);
  if (!answers) return null;
  return {
    id: value.id,
    workspaceId: isString(value.workspaceId) ? value.workspaceId : "",
    match: value.match,
    inboundMessageId: isString(value.inboundMessageId) ? value.inboundMessageId : "",
    businessPhoneId: isString(value.businessPhoneId) ? value.businessPhoneId : "",
    contactNumber: isString(value.contactNumber) ? value.contactNumber : "",
    answers,
    applyStatus: oneOf(APPLY_STATUSES, value.applyStatus) ? value.applyStatus : "pending",
    report: parseApplyReport(value.report),
    submittedAt: value.submittedAt,
    createdAt: isString(value.createdAt) ? value.createdAt : value.submittedAt,
    ...(oneOf(SEND_ORIGINS, value.origin) ? { origin: value.origin } : {}),
    ...texts(value, ["formId", "versionId", "sendId", "conversationId", "entryId", "entryType", "leadId"] as const),
  };
}

function parseResponseRow(value: unknown): ResponseRow | null {
  const response = parseResponse(value);
  if (!response || !isJson(value)) return null;
  return { ...response, ...texts(value, ["leadName"] as const) };
}

export function parseResponsePage(value: unknown): Page<ResponseRow> | null {
  return parsePage(value, parseResponseRow);
}

export function parseResponseDetail(value: unknown): ResponseDetail | null {
  if (!isJson(value) || !isJson(value.form) || !isText(value.form.id)) return null;
  const response = parseResponse(value.response);
  const version = parseVersion(value.version);
  if (!response || !version) return null;
  return {
    response,
    form: { id: value.form.id, name: isString(value.form.name) ? value.form.name : "" },
    version,
    revealed: value.revealed === true,
    ...texts(value, ["leadName"] as const),
  };
}

function parseOriginStat(value: unknown): OriginStat | null {
  if (!isJson(value) || !oneOf(SEND_ORIGINS, value.origin) || !isCount(value.sent) || !isCount(value.responses)) return null;
  return { origin: value.origin, sent: value.sent, responses: value.responses };
}

function parseDayStat(value: unknown): DayStat | null {
  if (!isJson(value) || !isText(value.day) || !isCount(value.sent) || !isCount(value.responses)) return null;
  return { day: value.day, sent: value.sent, responses: value.responses };
}

export function parseStats(value: unknown): Stats | null {
  if (!isJson(value)) return null;
  const sends = countRecord(value.sends) ?? {};
  const byOrigin = strictList(value.byOrigin, parseOriginStat);
  const byDay = strictList(value.byDay, parseDayStat);
  if (byOrigin === null || byDay === null) return null;
  const known: Partial<Record<SendStatus, number>> = {};
  for (const status of SEND_STATUSES) {
    if (status in sends) known[status] = sends[status];
  }
  return {
    sends: known,
    delivered: isCount(value.delivered) ? value.delivered : 0,
    read: isCount(value.read) ? value.read : 0,
    responses: isCount(value.responses) ? value.responses : 0,
    byOrigin,
    byDay,
    ...(isNumber(value.medianSecondsToRespond) ? { medianSecondsToRespond: value.medianSecondsToRespond } : {}),
  };
}

export function parseDistribution(value: unknown): Distribution | null {
  if (!isJson(value)) return null;
  return countRecord(value.counts) ?? {};
}

function kindRecord<K extends string>(values: readonly K[], value: unknown): Partial<Record<K, number>> {
  const record: Partial<Record<K, number>> = {};
  if (!isJson(value)) return record;
  for (const kind of values) {
    const n = value[kind];
    if (isCount(n)) record[kind] = n;
  }
  return record;
}

function boundsRecord(value: unknown): Partial<Record<FieldKind, [number, number]>> {
  const record: Partial<Record<FieldKind, [number, number]>> = {};
  if (!isJson(value)) return record;
  for (const kind of FIELD_KINDS) {
    const bounds = value[kind];
    if (Array.isArray(bounds) && bounds.length === 2 && isCount(bounds[0]) && isCount(bounds[1])) record[kind] = [bounds[0], bounds[1]];
  }
  return record;
}

export function parseLimits(value: unknown): Limits | null {
  if (!isJson(value)) return null;
  const count = (key: string) => (isCount(value[key]) ? (value[key] as number) : 0);
  return {
    labels: kindRecord<FieldKind>(FIELD_KINDS, value.labels),
    options: boundsRecord(value.options),
    displayText: kindRecord<DisplayKind>(DISPLAY_KINDS, value.displayText),
    help: count("help"),
    optionTitle: count("optionTitle"),
    optionDescription: count("optionDescription"),
    submitLabel: count("submitLabel"),
    componentsPerScreen: count("componentsPerScreen"),
    imagesPerScreen: count("imagesPerScreen"),
    linksPerScreen: count("linksPerScreen"),
    optInsPerScreen: count("optInsPerScreen"),
    pickersPerScreen: count("pickersPerScreen"),
    routeBranches: count("routeBranches"),
    uploads: count("uploads"),
    uploadSizeKb: count("uploadSizeKb"),
    imageBytes: count("imageBytes"),
    textInputMaxChars: count("textInputMaxChars"),
    textAreaMaxChars: count("textAreaMaxChars"),
    documentMimeTypes: stringList(value.documentMimeTypes),
  };
}

function parseBindingOption(value: unknown): BindingOption | null {
  if (!isJson(value) || !oneOf(BINDING_TARGETS, value.target)) return null;
  return { target: value.target, fieldKinds: knownList(FIELD_KINDS, value.fieldKinds) };
}

function parseCustomFieldOption(value: unknown): CustomFieldOption | null {
  if (!isJson(value) || !isText(value.key) || !oneOf(CUSTOM_FIELD_TYPES, value.type)) return null;
  return {
    key: value.key,
    label: isText(value.label) ? value.label : value.key,
    type: value.type,
    options: stringList(value.options),
    fieldKinds: knownList(FIELD_KINDS, value.fieldKinds),
  };
}

function parseStarter(value: unknown): Starter | null {
  if (!isJson(value) || !isText(value.key)) return null;
  const document = parseDocument(value.document);
  if (!document) return null;
  return {
    key: value.key,
    name: isString(value.name) ? value.name : value.key,
    description: isString(value.description) ? value.description : "",
    document,
  };
}

function lenientList<T>(value: unknown, parse: (item: unknown) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  return value.map(parse).filter((item): item is T => item !== null);
}

export function parseOptions(value: unknown): Options | null {
  if (!isJson(value)) return null;
  const limits = parseLimits(value.limits);
  if (!limits) return null;
  return {
    fieldKinds: knownList(FIELD_KINDS, value.fieldKinds),
    displayKinds: knownList(DISPLAY_KINDS, value.displayKinds),
    categories: knownList(CATEGORIES, value.categories),
    limits,
    bindings: lenientList(value.bindings, parseBindingOption),
    customFields: lenientList(value.customFields, parseCustomFieldOption),
    starters: lenientList(value.starters, parseStarter),
    flowJsonVersion: isString(value.flowJsonVersion) ? value.flowJsonVersion : "",
  };
}

export function parseCompiled(value: unknown): Json | null {
  return isJson(value) ? value : null;
}
