"use client";

import { useTranslations } from "next-intl";

import { CampaignMediaPicker } from "@/components/campaigns/CampaignMediaPicker";
import Button from "@/components/elevated-design/button";
import { Checkbox } from "@/components/elevated-design/elevated-checkbox";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import { ExplainerHint } from "@/components/explainers/ExplainerHint";
import { Plus, Trash, X } from "@/components/icons";
import { blockSelection, screenSelection, typingGroup, type BuilderSelection } from "@/lib/whatsapp-forms/builder-store";
import {
  addOption,
  changeFieldKind,
  createOption,
  fieldsBefore,
  findBlock,
  hasOptions,
  isConditionSource,
  isSingleChoice,
  locateBlock,
  moveBlock,
  moveOption,
  removeBlock,
  removeOption,
  removeScreen,
  screenIndex,
  screensAfter,
  setBranch,
  setBranching,
  setNextScreen,
  setVisibleIf,
  updateDisplay,
  updateField,
  updateOption,
  updateScreen,
  type BlockCopy,
} from "@/lib/whatsapp-forms/document-edit";
import { groupMimeTypes, groupState, toggleGroup } from "@/lib/whatsapp-forms/mime-groups";
import { propertyProblems, type ProblemIndex } from "@/lib/whatsapp-forms/problems";
import { CATEGORIES, type Binding, type Block, type Category, type Document, type Field, type Options, type Problem, type Screen } from "@/lib/whatsapp-forms/types";
import { cn } from "@/lib/utils";

import { bindingKey, useProblemText } from "../use-form-text";
import { CountedInput, CountedTextarea, InspectorSection, ProblemLines } from "./InspectorFields";
import { SortableList } from "./SortableList";

type Operation = (document: Document) => Document;

export interface InspectorProps {
  document: Document;
  selection: BuilderSelection;
  options: Options;
  problems: ProblemIndex;
  readOnly: boolean;
  onApply: (operation: Operation, nextSelection?: string[]) => void;
  onType: (group: string, operation: Operation) => void;
}

const NONE = "__none__";
const END = "__end__";
const CUSTOM = "custom_field:";

function useCopy(): (count?: number) => BlockCopy {
  const t = useTranslations("whatsappForms.builder.defaults");
  return () => ({ label: t("label"), text: t("text"), options: [t("option", { n: 1 }), t("option", { n: 2 })] });
}

function useMessages(problems: ProblemIndex) {
  const text = useProblemText();
  return (target: { block?: string; screen?: string }, property: string) => propertyProblems(problems, target, property).map(text);
}

function firstMessage(messages: string[]): string | undefined {
  return messages[0];
}

export function bindingValue(binding: Binding | undefined): string {
  if (!binding) return NONE;
  return binding.target === "custom_field" ? CUSTOM + (binding.customFieldKey ?? "") : binding.target;
}

export function bindingFromValue(value: string): Binding | undefined {
  if (value === NONE) return undefined;
  if (value.startsWith(CUSTOM)) return { target: "custom_field", customFieldKey: value.slice(CUSTOM.length) };
  return { target: value as Binding["target"] };
}

export function bindingChoices(options: Options, field: Field): { value: string; label: string; custom: boolean }[] {
  const lead = options.bindings
    .filter((binding) => binding.target !== "custom_field" && binding.fieldKinds.includes(field.kind))
    .map((binding) => ({ value: binding.target as string, label: binding.target as string, custom: false }));
  const custom = options.customFields
    .filter((definition) => definition.fieldKinds.includes(field.kind))
    .map((definition) => ({ value: CUSTOM + definition.key, label: definition.label, custom: true }));
  return [...lead, ...custom];
}

