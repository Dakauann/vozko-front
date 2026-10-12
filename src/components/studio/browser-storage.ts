export interface StudioStorage {
  read: (key: string) => string | null;
  write: (key: string, value: string) => void;
}

export const browserStorage: StudioStorage = {
  read(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  write(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      return;
    }
  },
};
