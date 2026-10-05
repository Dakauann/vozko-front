import { useEffect, type ReactNode } from "react";

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const scope = vi.hoisted(() => ({
    workspaceId: null as string | null,
    departmentId: null as string | null,
    resolved: false,
}));

vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: { id: "user-1" } }) }));
vi.mock("@/contexts/workspace-context", () => ({
    useWorkspace: () => ({ currentWorkspace: scope.workspaceId ? { id: scope.workspaceId } : null }),
}));
vi.mock("@/contexts/department-context", () => ({
    useDepartment: () => ({
        currentDepartment: scope.departmentId ? { id: scope.departmentId } : null,
        isResolved: scope.resolved,
    }),
}));
vi.mock("@/contexts/crm-context", () => ({ CrmProvider: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/brand/screen-loader", () => ({ ScreenLoader: () => <div data-testid="loader" /> }));

import DashboardCrmWrapper from "@/components/dashboard/DashboardCrmWrapper";

function Page({ onMount }: { onMount: () => void }) {
    useEffect(onMount, [onMount]);
    return <div data-testid="page" />;
}

function tree(next: typeof scope, onMount: () => void) {
    Object.assign(scope, next);
    return (
        <DashboardCrmWrapper>
            <Page onMount={onMount} />
        </DashboardCrmWrapper>
    );
}

describe("DashboardCrmWrapper", () => {
    it("mounts the page once, after the workspace and department scope resolve", () => {
        const onMount = vi.fn();
        const view = render(tree({ workspaceId: null, departmentId: null, resolved: false }, onMount));
        expect(view.queryByTestId("page")).toBeNull();
        expect(view.getByTestId("loader")).toBeTruthy();

        view.rerender(tree({ workspaceId: "ws-1", departmentId: null, resolved: false }, onMount));
        view.rerender(tree({ workspaceId: "ws-1", departmentId: "dep-1", resolved: true }, onMount));
        view.rerender(tree({ workspaceId: "ws-1", departmentId: "dep-1", resolved: true }, onMount));

        expect(onMount).toHaveBeenCalledTimes(1);
    });

    it("still starts the page over when the user switches workspace", () => {
        const onMount = vi.fn();
        const view = render(tree({ workspaceId: "ws-1", departmentId: null, resolved: true }, onMount));
        view.rerender(tree({ workspaceId: "ws-2", departmentId: null, resolved: true }, onMount));
        expect(onMount).toHaveBeenCalledTimes(2);
    });
});
