import { startProbes, stopProbes } from "../studio-perf/probes";
import { createFrameRecorder } from "../studio-perf/frame-recorder";
import { ReactFlowProvider, useReactFlow, useStoreApi } from "@xyflow/react";
import { createElement as h, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { IntlProvider } from "use-intl";

import messages from "../../src/i18n/messages/pt.json";
import { WorkflowEditor } from "@/app/[locale]/dashboard/workflows/_components/workflow-editor";
import { TooltipProvider } from "@/components/ui/tooltip";

import { FIXTURE_DEFINITIONS, fixtureHandles, fixtureWorkflow } from "./fixture";
import { imageFixtureWorkflow } from "./image-fixture";
import { TEXT_FIXTURE_DEFINITIONS, textFixtureWorkflow } from "./text-fixture";
import { mediaReads } from "./medias-stub";

const FIT = { padding: 0.2, maxZoom: 1 };
const PANE_SCAN_STEP = 24;
const HEADER_OFFSET = 10;

const FIXTURE_FILES = "/fixtures/";
const RESOURCE_ENTRIES = 10_000;
performance.setResourceTimingBufferSize(RESOURCE_ENTRIES);
const FIXTURES = {
  images: { workflow: imageFixtureWorkflow, definitions: FIXTURE_DEFINITIONS },
  text: { workflow: textFixtureWorkflow, definitions: TEXT_FIXTURE_DEFINITIONS },
};
const chosen = FIXTURES[new URLSearchParams(location.search).get("fixture") as keyof typeof FIXTURES] ?? { workflow: fixtureWorkflow, definitions: FIXTURE_DEFINITIONS };
const workflow = chosen.workflow();
const recorder = createFrameRecorder();

function settle(ms = 400): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, ms))));
}

function nodeElement(id: string): HTMLElement | null {
  return document.querySelector(`.react-flow__node[data-id="${id}"]`);
}

function Probe() {
  const flow = useReactFlow();
  const store = useStoreApi();
  useEffect(() => {
    const harness = {
      ready() {
        const { nodeLookup } = store.getState();
        const measured = [...nodeLookup.values()].filter((node) => node.measured.width && node.measured.height).length;
        return measured === workflow.graph.nodes.length && document.querySelectorAll(".react-flow__edge").length > 0;
      },
      async fit() {
        await flow.fitView(FIT);
        await settle();
        return flow.getViewport();
      },
      async focus(id: string, zoom: number) {
        const node = flow.getInternalNode(id);
        if (!node) throw new Error(`no node ${id}`);
        await flow.setCenter(node.internals.positionAbsolute.x + (node.measured.width ?? 0) / 2, node.internals.positionAbsolute.y + (node.measured.height ?? 0) / 2, { zoom });
        await settle();
        return flow.getViewport();
      },
      grip(id: string) {
        const rect = nodeElement(id)?.getBoundingClientRect();
        if (!rect) return null;
        return { x: rect.left + rect.width / 2, y: rect.top + Math.min(HEADER_OFFSET, rect.height / 2) };
      },
      paneSpot() {
        const host = document.querySelector(".react-flow")!.getBoundingClientRect();
        const cx = host.left + host.width / 2;
        const cy = host.top + host.height / 2;
        let best: { x: number; y: number; d: number } | null = null;
        for (let y = host.top + 60; y < host.bottom - 60; y += PANE_SCAN_STEP) {
          for (let x = host.left + 60; x < host.right - 60; x += PANE_SCAN_STEP) {
            if (!document.elementFromPoint(x, y)?.classList.contains("react-flow__pane")) continue;
            const d = Math.hypot(x - cx, y - cy);
            if (!best || d < best.d) best = { x, y, d };
          }
        }
        return best && { x: best.x, y: best.y };
      },
      center() {
        const host = document.querySelector(".react-flow")!.getBoundingClientRect();
        return { x: host.left + host.width / 2, y: host.top + host.height / 2 };
      },
      position(id: string) {
        return flow.getInternalNode(id)?.internals.positionAbsolute ?? null;
      },
      async place(id: string, position: { x: number; y: number }) {
        flow.updateNode(id, { position });
        await settle();
      },
      viewport() {
        return flow.getViewport();
      },
      counts() {
        return { nodes: flow.getNodes().length, edges: flow.getEdges().length, renderedNodes: document.querySelectorAll(".react-flow__node").length, renderedEdges: document.querySelectorAll(".react-flow__edge").length, animatedPaths: [...document.querySelectorAll(".react-flow__edge path")].filter((path) => getComputedStyle(path).animationName !== "none").length };
      },
      media() {
        const images = [...document.querySelectorAll<HTMLImageElement>(".react-flow__node img")];
        const videos = [...document.querySelectorAll<HTMLVideoElement>(".react-flow__node video")];
        const requests = performance.getEntriesByType("resource").filter((entry) => entry.name.includes(FIXTURE_FILES)).length;
        return { reads: mediaReads.count, requests, images: images.length, decoded: images.filter((image) => image.complete && image.naturalWidth > 0).length, unsized: images.filter((image) => !image.getAttribute("width") || !image.getAttribute("height")).length, videos: videos.length, playing: videos.filter((video) => !video.paused).length };
      },
      record() {
        startProbes();
        recorder.start();
      },
      async stop() {
        await settle(250);
        const stats = recorder.stop();
        const probes = await stopProbes();
        return { ...stats, rendered: probes.rendered, commits: probes.commits };
      },
      settle,
    };
    Object.assign(window, { harness });
  }, [flow, store]);
  return null;
}

document.documentElement.style.setProperty("--dashboard-header-h", "0px");

createRoot(document.getElementById("root")!).render(
  h(
    IntlProvider,
    { locale: "pt", messages, onError: () => undefined, timeZone: "America/Sao_Paulo" },
    h(
      TooltipProvider,
      null,
      h(
        ReactFlowProvider,
        null,
        h(Probe),
        h(WorkflowEditor, { workflow, definitions: chosen.definitions, initialHandles: fixtureHandles(workflow.graph.nodes), mode: "edit" }),
      ),
    ),
  ),
);
