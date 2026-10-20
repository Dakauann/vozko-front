"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  checkDocumentAction,
  compiledFormAction,
  deprecatePublicationAction,
  getFormAction,
  previewFormAction,
  publishFormAction,
  renameFormAction,
  saveDraftAction,
} from "@/app/actions/whatsapp-forms";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ArrowCounterClockwise, ArrowClockwise, ArrowLeft, CheckCircle, Code, DeviceMobile, PaperPlaneTilt, WarningCircle } from "@/components/icons";
import { useOwnedPhones, useRefreshForms } from "@/hooks/use-whatsapp-forms";
import { Link } from "@/i18n/routing";
import type { Json } from "@/lib/json/guards";
import { useStudioEditor } from "@/lib/studio/store";
import { blockSelection, createFormBuilderStore, readSelection, screenSelection } from "@/lib/whatsapp-forms/builder-store";
import { addScreen, createBlock, createScreen, insertBlock, locateBlock, moveBlock, moveScreen, type BlockSpec } from "@/lib/whatsapp-forms/document-edit";
import { createDraftSaver, type DraftSaveState } from "@/lib/whatsapp-forms/draft-saver";
import { problemsOf } from "@/lib/whatsapp-forms/errors";
import { formDetailHref } from "@/lib/whatsapp-forms/links";
import { indexProblems } from "@/lib/whatsapp-forms/problems";
import type { Document, FormDetail, Options, Outcome, Preview, Problem, Screen } from "@/lib/whatsapp-forms/types";
import { cn } from "@/lib/utils";

import { useFormError } from "../use-form-text";
import { CompiledJsonDialog, MetaPreviewDialog, type Loadable } from "./BuilderDialogs";
import { Inspector } from "./Inspector";
import { PhonePreview } from "./PhonePreview";
import { ProblemList } from "./ProblemList";
import { PublishPanel } from "./PublishPanel";
import { AddBlockMenu, ScreenOutline } from "./ScreenOutline";

const SAVE_DELAY_MS = 1000;
const CHECK_DELAY_MS = 600;

type Operation = (document: Document) => Document;

function editableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function FormBuilder({ detail: initial, options, canEdit, canPublish }: { detail: FormDetail; options: Options; canEdit: boolean; canPublish: boolean }) {
  const t = useTranslations("whatsappForms");
  const errorText = useFormError();
  const refresh = useRefreshForms();
  const phones = useOwnedPhones();
  const readOnly = !canEdit;
  const formId = initial.form.id;

  const [detail, setDetail] = useState(initial);
  const [store] = useState(() => createFormBuilderStore(initial.draft.document));
  const document = useStudioEditor(store, (state) => state.document);
  const revision = useStudioEditor(store, (state) => state.revision);
  const rawSelection = useStudioEditor(store, (state) => state.selection);
  const canUndo = useStudioEditor(store, (state) => state.canUndo);
  const canRedo = useStudioEditor(store, (state) => state.canRedo);
  const selection = readSelection(rawSelection);

  const [saveState, setSaveState] = useState<DraftSaveState>({ status: "saved", problems: initial.draft.problems ?? [] });
  const [savedRevision, setSavedRevision] = useState(0);
  const [checked, setChecked] = useState<Problem[]>(initial.draft.problems ?? []);
  const [publishProblems, setPublishProblems] = useState<Problem[]>([]);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [json, setJson] = useState<Loadable<Json> | null>(null);
  const [preview, setPreview] = useState<Loadable<Preview> | null>(null);
  const [name, setName] = useState(initial.form.name);
  const [viewedScreen, setViewedScreen] = useState(initial.draft.document.screens[0]?.key ?? "");

  const [saver] = useState(() =>
    createDraftSaver(initial.draft.id, {
      save: (doc, base) => saveDraftAction(formId, doc, base),
      onState: setSaveState,
      onSaved: (version) => setDetail((current) => ({ ...current, draft: version, form: { ...current.form, draftVersionId: version.id } })),
      onStale: (stale) => {
        toast.warning(t("builder.staleToast"));
        getFormAction(formId).then((answer) => {
          if (answer.error) {
            toast.error(errorText(answer.error));
            return;
          }
          store.getState().reset(answer.data.draft.document);
          stale.rebase(answer.data.draft.id);
          setDetail(answer.data);
          setSavedRevision(0);
          setSaveState({ status: "saved", problems: answer.data.draft.problems ?? [] });
        });
      },
    }),
  );

  const activeScreen = useMemo(() => {
    if (selection?.kind === "screen" && document.screens.some((screen) => screen.key === selection.key)) return selection.key;
    if (selection?.kind === "block") {
      const at = locateBlock(document, selection.key);
      if (at) return document.screens[at.screen].key;
    }
    return document.screens.some((screen) => screen.key === viewedScreen) ? viewedScreen : (document.screens[0]?.key ?? "");
  }, [document, selection, viewedScreen]);
  const screen = document.screens.find((candidate) => candidate.key === activeScreen) ?? null;

  const problems = publishProblems.length > 0 ? publishProblems : checked;
  const index = useMemo(() => indexProblems(problems), [problems]);

  useEffect(() => {
    if (readOnly || revision === savedRevision) return;
    const at = revision;
    const timer = setTimeout(() => {
      void saver.request(store.getState().document).then(() => setSavedRevision((current) => (store.getState().revision === at ? at : current)));
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [readOnly, revision, savedRevision, saver, store]);

  useEffect(() => {
    if (readOnly) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      checkDocumentAction(document, controller.signal).then((answer) => {
        if (answer.data) {
          setChecked(answer.data);
          setPublishProblems([]);
        }
      });
    }, CHECK_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [document, readOnly]);

  useEffect(() => {
    if (readOnly) return;
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || editableTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        store.getState().undo();
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        store.getState().redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [readOnly, store]);

  const apply = useCallback((operation: Operation, nextSelection?: string[]) => store.getState().apply(operation, nextSelection), [store]);
  const type = useCallback((group: string, operation: Operation) => {
    store.getState().applyAs(group, operation);
  }, [store]);
  const select = useCallback((ids: string[]) => store.getState().select(ids), [store]);

  const blockCopy = useCallback(
    () => ({ label: t("builder.defaults.label"), text: t("builder.defaults.text"), options: [t("builder.defaults.option", { n: 1 }), t("builder.defaults.option", { n: 2 })] }),
    [t],
  );

  const addBlock = (target: Screen, spec: BlockSpec, at?: number) => {
    const block = createBlock(spec, blockCopy());
    apply((doc) => insertBlock(doc, target.key, block, at), blockSelection(block.key));
  };

  const addNewScreen = () => {
    const created = createScreen({ title: t("builder.defaults.screenTitle"), submitLabel: t("builder.defaults.submitLabel") });
    apply((doc) => addScreen(doc, created), screenSelection(created.key));
  };

  const flush = async () => {
    if (readOnly || revision === savedRevision) return;
    const at = store.getState().revision;
    await saver.request(store.getState().document);
    setSavedRevision(at);
  };

  const jump = (problem: Problem) => {
    if (problem.block && locateBlock(document, problem.block)) select(blockSelection(problem.block));
    else if (problem.screen) select(screenSelection(problem.screen));
    setPanelOpen(false);
  };

  const publish = async () => {
    setPublishing(true);
    await flush();
    const answer = await publishFormAction(formId);
    setPublishing(false);
    if (answer.error) {
      const refused = problemsOf(answer.error);
      setPublishProblems(refused);
      toast.error(refused.length > 0 ? t("publish.invalid") : errorText(answer.error));
      return;
    }
    setOutcomes(answer.data.outcomes);
    setDetail(answer.data.form);
    setPublishProblems([]);
    void refresh(formId);
    const failed = answer.data.outcomes.filter((outcome) => outcome.status === "failed").length;
    if (failed === 0) toast.success(t("publish.done"));
    else toast.warning(t("publish.partial", { count: failed }));
  };

  const deprecate = async (metaWabaId: string) => {
    const answer = await deprecatePublicationAction(formId, metaWabaId);
    if (answer.error) {
      toast.error(errorText(answer.error));
      return;
    }
    toast.success(t("publish.deprecated"));
    const reloaded = await getFormAction(formId);
    if (reloaded.data) setDetail(reloaded.data);
    setOutcomes((current) => current.filter((outcome) => outcome.metaWabaId !== metaWabaId));
    void refresh(formId);
  };

  const openJson = async () => {
    setJson({ status: "loading" });
    await flush();
    const answer = await compiledFormAction(formId);
    setJson(answer.error ? { status: "failed", message: errorText(answer.error) } : { status: "ready", value: answer.data });
  };

  const openPreview = async () => {
    setPreview({ status: "loading" });
    await flush();
    const answer = await previewFormAction(formId);
    setPreview(answer.error ? { status: "failed", message: errorText(answer.error) } : { status: "ready", value: answer.data });
  };

  const rename = async () => {
    const next = name.trim();
    if (!next || next === detail.form.name) {
      setName(detail.form.name);
      return;
    }
    const answer = await renameFormAction(formId, { name: next, description: detail.form.description });
    if (answer.error) {
      toast.error(errorText(answer.error));
      setName(detail.form.name);
      return;
    }
    setDetail((current) => ({ ...current, form: answer.data }));
    void refresh(formId);
  };

  const dirty = revision !== savedRevision;
  const status = saveState.status === "stale" || saveState.status === "failed" || saveState.status === "saving" ? saveState.status : dirty ? "pending" : "saved";
  const statusText = t(`builder.save.${status}`);
  const detailHref = formDetailHref(formId);

  return (
    <div className="flex min-h-0 w-full flex-col gap-4">
      <header className="flex flex-wrap items-center gap-3 border-b border-border pb-3">
        <Link href={detailHref} className="legend inline-flex items-center gap-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
          {t("builder.back")}
        </Link>
        <div className="min-w-[12rem] max-w-sm flex-1">
          <ElevatedInput
            label={t("builder.name")}
            value={name}
            controlSize="sm"
            disabled={readOnly}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => void rename()}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
        </div>
        {!readOnly ? (
          <p role="status" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            {status === "saved" ? <CheckCircle className="h-3.5 w-3.5 text-healthy" weight="fill" /> : null}
            {status === "failed" || status === "stale" ? <WarningCircle className="h-3.5 w-3.5 text-destructive" weight="fill" /> : null}
            {statusText}
            {status === "failed" ? (
              <button type="button" onClick={() => void saver.retry()} className="ml-1 font-medium text-foreground underline underline-offset-2">
                {t("builder.save.retry")}
              </button>
            ) : null}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">{t("builder.readOnly")}</p>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {!readOnly ? (
            <>
              <Button variant="ghost" size="sm" title="" aria-label={t("builder.undo")} icon={<ArrowCounterClockwise className="h-4 w-4" />} iconVisible disabled={!canUndo} onClick={() => store.getState().undo()} />
              <Button variant="ghost" size="sm" title="" aria-label={t("builder.redo")} icon={<ArrowClockwise className="h-4 w-4" />} iconVisible disabled={!canRedo} onClick={() => store.getState().redo()} />
            </>
          ) : null}
          <Button variant="secondary" size="sm" title={t("builder.viewJson")} icon={<Code className="h-4 w-4" />} iconVisible iconSide="left" onClick={() => void openJson()} />
          {!readOnly ? (
            <Button variant="secondary" size="sm" title={t("builder.metaPreview")} icon={<DeviceMobile className="h-4 w-4" />} iconVisible iconSide="left" onClick={() => void openPreview()} />
          ) : null}
          <Button variant="primary" size="sm" title={t("builder.publish")} icon={<PaperPlaneTilt className="h-4 w-4" weight="fill" />} iconVisible iconSide="left" onClick={() => setPanelOpen(true)} />
        </div>
      </header>

      <div className="grid min-h-0 gap-4 lg:grid-cols-[280px_minmax(0,1fr)_340px]">
        <div className="min-w-0 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto">
          <ScreenOutline
            document={document}
            activeScreen={activeScreen}
            selectedBlock={selection?.kind === "block" ? selection.key : null}
            problems={index}
            fieldKinds={options.fieldKinds}
            displayKinds={options.displayKinds}
            readOnly={readOnly}
            onSelectScreen={(key) => {
              setViewedScreen(key);
              select(screenSelection(key));
            }}
            onSelectBlock={(key) => select(blockSelection(key))}
            onMoveScreen={(from, to) => apply((doc) => moveScreen(doc, from, to))}
            onMoveBlock={(target, from, to) => {
              const block = target.blocks[from];
              if (block) apply((doc) => moveBlock(doc, block.key, target.key, to));
            }}
            onAddScreen={addNewScreen}
            onAddBlock={(target, spec) => addBlock(target, spec)}
          />
        </div>

        <div className="min-w-0 space-y-4">
          {document.screens.length > 1 ? (
            <div role="tablist" aria-label={t("builder.screens")} className="flex flex-wrap justify-center gap-1">
              {document.screens.map((candidate, position) => (
                <button
                  key={candidate.key}
                  type="button"
                  role="tab"
                  aria-selected={candidate.key === activeScreen}
                  onClick={() => {
                    setViewedScreen(candidate.key);
                    select(screenSelection(candidate.key));
                  }}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    candidate.key === activeScreen ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {position + 1}
                </button>
              ))}
            </div>
          ) : null}
          {screen ? (
            <PhonePreview
              document={document}
              screen={screen}
              selectedBlock={selection?.kind === "block" ? selection.key : null}
              flagged={index.flaggedBlocks}
              onSelectBlock={(key) => select(blockSelection(key))}
              onInsertAt={readOnly ? undefined : (at) => addBlock(screen, { field: "short_text" }, at)}
            />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">{t("builder.noScreens")}</p>
          )}
          {screen && !readOnly ? (
            <div className="flex justify-center">
              <AddBlockMenu fieldKinds={options.fieldKinds} displayKinds={options.displayKinds} onAdd={(spec) => addBlock(screen, spec)} label={t("builder.addBlock")} compact />
            </div>
          ) : null}
          <div className="rounded-[--radius] border border-border bg-card p-3">
            <ProblemList document={document} problems={problems} onJump={jump} />
          </div>
        </div>

        <div className="min-w-0 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto">
          <Inspector document={document} selection={selection} options={options} problems={index} readOnly={readOnly} onApply={apply} onType={type} />
        </div>
      </div>

      <PublishPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        detail={detail}
        outcomes={outcomes}
        phones={phones.data ?? []}
        problems={publishProblems}
        publishing={publishing}
        canPublish={canPublish}
        onPublish={() => void publish()}
        onDeprecate={deprecate}
        onJump={jump}
      />
      {json ? <CompiledJsonDialog state={json} onClose={() => setJson(null)} /> : null}
      {preview ? <MetaPreviewDialog state={preview} onClose={() => setPreview(null)} /> : null}
    </div>
  );
}
