"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { codedQueryError } from "@/lib/api/coded-query-error";
import type { CodedError } from "@/lib/api/coded-error";
import {
  audienceCreateState,
  audienceSpecFor,
  channelFieldsReady,
  emptyAudienceDraft,
  listContextFor,
  recipientsOf,
  type AudienceCreateState,
  type AudienceDraft,
} from "@/lib/campaign-audience/draft";
import type { AudienceChannel, AudienceCount, AudienceSpec, ChannelFields, ListContext, ListPreview } from "@/lib/campaign-audience/types";

import {
  campaignAudienceCountRoot,
  campaignAudienceLeadsRoot,
  campaignAudienceListRoot,
  campaignAudienceMapRoot,
  listPreviewKey,
  useAudienceCountQuery,
  useAudienceWorkspaceId,
  useListPreviewQuery,
} from "./use-audience-queries";

const SETTLE_MS = 400;

export interface ExternalAudienceCount {
  data: AudienceCount | null;
  updatedAt: number;
  error: CodedError | null;
  pending: boolean;
  reload: () => void;
}

export interface CampaignAudienceOptions {
  channel: AudienceChannel;
  fields: ChannelFields;
  initial?: Partial<AudienceDraft>;
  scope?: string;
  counted?: ExternalAudienceCount;
}

export interface CampaignAudience {
  channel: AudienceChannel;
  fields: ChannelFields;
  fieldsReady: boolean;
  draft: AudienceDraft;
  update: (next: SetStateAction<AudienceDraft>) => void;
  spec: AudienceSpec | null;
  countedSpec: AudienceSpec | null;
  countedFields: ChannelFields;
  context: ListContext;
  count: AudienceCount | null;
  countedAt: number;
  countError: CodedError | null;
  counting: boolean;
  preview: ListPreview | null;
  previewError: CodedError | null;
  createState: AudienceCreateState;
  recipients: AudienceSpec | null;
  recount: () => void;
  refreshList: () => void;
  acceptList: (preview: ListPreview) => void;
}

function useSettled<T>(value: T): { settled: T; moving: boolean } {
  const key = JSON.stringify(value ?? null);
  const settledKey = useDebouncedValue(key, SETTLE_MS);
  const settled = useMemo(() => JSON.parse(settledKey) as T, [settledKey]);
  return { settled, moving: key !== settledKey };
}

function belongingTo(draft: AudienceDraft, count: AudienceCount | null): AudienceCount | null {
  if (!count || count.source !== draft.source) return null;
  if (draft.source === "list" && count.list?.id !== draft.listId) return null;
  return count;
}

function useScopedReset(scope: string | undefined, update: (next: SetStateAction<AudienceDraft>) => void) {
  const previous = useRef(scope);
  useEffect(() => {
    if (previous.current === scope) return;
    previous.current = scope;
    update((draft) => ({ ...draft, variables: {} }));
  }, [scope, update]);
}

export function useCampaignAudience({ channel, fields, initial, scope, counted }: CampaignAudienceOptions): CampaignAudience {
  const client = useQueryClient();
  const workspaceId = useAudienceWorkspaceId();
  const [draft, setDraft] = useState<AudienceDraft>(() => ({ ...emptyAudienceDraft(channel), ...initial }));
  const update = useCallback((next: SetStateAction<AudienceDraft>) => setDraft(next), []);
  useScopedReset(scope, update);

  const spec = useMemo(() => audienceSpecFor(channel, fields, draft), [channel, fields, draft]);
  const fieldsReady = channelFieldsReady(channel, fields);
  const settledSpec = useSettled(spec);
  const settledFields = useSettled(fields);
  const countQuery = useAudienceCountQuery(channel, settledSpec.settled, settledFields.settled, fieldsReady && !counted);

  const context = useMemo(() => listContextFor(channel, fields, draft), [channel, fields, draft]);
  const settledContext = useSettled(context);
  const previewQuery = useListPreviewQuery(channel, draft.listId, settledContext.settled);

  const queried = countQuery.isError ? null : (countQuery.data ?? null);
  const count = spec && fieldsReady ? belongingTo(draft, counted ? counted.data : queried) : null;
  const pending = counted ? counted.pending : settledSpec.moving || settledFields.moving || countQuery.isFetching;
  const counting = fieldsReady && spec !== null && pending;
  const createState = fieldsReady ? audienceCreateState({ spec, pending, count }) : audienceCreateState({ spec: null, pending, count });
  const recipients = createState.ready && spec && count ? recipientsOf(spec, count) : null;

  const reloadCounted = counted?.reload;
  const recount = useCallback(() => {
    if (reloadCounted) reloadCounted();
    else void client.invalidateQueries({ queryKey: campaignAudienceCountRoot(workspaceId, channel) });
    void client.invalidateQueries({ queryKey: campaignAudienceLeadsRoot(workspaceId, channel) });
    void client.invalidateQueries({ queryKey: campaignAudienceMapRoot(workspaceId, channel) });
  }, [client, workspaceId, channel, reloadCounted]);

  const refreshList = useCallback(() => {
    if (draft.listId) void client.invalidateQueries({ queryKey: campaignAudienceListRoot(workspaceId, channel, draft.listId) });
    recount();
  }, [client, workspaceId, channel, draft.listId, recount]);

  const acceptList = useCallback(
    (preview: ListPreview) => {
      client.setQueryData(listPreviewKey(workspaceId, channel, preview.id, settledContext.settled), preview);
      setDraft((current) => ({ ...current, source: "list", listId: preview.id }));
    },
    [client, workspaceId, channel, settledContext.settled],
  );

  return {
    channel,
    fields,
    fieldsReady,
    draft,
    update,
    spec,
    countedSpec: fieldsReady ? settledSpec.settled : null,
    countedFields: settledFields.settled,
    context: settledContext.settled,
    count,
    countedAt: counted ? counted.updatedAt : countQuery.dataUpdatedAt,
    countError: counted ? counted.error : codedQueryError(countQuery.error),
    counting,
    preview: draft.listId ? (previewQuery.data ?? null) : null,
    previewError: codedQueryError(previewQuery.error),
    createState,
    recipients,
    recount,
    refreshList,
    acceptList,
  };
}
