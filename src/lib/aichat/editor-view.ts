import type { ChatView, EditorView } from "./types";

export function isEditorView(view: ChatView | undefined): view is EditorView {
  return view?.surface === "studio" || view?.surface === "email_design";
}

export function editorProjectOf(view: ChatView | undefined): string | undefined {
  return isEditorView(view) ? view.projectId : undefined;
}