function FieldInspector({ block, field, props }: { block: Block; field: Field; props: InspectorProps }) {
  const t = useTranslations("whatsappForms");
  const copy = useCopy();
  const messages = useMessages(props.problems);
  const { options, readOnly, onApply, onType } = props;
  const limits = options.limits;
  const target = { block: block.key };
  const type = (property: string, operation: Operation) => onType(typingGroup(block.key, property), operation);
  const set = (patch: Partial<Omit<Field, "key" | "kind" | "options">>) => onApply((doc) => updateField(doc, block.key, patch));
  const bounds = limits.options[field.kind];
  const choices = bindingChoices(options, field);
  const textKind = field.kind === "short_text" || field.kind === "email" || field.kind === "phone" || field.kind === "long_text";
  const numberField = (property: "min" | "max", label: string) => (
    <CountedInput
      label={label}
      type="number"
      value={field[property] === undefined ? "" : String(field[property])}
      disabled={readOnly}
      error={firstMessage(messages(target, property))}
      onChange={(value) => type(property, (doc) => updateField(doc, block.key, { [property]: value === "" ? undefined : Number(value) }))}
    />
  );
  const dateField = (property: "minDate" | "maxDate", label: string) => (
    <CountedInput
      label={label}
      type="date"
      value={field[property] ?? ""}
      disabled={readOnly}
      error={firstMessage(messages(target, property))}
      onChange={(value) => set({ [property]: value || undefined })}
    />
  );

  return (
    <div className="space-y-4">
      <InspectorSection title={t("builder.inspector.question")}>
        <ElevatedSelect
          label={t("builder.inspector.kind")}
          value={field.kind}
          disabled={readOnly}
          onValueChange={(kind) => onApply((doc) => changeFieldKind(doc, block.key, kind as Field["kind"], copy()))}
        >
          {options.fieldKinds.map((kind) => (
            <ElevatedSelectItem key={kind} value={kind}>
              {t(`fieldKinds.${kind}`)}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
        <CountedTextarea
          label={t("builder.inspector.prompt")}
          value={field.question ?? ""}
          disabled={readOnly}
          error={firstMessage(messages(target, "question"))}
          onChange={(value) => type("question", (doc) => updateField(doc, block.key, { question: value }))}
        />
        <CountedInput
          label={t("builder.inspector.label")}
          value={field.label}
          limit={limits.labels[field.kind]}
          disabled={readOnly}
          error={firstMessage(messages(target, "label"))}
          onChange={(value) => type("label", (doc) => updateField(doc, block.key, { label: value }))}
        />
        <CountedInput
          label={t("builder.inspector.help")}
          value={field.help ?? ""}
          limit={limits.help}
          disabled={readOnly}
          error={firstMessage(messages(target, "help"))}
          onChange={(value) => type("help", (doc) => updateField(doc, block.key, { help: value }))}
        />
        <ElevatedSwitch
          label={t("builder.inspector.required")}
          checked={field.required}
          disabled={readOnly}
          onCheckedChange={(required) => set({ required })}
          explainer={<ExplainerHint id="forms.required" align="end" />}
        />
        <ElevatedSwitch
          label={t("builder.inspector.sensitive")}
          checked={field.sensitive}
          disabled={readOnly}
          onCheckedChange={(sensitive) => set({ sensitive })}
          explainer={<ExplainerHint id="forms.sensitive" align="end" />}
        />
        <ProblemLines messages={[...messages(target, "required"), ...messages(target, "sensitive"), ...messages(target, "")]} />
      </InspectorSection>

      {hasOptions(field.kind) ? (
        <InspectorSection
          title={t("builder.inspector.options")}
          aside={bounds ? <span className="text-2xs tabular-nums text-muted-foreground">{t("builder.inspector.optionCount", { count: field.options?.length ?? 0, max: bounds[1] })}</span> : null}
        >
          <SortableList
            items={field.options ?? []}
            itemKey={(option) => option.id}
            disabled={readOnly}
            onMove={(from, to) => onApply((doc) => moveOption(doc, block.key, from, to))}
            handleLabel={(option) => t("builder.dragOption", { title: option.title })}
            className="space-y-2"
            renderItem={(option, _index, handle) => (
              <div className="flex items-start gap-1.5">
                <span className="pt-2">{handle}</span>
                <div className="min-w-0 flex-1 space-y-1">
                  <CountedInput
                    label={t("builder.inspector.optionTitle")}
                    value={option.title}
                    limit={limits.optionTitle}
                    disabled={readOnly}
                    onChange={(value) => onType(typingGroup(option.id, "title"), (doc) => updateOption(doc, block.key, option.id, { title: value }))}
                  />
                  {field.kind !== "multi_choice_chips" ? (
                    <CountedInput
                      label={t("builder.inspector.optionDescription")}
                      value={option.description ?? ""}
                      limit={limits.optionDescription}
                      disabled={readOnly}
                      onChange={(value) => onType(typingGroup(option.id, "description"), (doc) => updateOption(doc, block.key, option.id, { description: value }))}
                    />
                  ) : null}
                </div>
                {!readOnly ? (
                  <button
                    type="button"
                    aria-label={t("builder.inspector.removeOption", { title: option.title })}
                    onClick={() => onApply((doc) => removeOption(doc, block.key, option.id))}
                    className="mt-2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            )}
          />
          <ProblemLines messages={messages(target, "options")} />
          {!readOnly ? (
            <Button
              variant="ghost"
              size="sm"
              title={t("builder.inspector.addOption")}
              icon={<Plus className="h-3.5 w-3.5" weight="bold" />}
              iconVisible
              iconSide="left"
              onClick={() => onApply((doc) => addOption(doc, block.key, createOption(t("builder.defaults.option", { n: (field.options?.length ?? 0) + 1 }))))}
            />
          ) : null}
        </InspectorSection>
      ) : null}

      {textKind || field.kind === "number" || field.kind === "photo" || field.kind === "document" ? (
        <InspectorSection title={t("builder.inspector.limits")}>
          <div className="grid grid-cols-2 gap-2">
            {numberField("min", t(textKind ? "builder.inspector.minChars" : field.kind === "number" ? "builder.inspector.minValue" : "builder.inspector.minFiles"))}
            {numberField("max", t(textKind ? "builder.inspector.maxChars" : field.kind === "number" ? "builder.inspector.maxValue" : "builder.inspector.maxFiles"))}
          </div>
        </InspectorSection>
      ) : null}

      {field.kind === "date" || field.kind === "date_range" ? (
        <InspectorSection title={t("builder.inspector.limits")}>
          <div className="grid grid-cols-2 gap-2">
            {dateField("minDate", t("builder.inspector.minDate"))}
            {dateField("maxDate", t("builder.inspector.maxDate"))}
          </div>
        </InspectorSection>
      ) : null}

      {field.kind === "opt_in" ? (
        <InspectorSection title={t("builder.inspector.terms")}>
          <CountedInput
            label={t("builder.inspector.termsUrl")}
            value={field.termsUrl ?? ""}
            disabled={readOnly}
            error={firstMessage(messages(target, "termsUrl"))}
            onChange={(value) => type("termsUrl", (doc) => updateField(doc, block.key, { termsUrl: value }))}
          />
        </InspectorSection>
      ) : null}

      {field.kind === "document" ? <AcceptedTypes block={block} field={field} props={props} /> : null}

      {field.kind === "short_text" || field.kind === "number" ? (
        <details className="group border-t border-border pt-3" open={field.pattern ? true : undefined}>
          <summary className="w-fit cursor-pointer rounded-sm text-xs font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {t("builder.inspector.advanced")}
          </summary>
          <div className="mt-2.5 space-y-1">
            <CountedInput
              label={t("builder.inspector.pattern")}
              value={field.pattern ?? ""}
              disabled={readOnly}
              error={firstMessage(messages(target, "pattern"))}
              onChange={(value) => type("pattern", (doc) => updateField(doc, block.key, { pattern: value }))}
            />
            <p className="px-1 text-xs text-muted-foreground">{t("builder.inspector.patternHint")}</p>
          </div>
        </details>
      ) : null}

      <InspectorSection title={t("builder.inspector.binding")}>
        <ElevatedSelect
          label={t("builder.inspector.binding")}
          value={bindingValue(field.binding)}
          disabled={readOnly}
          onValueChange={(value) => onApply((doc) => updateField(doc, block.key, { binding: bindingFromValue(value) }))}
        >
          <ElevatedSelectItem value={NONE}>{t("builder.inspector.noBinding")}</ElevatedSelectItem>
          {choices.map((choice) => (
            <ElevatedSelectItem key={choice.value} value={choice.value}>
              {choice.custom ? t("builder.inspector.customField", { label: choice.label }) : t(`bindingTargets.${bindingKey(choice.value as Binding["target"])}`)}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
        <ProblemLines messages={messages(target, "binding")} />
      </InspectorSection>

      <VisibilityEditor block={block} props={props} />
      <BlockActions block={block} props={props} />
    </div>
  );
}

function AcceptedTypes({ block, field, props }: { block: Block; field: Field; props: InspectorProps }) {
  const t = useTranslations("whatsappForms.builder.inspector");
  const messages = useMessages(props.problems);
  const { options, readOnly, onApply } = props;
  const allowed = options.limits.documentMimeTypes;
  const groups = groupMimeTypes(allowed);
  if (groups.length === 0) return null;
  const toggle = (types: string[], on: boolean) => {
    const next = toggleGroup(field.mimeTypes, types, on, allowed);
    onApply((doc) => updateField(doc, block.key, { mimeTypes: next.length > 0 ? next : undefined }));
  };
  return (
    <InspectorSection title={t("acceptedTypes")}>
      <p className="text-xs text-muted-foreground">{t("acceptedTypesHint")}</p>
      <ul className="grid grid-cols-2 gap-2">
        {groups.map(({ group, types }) => {
          const state = groupState(field.mimeTypes, types);
          const id = `${block.key}-mime-${group}`;
          return (
            <li key={group} className="flex items-center gap-2">
              <Checkbox
                id={id}
                checked={state === "all" ? true : state === "some" ? "indeterminate" : false}
                disabled={readOnly}
                onCheckedChange={() => toggle(types, state !== "all")}
              />
              <label htmlFor={id} className="cursor-pointer text-sm text-foreground">
                {t(`mimeGroups.${group}`)}
              </label>
            </li>
          );
        })}
      </ul>
      <ProblemLines messages={messages({ block: block.key }, "mimeTypes")} />
    </InspectorSection>
  );
}

function VisibilityEditor({ block, props }: { block: Block; props: InspectorProps }) {
  const t = useTranslations("whatsappForms.builder.inspector");
  const messages = useMessages(props.problems);
  const { document, readOnly, onApply } = props;
  const sources = fieldsBefore(document, block.key).filter((ref) => isConditionSource(ref.field.kind));
  const condition = block.visibleIf;
  const source = sources.find((ref) => ref.field.key === condition?.fieldKey)?.field;
  const values = source
    ? source.kind === "opt_in"
      ? [
          { value: "true", label: t("checked") },
          { value: "false", label: t("unchecked") },
        ]
      : (source.options ?? []).map((option) => ({ value: option.id, label: option.title }))
    : [];

  const pickField = (fieldKey: string) => {
    if (fieldKey === NONE) {
      onApply((doc) => setVisibleIf(doc, block.key, null));
      return;
    }
    const picked = sources.find((ref) => ref.field.key === fieldKey)?.field;
    const first = picked?.kind === "opt_in" ? "true" : (picked?.options?.[0]?.id ?? "");
    onApply((doc) => setVisibleIf(doc, block.key, { fieldKey, value: first }));
  };

  return (
    <InspectorSection title={t("visibleIf")}>
      <ElevatedSelect label={t("visibleField")} value={condition?.fieldKey ?? NONE} disabled={readOnly || sources.length === 0} onValueChange={pickField}>
        <ElevatedSelectItem value={NONE}>{t("alwaysVisible")}</ElevatedSelectItem>
        {sources.map((ref) => (
          <ElevatedSelectItem key={ref.field.key} value={ref.field.key}>
            {ref.field.label || ref.field.key}
          </ElevatedSelectItem>
        ))}
      </ElevatedSelect>
      {sources.length === 0 ? <p className="text-xs text-muted-foreground">{t("noVisibilitySource")}</p> : null}
      {condition ? (
        <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-2">
          <ElevatedSelect
            label={t("visibleOperator")}
            value={condition.negate ? "not" : "is"}
            disabled={readOnly}
            onValueChange={(value) => onApply((doc) => setVisibleIf(doc, block.key, { fieldKey: condition.fieldKey, value: condition.value, ...(value === "not" ? { negate: true } : {}) }))}
          >
            <ElevatedSelectItem value="is">{t("is")}</ElevatedSelectItem>
            <ElevatedSelectItem value="not">{t("isNot")}</ElevatedSelectItem>
          </ElevatedSelect>
          <ElevatedSelect
            label={t("visibleValue")}
            value={condition.value || undefined}
            disabled={readOnly}
            onValueChange={(value) => onApply((doc) => setVisibleIf(doc, block.key, { ...condition, value }))}
          >
            {values.map((item) => (
              <ElevatedSelectItem key={item.value} value={item.value}>
                {item.label}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>
        </div>
      ) : null}
      <ProblemLines messages={messages({ block: block.key }, "visibleIf")} />
    </InspectorSection>
  );
}

function BlockActions({ block, props }: { block: Block; props: InspectorProps }) {
  const t = useTranslations("whatsappForms.builder.inspector");
  const { document, readOnly, onApply } = props;
  const at = locateBlock(document, block.key);
  if (readOnly || !at) return null;
  const current = document.screens[at.screen];
  return (
    <InspectorSection title={t("blockActions")}>
      {document.screens.length > 1 ? (
        <ElevatedSelect
          label={t("moveTo")}
          value={current.key}
          onValueChange={(screenKey) => onApply((doc) => moveBlock(doc, block.key, screenKey, doc.screens[screenIndex(doc, screenKey)]?.blocks.length ?? 0), blockSelection(block.key))}
        >
          {document.screens.map((screen, index) => (
            <ElevatedSelectItem key={screen.key} value={screen.key}>
              {t("screenOption", { n: index + 1, title: screen.title || screen.key })}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
      ) : null}
      <Button
        variant="destructive"
        size="sm"
        title={t("deleteBlock")}
        icon={<Trash className="h-3.5 w-3.5" />}
        iconVisible
        iconSide="left"
        onClick={() => onApply((doc) => removeBlock(doc, block.key), screenSelection(current.key))}
      />
    </InspectorSection>
  );
}

function DisplayInspector({ block, props }: { block: Block; props: InspectorProps }) {
  const t = useTranslations("whatsappForms");
  const messages = useMessages(props.problems);
  const display = block.display;
  if (!display) return null;
  const { options, readOnly, onApply, onType } = props;
  const target = { block: block.key };
  const limit = options.limits.displayText[display.kind];
  return (
    <div className="space-y-4">
      <InspectorSection title={t(`displayKinds.${display.kind}`)}>
        {display.kind === "image" ? (
          <CampaignMediaPicker
            kind="image"
            accept="image/jpeg,image/png"
            mediaId={display.mediaId}
            disabled={readOnly}
            onChange={(next) => onApply((doc) => updateDisplay(doc, block.key, { mediaId: next.mediaId }))}
            labels={{
              upload: t("builder.inspector.imageUpload"),
              uploading: t("builder.inspector.uploading"),
              remove: t("builder.inspector.removeImage"),
              failed: t("builder.inspector.uploadFailed"),
            }}
          />
        ) : display.kind === "heading" || display.kind === "subheading" || display.kind === "link" ? (
          <CountedInput
            label={t("builder.inspector.text")}
            value={display.text ?? ""}
            limit={limit}
            disabled={readOnly}
            error={firstMessage(messages(target, "text"))}
            onChange={(value) => onType(typingGroup(block.key, "text"), (doc) => updateDisplay(doc, block.key, { text: value }))}
          />
        ) : (
          <CountedTextarea
            label={t("builder.inspector.text")}
            value={display.text ?? ""}
            limit={limit}
            disabled={readOnly}
            error={firstMessage(messages(target, "text"))}
            onChange={(value) => onType(typingGroup(block.key, "text"), (doc) => updateDisplay(doc, block.key, { text: value }))}
          />
        )}
        {display.kind === "link" ? (
          <CountedInput
            label={t("builder.inspector.url")}
            value={display.url ?? ""}
            disabled={readOnly}
            error={firstMessage(messages(target, "url"))}
            onChange={(value) => onType(typingGroup(block.key, "url"), (doc) => updateDisplay(doc, block.key, { url: value }))}
          />
        ) : null}
        <ProblemLines messages={[...messages(target, "mediaId"), ...messages(target, "")]} />
      </InspectorSection>
      <VisibilityEditor block={block} props={props} />
      <BlockActions block={block} props={props} />
    </div>
  );
}

function ScreenInspector({ screen, props }: { screen: Screen; props: InspectorProps }) {
  const t = useTranslations("whatsappForms.builder.inspector");
  const messages = useMessages(props.problems);
  const { document, options, readOnly, onApply, onType } = props;
  const target = { screen: screen.key };
  const later = screensAfter(document, screen.key);
  const branchFields = screen.blocks.flatMap((block) => (block.field && block.field.required && isSingleChoice(block.field.kind) ? [block.field] : []));
  const branchField = branchFields.find((field) => field.key === screen.route.branchOn);
  const screenLabel = (target: Screen) => t("screenOption", { n: screenIndex(document, target.key) + 1, title: target.title || target.key });
  const routeProblems = messages(target, "route");

  return (
    <div className="space-y-4">
      <InspectorSection title={t("screen")}>
        <CountedInput
          label={t("screenTitle")}
          value={screen.title}
          disabled={readOnly}
          error={firstMessage(messages(target, "title"))}
          onChange={(value) => onType(typingGroup(screen.key, "title"), (doc) => updateScreen(doc, screen.key, { title: value }))}
        />
        <CountedInput
          label={t("submitLabel")}
          value={screen.submitLabel}
          limit={options.limits.submitLabel}
          disabled={readOnly}
          error={firstMessage(messages(target, "submitLabel"))}
          onChange={(value) => onType(typingGroup(screen.key, "submitLabel"), (doc) => updateScreen(doc, screen.key, { submitLabel: value }))}
        />
      </InspectorSection>

      <InspectorSection title={t("route")}>
        <ElevatedSelect
          label={branchField ? t("branchDefault") : t("next")}
          value={screen.route.next ?? END}
          disabled={readOnly}
          onValueChange={(value) => onApply((doc) => setNextScreen(doc, screen.key, value === END ? null : value))}
        >
          <ElevatedSelectItem value={END}>{t("end")}</ElevatedSelectItem>
          {later.map((candidate) => (
            <ElevatedSelectItem key={candidate.key} value={candidate.key}>
              {screenLabel(candidate)}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
        <ElevatedSelect
          label={t("branchOn")}
          value={screen.route.branchOn ?? NONE}
          disabled={readOnly || (branchFields.length === 0 && !screen.route.branchOn)}
          onValueChange={(value) => onApply((doc) => setBranching(doc, screen.key, value === NONE ? null : value))}
        >
          <ElevatedSelectItem value={NONE}>{t("noBranch")}</ElevatedSelectItem>
          {branchFields.map((field) => (
            <ElevatedSelectItem key={field.key} value={field.key}>
              {field.label || field.key}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
        {branchFields.length === 0 ? <p className="text-xs text-muted-foreground">{t("branchHint")}</p> : null}
        {branchField ? (
          <ul className="space-y-2">
            {(branchField.options ?? []).map((option) => {
              const branch = screen.route.branches?.find((candidate) => candidate.optionId === option.id);
              return (
                <li key={option.id}>
                  <ElevatedSelect
                    label={t("branchTo", { option: option.title })}
                    value={branch?.next ?? NONE}
                    disabled={readOnly}
                    onValueChange={(value) => onApply((doc) => setBranch(doc, screen.key, option.id, value === NONE ? null : value))}
                  >
                    <ElevatedSelectItem value={NONE}>{t("sameAsDefault")}</ElevatedSelectItem>
                    {later.map((candidate) => (
                      <ElevatedSelectItem key={candidate.key} value={candidate.key}>
                        {screenLabel(candidate)}
                      </ElevatedSelectItem>
                    ))}
                  </ElevatedSelect>
                </li>
              );
            })}
          </ul>
        ) : null}
        <ProblemLines messages={[...routeProblems, ...messages(target, "branches"), ...messages(target, "branchOn"), ...messages(target, "")]} />
      </InspectorSection>

      {!readOnly ? (
        <InspectorSection title={t("screenActions")}>
          <Button
            variant="destructive"
            size="sm"
            title={t("deleteScreen")}
            icon={<Trash className="h-3.5 w-3.5" />}
            iconVisible
            iconSide="left"
            disabled={document.screens.length <= 1}
            onClick={() => {
              const index = screenIndex(document, screen.key);
              const fallback = document.screens[index === 0 ? 1 : index - 1];
              onApply((doc) => removeScreen(doc, screen.key), fallback ? screenSelection(fallback.key) : []);
            }}
          />
        </InspectorSection>
      ) : null}
    </div>
  );
}

function FormSettings({ props }: { props: InspectorProps }) {
  const t = useTranslations("whatsappForms");
  const messages = useMessages(props.problems);
  const { document, options, readOnly, onApply } = props;
  const known = options.categories.length > 0 ? options.categories : CATEGORIES;
  const toggle = (category: Category) =>
    onApply((doc) => ({
      ...doc,
      categories: doc.categories.includes(category) ? doc.categories.filter((item) => item !== category) : [...doc.categories, category],
    }));
  const general: Problem[] = props.problems.general;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("builder.inspector.emptyText")}</p>
      <InspectorSection title={t("builder.inspector.categories")}>
        <p className="text-xs text-muted-foreground">{t("builder.inspector.categoriesHint")}</p>
        <div className="flex flex-wrap gap-1.5">
          {known.map((category) => {
            const picked = document.categories.includes(category);
            return (
              <button
                key={category}
                type="button"
                aria-pressed={picked}
                disabled={readOnly}
                onClick={() => toggle(category)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                  picked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted",
                )}
              >
                {t(`categories.${category}`)}
              </button>
            );
          })}
        </div>
        <ProblemLines messages={messages({}, "categories")} />
      </InspectorSection>
      {general.length > 0 ? <ProblemLines messages={messages({}, "")} /> : null}
    </div>
  );
}

export function Inspector(props: InspectorProps) {
  const t = useTranslations("whatsappForms.builder.inspector");
  const { selection, document } = props;
  let body;
  if (selection?.kind === "block") {
    const block = findBlock(document, selection.key);
    body = block?.field ? <FieldInspector block={block} field={block.field} props={props} /> : block?.display ? <DisplayInspector block={block} props={props} /> : null;
  } else if (selection?.kind === "screen") {
    const screen = document.screens.find((candidate) => candidate.key === selection.key);
    body = screen ? <ScreenInspector screen={screen} props={props} /> : null;
  }
  return (
    <aside aria-label={t("title")} className="space-y-3">
      <h2 className="text-xs font-semibold text-muted-foreground">{t("title")}</h2>
      {body ?? <FormSettings props={props} />}
    </aside>
  );
}
