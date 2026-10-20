import { matchesChord, type Platform } from "./chord";
import { closestOverlay, isEditableTarget, type KeyStroke } from "./stroke";

export const SHORTCUT_SCOPES = ["global", "inbox", "thread", "composer"] as const;

export type ShortcutScope = (typeof SHORTCUT_SCOPES)[number];

export const CRM_SHORTCUT_NAMESPACE = "crmShortcuts";

export const SHORTCUT_SCOPE_ATTRIBUTE = "data-shortcut-scope";

export interface ShortcutBinding {
  id: string;
  keys: readonly string[];
  scope: ShortcutScope;
  labelKey: string;
  whileTyping?: boolean;
}

export const CRM_BINDINGS = [
  { id: "palette.open", keys: ["Mod+K"], scope: "global", labelKey: "bindings.paletteOpen", whileTyping: true },
  { id: "help.open", keys: ["?"], scope: "global", labelKey: "bindings.helpOpen" },
  { id: "search.focus", keys: ["/"], scope: "global", labelKey: "bindings.searchFocus" },
  { id: "inbox.next", keys: ["j", "ArrowDown"], scope: "inbox", labelKey: "bindings.inboxNext" },
  { id: "inbox.previous", keys: ["k", "ArrowUp"], scope: "inbox", labelKey: "bindings.inboxPrevious" },
  { id: "inbox.open", keys: ["Enter"], scope: "inbox", labelKey: "bindings.inboxOpen" },
  { id: "inbox.reply", keys: ["r"], scope: "inbox", labelKey: "bindings.inboxReply" },
  { id: "inbox.pin", keys: ["p"], scope: "inbox", labelKey: "bindings.inboxPin" },
  { id: "inbox.markUnread", keys: ["u"], scope: "inbox", labelKey: "bindings.inboxMarkUnread" },
  { id: "inbox.select", keys: ["x"], scope: "inbox", labelKey: "bindings.inboxSelect" },
  { id: "inbox.clearSelection", keys: ["Escape"], scope: "inbox", labelKey: "bindings.inboxClearSelection" },
  { id: "thread.search", keys: ["Mod+F"], scope: "thread", labelKey: "bindings.threadSearch" },
  { id: "conversation.reply", keys: ["r"], scope: "thread", labelKey: "bindings.conversationReply" },
  { id: "conversation.finish", keys: ["e"], scope: "thread", labelKey: "bindings.conversationFinish" },
  { id: "conversation.info", keys: ["i"], scope: "thread", labelKey: "bindings.conversationInfo" },
  { id: "conversation.popOut", keys: [], scope: "thread", labelKey: "bindings.conversationPopOut" },
  { id: "conversation.pin", keys: ["p"], scope: "thread", labelKey: "bindings.conversationPin" },
  { id: "conversation.markUnread", keys: ["u"], scope: "thread", labelKey: "bindings.conversationMarkUnread" },
  { id: "composer.bold", keys: ["Mod+B"], scope: "composer", labelKey: "bindings.composerBold" },
  { id: "composer.italic", keys: ["Mod+I"], scope: "composer", labelKey: "bindings.composerItalic" },
  { id: "composer.strike", keys: ["Mod+Shift+X"], scope: "composer", labelKey: "bindings.composerStrike" },
  { id: "composer.sendAndFinish", keys: ["Mod+Shift+Enter"], scope: "composer", labelKey: "bindings.composerSendAndFinish" },
] as const satisfies readonly ShortcutBinding[];

export type ShortcutId = (typeof CRM_BINDINGS)[number]["id"];

export function bindingsIn(scope: ShortcutScope): readonly ShortcutBinding[] {
  return CRM_BINDINGS.filter((binding) => binding.scope === scope);
}

export function bindingFor(id: ShortcutId): ShortcutBinding {
  return CRM_BINDINGS.find((binding) => binding.id === id)!;
}

export function scopeLabelKey(scope: ShortcutScope): string {
  return `scopes.${scope}`;
}

export interface ResolveContext {
  platform: Platform;
  attachedToWindow: boolean;
  root?: Element | null;
}

function scopeOfTarget(target: EventTarget | null | undefined): string | null {
  const element = target as HTMLElement | null | undefined;
  if (typeof element?.closest !== "function") return null;
  return element.closest(`[${SHORTCUT_SCOPE_ATTRIBUTE}]`)?.getAttribute(SHORTCUT_SCOPE_ATTRIBUTE) ?? null;
}

function belongsToAnotherScope(stroke: KeyStroke, scope: ShortcutScope, context: ResolveContext): boolean {
  if (!context.attachedToWindow || scope === "global") return false;
  const owner = scopeOfTarget(stroke.target);
  return owner !== null && owner !== scope;
}

function insideForeignOverlay(stroke: KeyStroke, root: Element | null | undefined): boolean {
  const overlay = closestOverlay(stroke.target);
  if (!overlay) return false;
  return !root || !overlay.contains(root);
}

function blockedByTarget(stroke: KeyStroke, binding: ShortcutBinding, root: Element | null | undefined): boolean {
  if (binding.scope === "composer") return false;
  if (insideForeignOverlay(stroke, root)) return true;
  return !binding.whileTyping && isEditableTarget(stroke.target);
}

export function resolveShortcut(stroke: KeyStroke, scope: ShortcutScope, context: ResolveContext): ShortcutId | null {
  if (belongsToAnotherScope(stroke, scope, context)) return null;
  const binding = CRM_BINDINGS.find(
    (candidate) => candidate.scope === scope && candidate.keys.some((key) => matchesChord(stroke, key, context.platform)),
  );
  if (!binding || blockedByTarget(stroke, binding, context.root)) return null;
  return binding.id;
}
