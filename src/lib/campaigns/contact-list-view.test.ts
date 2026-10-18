import { describe, expect, it } from "vitest";

import {
  CONTACT_LIST_PAGE_SIZE,
  OPEN_CONTACT_LIST_VIEW,
  contactPage,
  isNarrowed,
  narrowContacts,
  onlyMissingView,
  viewShowingContact,
} from "./contact-list-view";

interface Contact {
  number: string;
  name?: string;
  missing?: boolean;
}

const contacts: Contact[] = [
  { number: "5584999990001", name: "Ana Souza", missing: true },
  { number: "5584999990002", name: "Bruno" },
  { number: "5511988880003", missing: true },
];

const searchable = (contact: Contact) => [contact.number, contact.name];
const isMissing = (contact: Contact) => Boolean(contact.missing);

function numbered(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index);
}

describe("narrowContacts", () => {
  it("keeps every contact in the open view", () => {
    expect(narrowContacts(contacts, OPEN_CONTACT_LIST_VIEW, searchable, isMissing)).toEqual(contacts);
  });

  it("finds a contact by part of the number or the name, ignoring case and outer spaces", () => {
    const byNumber = narrowContacts(contacts, { ...OPEN_CONTACT_LIST_VIEW, query: " 1198 " }, searchable, isMissing);
    const byName = narrowContacts(contacts, { ...OPEN_CONTACT_LIST_VIEW, query: "souza" }, searchable, isMissing);
    expect(byNumber.map((c) => c.number)).toEqual(["5511988880003"]);
    expect(byName.map((c) => c.number)).toEqual(["5584999990001"]);
  });

  it("keeps only contacts missing a required value when asked", () => {
    const narrowed = narrowContacts(contacts, { ...OPEN_CONTACT_LIST_VIEW, onlyMissing: true }, searchable, isMissing);
    expect(narrowed.map((c) => c.number)).toEqual(["5584999990001", "5511988880003"]);
  });

  it("combines the search with the missing filter", () => {
    const narrowed = narrowContacts(contacts, { query: "ana", onlyMissing: true, page: 0 }, searchable, isMissing);
    expect(narrowed.map((c) => c.number)).toEqual(["5584999990001"]);
  });

  it("ignores the missing filter when nothing can be missing", () => {
    const narrowed = narrowContacts(contacts, { ...OPEN_CONTACT_LIST_VIEW, onlyMissing: true }, searchable);
    expect(narrowed).toEqual(contacts);
  });
});

describe("contactPage", () => {
  it("cuts the list into pages of the list size", () => {
    const page = contactPage(numbered(CONTACT_LIST_PAGE_SIZE * 2 + 3), 1);
    expect(page.pages).toBe(3);
    expect(page.page).toBe(1);
    expect(page.rows[0]).toBe(CONTACT_LIST_PAGE_SIZE);
    expect(page.rows).toHaveLength(CONTACT_LIST_PAGE_SIZE);
  });

  it("falls back to the last page when the list shrinks under the current one", () => {
    const page = contactPage(numbered(CONTACT_LIST_PAGE_SIZE + 1), 7);
    expect(page.page).toBe(1);
    expect(page.rows).toEqual([CONTACT_LIST_PAGE_SIZE]);
  });

  it("stays on the first page of an empty list", () => {
    expect(contactPage([], 3)).toEqual({ rows: [], page: 0, pages: 0 });
  });
});

describe("list views", () => {
  it("opens the page that holds a contact and drops every filter", () => {
    const view = viewShowingContact(CONTACT_LIST_PAGE_SIZE * 3 + 4);
    expect(view).toEqual({ query: "", onlyMissing: false, page: 3 });
    expect(isNarrowed(view)).toBe(false);
  });

  it("turns the missing filter on from the first page and keeps the search", () => {
    const view = onlyMissingView({ query: "ana", onlyMissing: false, page: 4 });
    expect(view).toEqual({ query: "ana", onlyMissing: true, page: 0 });
    expect(isNarrowed(view)).toBe(true);
  });

  it("counts a blank search as no search", () => {
    expect(isNarrowed({ ...OPEN_CONTACT_LIST_VIEW, query: "   " })).toBe(false);
  });
});
