export const CONTACT_LIST_PAGE_SIZE = 50;

export interface ContactListView {
  query: string;
  onlyMissing: boolean;
  page: number;
}

export interface ContactPage<T> {
  rows: T[];
  page: number;
  pages: number;
}

export const OPEN_CONTACT_LIST_VIEW: ContactListView = { query: "", onlyMissing: false, page: 0 };

export function isNarrowed(view: ContactListView): boolean {
  return view.onlyMissing || view.query.trim() !== "";
}

export function narrowContacts<T>(
  rows: T[],
  view: ContactListView,
  searchable: (row: T) => (string | undefined)[],
  isMissing?: (row: T) => boolean,
): T[] {
  const query = view.query.trim().toLowerCase();
  const missingOnly = view.onlyMissing && isMissing ? isMissing : null;
  if (!query && !missingOnly) return rows;
  return rows.filter((row) => {
    if (missingOnly && !missingOnly(row)) return false;
    if (!query) return true;
    return searchable(row).some((text) => text?.toLowerCase().includes(query) ?? false);
  });
}

export function contactPage<T>(rows: T[], page: number): ContactPage<T> {
  const pages = Math.ceil(rows.length / CONTACT_LIST_PAGE_SIZE);
  const current = Math.min(Math.max(page, 0), Math.max(pages - 1, 0));
  const start = current * CONTACT_LIST_PAGE_SIZE;
  return { rows: rows.slice(start, start + CONTACT_LIST_PAGE_SIZE), page: current, pages };
}

export function viewShowingContact(index: number): ContactListView {
  return { query: "", onlyMissing: false, page: Math.floor(index / CONTACT_LIST_PAGE_SIZE) };
}

export function onlyMissingView(view: ContactListView): ContactListView {
  return { ...view, onlyMissing: true, page: 0 };
}
