import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
    workspace: { loading: false, id: "ws-1" as string | null, role: "admin" },
    departments: [] as { id: string; name: string }[],
    release: null as null | (() => void),
}));

vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: { id: "user-1", role: "user" } }) }));
vi.mock("@/contexts/workspace-context", () => ({
    useWorkspace: () => ({
        currentWorkspace: state.workspace.id ? { id: state.workspace.id, currentUserRole: state.workspace.role } : null,
        isLoading: state.workspace.loading,
    }),
}));
vi.mock("@/lib/department/client", () => ({
    NO_DEPARTMENT_SCOPE: { restricted: false, departmentIds: [] },
    fetchDepartmentScope: async () => ({ scope: { restricted: false, departmentIds: [] } }),
    fetchDepartments: () =>
        new Promise((resolve) => {
            state.release = () => resolve({ departments: state.departments });
        }),
}));

import { DepartmentProvider, useDepartment } from "@/contexts/department-context";

function Probe() {
    const { isResolved, currentDepartment } = useDepartment();
    return <span data-testid="probe">{`${isResolved}:${currentDepartment?.id ?? "all"}`}</span>;
}

function renderProvider() {
    return render(
        <DepartmentProvider>
            <Probe />
        </DepartmentProvider>,
    );
}

describe("DepartmentProvider isResolved", () => {
    beforeEach(() => {
        state.workspace = { loading: false, id: "ws-1", role: "admin" };
        state.departments = [];
        state.release = null;
        document.cookie = "departmentId=; max-age=0; path=/";
    });

    it("is not resolved while the workspace is still loading", () => {
        state.workspace = { loading: true, id: null, role: "admin" };
        renderProvider();
        expect(screen.getByTestId("probe").textContent).toBe("false:all");
    });

    it("resolves only after the departments of the current workspace arrive", async () => {
        renderProvider();
        expect(screen.getByTestId("probe").textContent).toBe("false:all");
        await waitFor(() => expect(state.release).not.toBeNull());
        state.release?.();
        await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("true:all"));
    });

    it("resolves at once when there is no workspace", async () => {
        state.workspace = { loading: false, id: null, role: "admin" };
        renderProvider();
        await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("true:all"));
    });

    it("waits for a locked member's department to be chosen before resolving", async () => {
        state.workspace = { loading: false, id: "ws-1", role: "member" };
        state.departments = [{ id: "dep-1", name: "Vendas" }];
        renderProvider();
        await waitFor(() => expect(state.release).not.toBeNull());
        state.release?.();
        await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("true:dep-1"));
    });
});
