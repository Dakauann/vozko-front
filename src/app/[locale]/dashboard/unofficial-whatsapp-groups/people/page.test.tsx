import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GroupPerson } from "@/lib/unofficial-whatsapp-groups/types";

const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

const groupActions = vi.hoisted(() => ({ listGroupPeopleAction: vi.fn() }));
vi.mock("@/app/actions/unofficial-whatsapp-groups", () => groupActions);

const navigation = vi.hoisted(() => ({ replace: vi.fn(), params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace, push: vi.fn() }),
  usePathname: () => "/pt/dashboard/unofficial-whatsapp-groups/people",
  useSearchParams: () => navigation.params,
}));

const grants = vi.hoisted(() => ({ value: new Set<string>(["unofficial_whatsapp_groups:read", "leads:read"]) }));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({
    can: (resource: string, action: string) => grants.value.has(`${resource}:${action}`),
  }),
}));

vi.mock("@/i18n/routing", () => ({
  usePathname: () => "/dashboard/unofficial-whatsapp-groups/people",
  useRouter: () => ({ replace: navigation.replace, push: vi.fn() }),
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const intl = vi.hoisted(() => {
  const translators = new Map<string, (key: string, values?: Record<string, unknown>) => string>();
  const formatter = {
    number: (value: number) => String(value),
    dateTime: () => "18 out 2026",
    relativeTime: () => "há 2 dias",
  };
  return {
    formatter,
    translator(namespace: string) {
      let translate = translators.get(namespace);
      if (!translate) {
        translate = (key, values) => (values ? `${namespace}.${key}:${JSON.stringify(values)}` : `${namespace}.${key}`);
        translators.set(namespace, translate);
      }
      return translate;
    },
  };
});
vi.mock("next-intl", () => ({
  useNow: () => new Date("2026-10-18T12:00:00Z"),
  useLocale: () => "pt",
  useFormatter: () => intl.formatter,
  useTranslations: (namespace: string) => intl.translator(namespace),
}));

import GroupPeoplePage from "./page";

function person(overrides: Partial<GroupPerson> = {}): GroupPerson {
  return {
    personKey: "k-1",
    name: "Ana Souza",
    phone: "5584999990001",
    jid: "5584999990001@s.whatsapp.net",
    groupCount: 2,
    groups: [
      { groupId: "g-1", subject: "Vendas" },
      { groupId: "g-2", subject: "Suporte" },
    ],
    ...overrides,
  };
}

function page(items: GroupPerson[], totalPages = 1) {
  return { items, meta: { page: 1, pageSize: 50, totalPages, totalItems: items.length } };
}

describe("GroupPeoplePage", () => {
  beforeEach(() => {
    groupActions.listGroupPeopleAction.mockReset();
    navigation.replace.mockClear();
    navigation.params = new URLSearchParams();
    toastMock.error.mockClear();
    grants.value = new Set(["unofficial_whatsapp_groups:read", "leads:read"]);
  });

  it("asks for the filters the URL carries", async () => {
    navigation.params = new URLSearchParams("search=ana&minGroups=5");
    groupActions.listGroupPeopleAction.mockResolvedValue(page([person()]));
    render(<GroupPeoplePage />);
    await waitFor(() =>
      expect(groupActions.listGroupPeopleAction).toHaveBeenCalledWith({ search: "ana", minGroups: 5, page: 1, pageSize: 50 }),
    );
  });

  it("shows a hidden number person by the JID local part and says the number is hidden", async () => {
    groupActions.listGroupPeopleAction.mockResolvedValue(
      page([person({ personKey: "k-2", name: "123456789012345@lid", phone: undefined, jid: "123456789012345@lid" })]),
    );
    render(<GroupPeoplePage />);
    expect(await screen.findByText("123456789012345")).toBeInTheDocument();
    expect(screen.getByText("123456789012345@lid")).toBeInTheDocument();
    expect(screen.getByText("unofficialGroups.kit.identity.hiddenNumber")).toBeInTheDocument();
  });

  it("expands a row into every group with a link to the group and to its member list", async () => {
    groupActions.listGroupPeopleAction.mockResolvedValue(page([person()]));
    render(<GroupPeoplePage />);
    fireEvent.click(await screen.findByRole("button", { name: "unofficialGroups.people.table.expand" }));

    const openMembers = screen.getAllByText("unofficialGroups.people.expanded.openMembers");
    expect(openMembers).toHaveLength(2);
    expect(openMembers[0].closest("a")).toHaveAttribute(
      "href",
      "/dashboard/unofficial-whatsapp-groups/g-1?tab=members&members=all&msearch=5584999990001",
    );
    expect(screen.getAllByText("unofficialGroups.people.expanded.openGroup")[1].closest("a")).toHaveAttribute(
      "href",
      "/dashboard/unofficial-whatsapp-groups/g-2",
    );
    expect(screen.getByRole("button", { name: "unofficialGroups.people.table.collapse" })).toHaveAttribute("aria-expanded", "true");
  });

  it("writes a new minimum into the URL", async () => {
    groupActions.listGroupPeopleAction.mockResolvedValue(page([person()]));
    render(<GroupPeoplePage />);
    await screen.findByText("Ana Souza");
    const toggle = screen.getByRole("group", { name: "unofficialGroups.people.minGroups.title" });
    fireEvent.click(within(toggle).getByRole("button", { name: 'unofficialGroups.people.minGroups.option:{"count":10}' }));
    expect(navigation.replace).toHaveBeenCalledWith("/pt/dashboard/unofficial-whatsapp-groups/people?minGroups=10", { scroll: false });
  });

  it("offers to clear a search that found nobody", async () => {
    navigation.params = new URLSearchParams("search=zz");
    groupActions.listGroupPeopleAction.mockResolvedValue(page([]));
    render(<GroupPeoplePage />);
    expect(await screen.findByText('unofficialGroups.people.empty.noResult:{"search":"zz"}')).toBeInTheDocument();
    fireEvent.click(screen.getByText("unofficialGroups.people.empty.clearSearch"));
    expect(navigation.replace).toHaveBeenCalledWith("/pt/dashboard/unofficial-whatsapp-groups/people", { scroll: false });
  });

  it("explains an empty list by the minimum when nothing is searched", async () => {
    groupActions.listGroupPeopleAction.mockResolvedValue(page([]));
    render(<GroupPeoplePage />);
    expect(await screen.findByText('unofficialGroups.people.empty.nobody:{"count":2}')).toBeInTheDocument();
    expect(screen.getByText("unofficialGroups.people.empty.nobodyHint")).toBeInTheDocument();
  });

  it("marks page counts as page scoped when there are more pages", async () => {
    groupActions.listGroupPeopleAction.mockResolvedValue(page([person({ leadId: "l-1", leadName: "Ana lead" })], 3));
    render(<GroupPeoplePage />);
    expect(await screen.findByText('unofficialGroups.people.stats.onPage:{"label":"unofficialGroups.people.stats.withLead"}')).toBeInTheDocument();
    expect(screen.getByText("Ana lead").closest("a")).toHaveAttribute("href", "/dashboard/leads/l-1");
  });

  it("shows the lead as plain text to a user who cannot open leads", async () => {
    grants.value = new Set(["unofficial_whatsapp_groups:read"]);
    groupActions.listGroupPeopleAction.mockResolvedValue(page([person({ leadId: "l-1", leadName: "Ana lead" })]));
    render(<GroupPeoplePage />);
    expect(await screen.findByText("Ana lead")).toBeInTheDocument();
    expect(screen.getByText("Ana lead").closest("a")).toBeNull();
  });

  it("opens the member list unsearched for a hidden number person with no real name", async () => {
    groupActions.listGroupPeopleAction.mockResolvedValue(
      page([person({ personKey: "k-2", name: "123456789012345@lid", phone: undefined, jid: "123456789012345@lid" })]),
    );
    render(<GroupPeoplePage />);
    fireEvent.click(await screen.findByRole("button", { name: "unofficialGroups.people.table.expand" }));
    expect(screen.getAllByText("unofficialGroups.people.expanded.openMembers")[0].closest("a")).toHaveAttribute(
      "href",
      "/dashboard/unofficial-whatsapp-groups/g-1?tab=members&members=all",
    );
  });

  it("shows no zero counts beside a first load failure", async () => {
    groupActions.listGroupPeopleAction.mockResolvedValue({ error: "boom", items: [], meta: { page: 1, pageSize: 50, totalPages: 0, totalItems: 0 } });
    render(<GroupPeoplePage />);
    expect(await screen.findByText("unofficialGroups.people.error.title")).toBeInTheDocument();
    expect(screen.getByText("unofficialGroups.people.stats.people")).toBeInTheDocument();
    expect(screen.queryByText("0")).toBeNull();
  });

  it("shows the failure for the new filters instead of the old rows when a minimum change fails", async () => {
    groupActions.listGroupPeopleAction.mockResolvedValueOnce(page([person()]));
    groupActions.listGroupPeopleAction.mockResolvedValueOnce({ error: "boom", items: [], meta: { page: 1, pageSize: 50, totalPages: 0, totalItems: 0 } });
    const view = render(<GroupPeoplePage />);
    await screen.findByText("Ana Souza");
    navigation.params = new URLSearchParams("minGroups=5");
    view.rerender(<GroupPeoplePage />);
    expect(await screen.findByText("unofficialGroups.people.error.title")).toBeInTheDocument();
    expect(screen.queryByText("Ana Souza")).toBeNull();
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("shows the failure with a retry on the first load", async () => {
    groupActions.listGroupPeopleAction.mockResolvedValueOnce({ error: "boom", items: [], meta: { page: 1, pageSize: 50, totalPages: 0, totalItems: 0 } });
    groupActions.listGroupPeopleAction.mockResolvedValueOnce(page([person()]));
    render(<GroupPeoplePage />);
    expect(await screen.findByText("unofficialGroups.people.error.title")).toBeInTheDocument();
    fireEvent.click(screen.getByText("unofficialGroups.kit.table.retry"));
    expect(await screen.findByText("Ana Souza")).toBeInTheDocument();
  });

  it("keeps the rows and only toasts when a refresh fails", async () => {
    groupActions.listGroupPeopleAction.mockResolvedValueOnce(page([person()]));
    groupActions.listGroupPeopleAction.mockResolvedValueOnce({ error: "boom", items: [], meta: { page: 1, pageSize: 50, totalPages: 0, totalItems: 0 } });
    render(<GroupPeoplePage />);
    await screen.findByText("Ana Souza");
    fireEvent.click(screen.getByRole("button", { name: "unofficialGroups.people.actions.refresh" }));
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith("unofficialGroups.people.error.reload", { description: "boom" }));
    expect(screen.getByText("Ana Souza")).toBeInTheDocument();
  });
});
