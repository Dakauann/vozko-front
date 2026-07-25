export type ShortcutMessageType = "text" | "button" | "media";
export type ShortcutMediaType = "image" | "video" | "audio" | "document";

export interface ShortcutButton {
    id: string;
    title: string;
}

export interface ShortcutContent {
    text?: string;
    headerType?: string;
    headerText?: string;
    footerText?: string;
    mediaUrl?: string;
    mediaType?: string;
    buttons?: ShortcutButton[];
}

export interface MessageShortcut {
    id: string;
    workspaceId: string;
    shortcut: string;
    name: string;
    messageType: ShortcutMessageType;
    content: ShortcutContent;
    createdAt: string;
    updatedAt: string;
}

export interface CreateMessageShortcutPayload {
    name: string;
    shortcut: string;
    messageType: ShortcutMessageType;
    content: ShortcutContent;
}

export interface UpdateMessageShortcutPayload {
    name?: string;
    shortcut?: string;
    messageType?: ShortcutMessageType;
    content?: ShortcutContent;
}
