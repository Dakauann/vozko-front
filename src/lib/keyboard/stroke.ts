export interface KeyStroke {
  key: string;
  code?: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  target?: EventTarget | null;
}

const EDITABLE_INPUTS = new Set(["text", "search", "email", "number", "password", "tel", "url", "date", "time", "datetime-local", "month", "week", ""]);

export function isEditableTarget(target: EventTarget | null | undefined): boolean {
  if (!target || typeof (target as HTMLElement).tagName !== "string") return false;
  const element = target as HTMLElement;
  if (element.isContentEditable) return true;
  const tag = element.tagName.toLowerCase();
  if (tag === "textarea" || tag === "select") return true;
  if (tag === "input") return EDITABLE_INPUTS.has(((element as HTMLInputElement).type ?? "").toLowerCase());
  return element.closest?.("[contenteditable=''],[contenteditable='true']") != null;
}

export function hasCommandModifier(stroke: KeyStroke): boolean {
  return stroke.ctrlKey || stroke.metaKey;
}

export function strokeKey(stroke: KeyStroke): string {
  return stroke.key.length === 1 ? stroke.key.toLowerCase() : stroke.key;
}

const ARROW_OWNER_ROLES = new Set(["slider", "spinbutton", "menu", "menuitem", "menuitemcheckbox", "menuitemradio", "option", "listbox", "radio", "radiogroup", "tab", "tablist", "combobox"]);

export function capturesArrowKeys(target: EventTarget | null | undefined): boolean {
  if (!target || typeof (target as HTMLElement).getAttribute !== "function") return false;
  if ((target as HTMLElement).tagName === "INPUT" && (target as HTMLInputElement).type === "range") return true;
  const owner = (target as HTMLElement).closest?.("[role]");
  return owner != null && ARROW_OWNER_ROLES.has(owner.getAttribute("role") ?? "");
}

const OVERLAY_ROLES = "[role=dialog],[role=menu],[role=alertdialog]";

export function closestOverlay(target: EventTarget | null | undefined): Element | null {
  return typeof (target as HTMLElement | null)?.closest === "function" ? (target as HTMLElement).closest(OVERLAY_ROLES) : null;
}

export function isInsideOverlay(target: EventTarget | null | undefined): boolean {
  return closestOverlay(target) !== null;
}

const ENTER_OWNERS =
  "button, a[href], summary, select, [role=button], [role=link], [role=menuitem], [role=menuitemcheckbox], [role=menuitemradio], [role=option], [role=tab], [role=checkbox], [role=switch], [role=combobox]";

export function activatesOnEnter(target: EventTarget | null | undefined): boolean {
  return typeof (target as HTMLElement | null)?.closest === "function" && (target as HTMLElement).closest(ENTER_OWNERS) != null;
}

export function bindKeymap<A>(target: Pick<Window, "addEventListener" | "removeEventListener">, resolve: (stroke: KeyStroke) => A | null, handle: (action: A) => void): () => void {
  const listener = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing) return;
    const action = resolve(event);
    if (action === null) return;
    event.preventDefault();
    handle(action);
  };
  target.addEventListener("keydown", listener as EventListener);
  return () => target.removeEventListener("keydown", listener as EventListener);
}
