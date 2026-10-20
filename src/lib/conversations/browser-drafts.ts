import { createDraftStore, type DraftStoragePort } from "./drafts";

const localStoragePort: DraftStoragePort = {
  get length() {
    return window.localStorage.length;
  },
  key: (index) => window.localStorage.key(index),
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: (key) => window.localStorage.removeItem(key),
};

export const conversationDrafts = createDraftStore(localStoragePort);
