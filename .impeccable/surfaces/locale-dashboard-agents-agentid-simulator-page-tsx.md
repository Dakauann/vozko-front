---
version: 1
slug: "locale-dashboard-agents-agentid-simulator-page-tsx"
primary_target: "src/app/[locale]/dashboard/agents/[agentId]/simulator/page.tsx"
related_targets: []
---

# Agent simulator

Scope: `/dashboard/agents/[agentId]/simulator`. Mode: **Operate**.

Audience: managers who configure agents (gated `agents:update`). Job: rehearse an agent before a real lead meets it, and debug what it does: which tools it calls, with which arguments, on which context, at what cost.

Direction: a split-view instrument. Left: the conversation exactly as a lead would live it (operator plays the lead; agent replies as segmented bubbles; dot-pulse typing). Right: the X-ray rail, with per-turn tool calls (model's own arguments + sandboxed canned result), assembled system prompt, memory/RAG injection flags, token cost, latency. Tool calls also surface inline in the transcript at the position they fired; clicking one focuses it in the rail. Memorable moment: the inline dashed tool chip: the moment the agent ACTS is visible inside the conversation itself.

Constraints that must hold:
- The sandbox promise is a product claim: every tool execution is intercepted server-side (SimulatedToolService); the page states it (header badge + composer hint) and must never overclaim.
- Simulation consumes AI credits, said plainly in the composer hint.
- Provider errors surface verbatim; they are the diagnostic, not noise.
- Changing the impersonated lead resets the transcript (context honesty); reset keeps the lead.
- Session is client-held (sessionStorage per agent); backend is stateless.

Unresolved: streaming (GenerateStream) for long turns; per-turn X-ray history navigation (today the rail shows the last turn only, tools tab shows all turns).
