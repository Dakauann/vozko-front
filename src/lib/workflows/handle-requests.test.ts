import { describe, expect, it } from "vitest";

import { fixtureHandles, fixtureWorkflow, FIXTURE_DEFINITIONS } from "../../../scripts/workflows-perf/fixture";

import { acceptHandles, emptyHandleCache, handleRequestOf, seedHandleCache, type HandleNode } from "./handle-requests";

const dynamicTypes = new Set(FIXTURE_DEFINITIONS.filter((d) => d.dynamicHandles).map((d) => d.type));

function dynamicNodes(): HandleNode[] {
  return fixtureWorkflow()
    .graph.nodes.filter((n) => dynamicTypes.has(n.type))
    .map((n) => ({ id: n.id, type: n.type, config: n.config ?? {} }));
}

function bytes(nodes: HandleNode[]): number {
  return new TextEncoder().encode(JSON.stringify({ nodes })).length;
}

describe("handle requests", () => {
  it("send every dynamic node the first time and nothing once each answer is cached", () => {
    const nodes = dynamicNodes();
    const first = handleRequestOf(emptyHandleCache(), nodes);
    expect(first.send.map((n) => n.id)).toEqual(nodes.map((n) => n.id));

    const cache = acceptHandles(first.cache, first.send, fixtureHandles(nodes as never));
    expect(handleRequestOf(cache, nodes).send).toEqual([]);
  });

  it("send only the node whose config changed when one node of the 141 node fixture is edited", () => {
    const nodes = dynamicNodes();
    const cache = seedHandleCache(fixtureHandles(nodes as never), nodes);
    const edited = nodes.map((n, i) => (i === 3 ? { ...n, config: { ...n.config, cases: [{ value: "novo" }] } } : n));

    const next = handleRequestOf(cache, edited);

    expect(next.send.map((n) => n.id)).toEqual([nodes[3].id]);
    expect(bytes(next.send)).toBeLessThan(bytes(nodes) / 10);
  });

  it("drop the answers of removed nodes and keep the rest", () => {
    const nodes = dynamicNodes();
    const cache = seedHandleCache(fixtureHandles(nodes as never), nodes);

    const next = handleRequestOf(cache, nodes.slice(1));

    expect(next.cache.handles[nodes[0].id]).toBeUndefined();
    expect(next.cache.handles[nodes[1].id]).toEqual(cache.handles[nodes[1].id]);
    expect(next.send).toEqual([]);
  });

  it("only remember a node as answered for the config that was sent", () => {
    const node: HandleNode = { id: "tm", type: "condition_text_match", config: { cases: [{ value: "a" }] } };
    const first = handleRequestOf(emptyHandleCache(), [node]);
    const changed = { ...node, config: { cases: [{ value: "b" }] } };

    const cache = acceptHandles(first.cache, first.send, { tm: [{ id: "a", label: "a" }] });

    expect(cache.handles.tm).toEqual([{ id: "a", label: "a" }]);
    expect(handleRequestOf(cache, [changed]).send).toEqual([changed]);
  });
});
