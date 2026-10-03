import { duplicateAd, emptyAdForm, type WizardForm } from "@/lib/advertising/draft";
import type { AdRow } from "@/lib/advertising/types";
import { adIndexOfIssue, type DraftIssue } from "@/lib/advertising/wizard-issues";
import { canAddAd, formatsFor } from "@/lib/advertising/wizard-routes";

export type EditorNode = { level: "campaign" } | { level: "adSet" } | { level: "ad"; index: number };

export const CAMPAIGN_NODE: EditorNode = { level: "campaign" };
export const AD_SET_NODE: EditorNode = { level: "adSet" };

export function adNode(index: number): EditorNode {
  return { level: "ad", index };
}

export function editorNodes(form: WizardForm): EditorNode[] {
  return [CAMPAIGN_NODE, AD_SET_NODE, ...form.ads.map((_, index) => adNode(index))];
}

export function nodeKey(node: EditorNode): string {
  return node.level === "ad" ? `ad:${node.index}` : node.level;
}

export function sameNode(a: EditorNode, b: EditorNode): boolean {
  return nodeKey(a) === nodeKey(b);
}

export function startNode(form: WizardForm): EditorNode {
  switch (form.mode) {
    case "campaign":
      return AD_SET_NODE;
    case "adSet":
    case "creative":
      return adNode(0);
  }
  return CAMPAIGN_NODE;
}

export function fitNode(node: EditorNode, form: WizardForm): EditorNode {
  if (node.level !== "ad") return node;
  return adNode(Math.max(0, Math.min(node.index, form.ads.length - 1)));
}

export function neighbourNode(form: WizardForm, node: EditorNode, offset: -1 | 1): EditorNode | null {
  const nodes = editorNodes(form);
  const index = nodes.findIndex((candidate) => sameNode(candidate, node));
  return nodes[index + offset] ?? null;
}

export function nodeOfIssue(field: string): EditorNode | null {
  if (field === "adAccountId") return CAMPAIGN_NODE;
  switch (field.split(/[.[]/, 1)[0]) {
    case "campaign":
      return CAMPAIGN_NODE;
    case "adSet":
      return AD_SET_NODE;
    case "identity":
    case "ads":
      return adNode(adIndexOfIssue(field) ?? 0);
  }
  return null;
}

export function nodeHasIssues(issues: DraftIssue[], node: EditorNode): boolean {
  return issues.some((issue) => {
    const found = nodeOfIssue(issue.field);
    return found !== null && sameNode(found, node);
  });
}

export function canAddAdTo(form: WizardForm): boolean {
  return form.mode !== "creative" && canAddAd(form.objective, form.ads.map((ad) => ad.format));
}

export function withAdAdded(form: WizardForm, name: string): WizardForm {
  if (!canAddAdTo(form)) return form;
  const ad = { ...emptyAdForm(), name, format: formatsFor(form.destination)[0] };
  return { ...form, ads: [...form.ads, ad] };
}

export function withAdDuplicated(form: WizardForm, index: number, suffix: string): WizardForm {
  const source = form.ads[index];
  if (!source || !canAddAdTo(form)) return form;
  const ads = [...form.ads];
  ads.splice(index + 1, 0, duplicateAd(source, suffix));
  return { ...form, ads };
}

export function withAdRemoved(form: WizardForm, index: number): WizardForm {
  if (form.ads.length <= 1 || !form.ads[index]) return form;
  return { ...form, ads: form.ads.filter((_, position) => position !== index) };
}

export function nodeAfterRemoval(node: EditorNode, removed: number): EditorNode {
  if (node.level !== "ad" || node.index < removed) return node;
  return adNode(Math.max(0, node.index - 1));
}

export interface ObjectBranch {
  row: AdRow;
  ads: AdRow[];
}

export interface ObjectTree {
  campaign: AdRow | null;
  adSets: ObjectBranch[];
}

export function objectTree(rows: AdRow[], campaignId: string): ObjectTree {
  const campaign = rows.find((candidate) => candidate.level === "campaign" && candidate.metaId === campaignId) ?? null;
  if (!campaign) return { campaign: null, adSets: [] };
  const adSets = rows
    .filter((candidate) => candidate.level === "adset" && candidate.campaignId === campaignId)
    .map((adSet) => ({ row: adSet, ads: rows.filter((candidate) => candidate.level === "ad" && candidate.adSetId === adSet.metaId) }));
  return { campaign, adSets };
}

export function objectOrder(tree: ObjectTree): AdRow[] {
  if (!tree.campaign) return [];
  return [tree.campaign, ...tree.adSets.flatMap((branch) => [branch.row, ...branch.ads])];
}

export function objectChain(tree: ObjectTree, metaId: string): AdRow[] {
  if (!tree.campaign) return [];
  if (tree.campaign.metaId === metaId) return [tree.campaign];
  for (const branch of tree.adSets) {
    if (branch.row.metaId === metaId) return [tree.campaign, branch.row];
    const ad = branch.ads.find((candidate) => candidate.metaId === metaId);
    if (ad) return [tree.campaign, branch.row, ad];
  }
  return [];
}
