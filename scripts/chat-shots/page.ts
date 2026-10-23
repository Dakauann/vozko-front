import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { IntlProvider } from "use-intl";

import messages from "../../src/i18n/messages/pt.json";
import { NodeDefinitionsProvider } from "@/app/[locale]/dashboard/workflows/_components/node-previews/node-definitions";
import { WorkflowTestPanel } from "@/app/[locale]/dashboard/workflows/_components/workflow-test-panel";
import { ThreadView } from "@/components/team-chat/thread-view";
import { TooltipProvider } from "@/components/ui/tooltip";

import { NODE_DEFINITIONS, NODE_LABELS, SIMULATIONS, THREAD } from "./fixtures";

const params = new URLSearchParams(location.search);
const view = params.get("view") ?? "tester";
const width = Number(params.get("width") ?? 400);
const theme = params.get("theme") === "dark" ? "dark" : "light";

document.documentElement.classList.remove("light", "dark");
document.documentElement.classList.add(theme);
document.documentElement.style.setProperty("--dashboard-header-h", "0px");
document.documentElement.style.setProperty("--font-inter", '"Segoe UI Variable Text", "Segoe UI"');
document.documentElement.style.setProperty("--font-oxanium", '"Segoe UI Variable Display", "Segoe UI"');
document.body.style.margin = "0";
document.body.style.background = "hsl(var(--background))";

function frame(child: ReturnType<typeof h>) {
  return h(
    "div",
    { style: { display: "flex", height: "100vh", width: `${width}px`, borderRight: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }, "data-shot-frame": "" },
    h("div", { style: { display: "flex", flexDirection: "column", minWidth: 0, flex: 1, overflow: "hidden" } }, child),
  );
}

function tester() {
  const simulation = SIMULATIONS[view === "tester-error" ? "error" : "waiting"]();
  return h(NodeDefinitionsProvider, { definitions: NODE_DEFINITIONS }, h(WorkflowTestPanel, { simulation, onClose: () => undefined, nodeLabel: (id: string) => NODE_LABELS[id] }));
}

function teamChat() {
  return h(ThreadView, { threadId: THREAD.id });
}

createRoot(document.getElementById("root")!).render(
  h(
    IntlProvider,
    { locale: "pt", messages, onError: () => undefined, timeZone: "America/Sao_Paulo" },
    h(TooltipProvider, null, frame(view === "team" ? teamChat() : tester())),
  ),
);

Object.assign(window, { harness: { ready: () => Boolean(document.querySelector("[data-shot-frame] *")) } });
