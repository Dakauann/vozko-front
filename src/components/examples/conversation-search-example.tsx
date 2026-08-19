
"use client";

import {
  createDebouncedSearch,
  extractMatchContext,
  formatSearchResultsCount,
  getActiveFilterLabels,
  highlightMatches,
  validateSearchQuery,
} from "@/lib/conversations/search";
import { useCallback, useEffect, useState } from "react";

import type { WsSearchInboxPayload } from "@/lib/conversations/types";
import { useConversationWs } from "@/hooks/use-conversation-ws";

interface ConversationSearchExampleProps {
  token: string;
  campaignId: string;
  campaignType: "voice" | "whatsapp";
}

export function ConversationSearchExample({
  token,
  campaignId,
  campaignType,
}: ConversationSearchExampleProps) {

  const {
    status,
    inbox,
    activeConversation,
    subscribe,
    searchInbox,
    clearSearch,
    searchResults,
    searching,
    searchTotalItems,
    searchTotalPages,
    searchPage,
    searchMessages,
    clearMessageSearch,
    messageSearchResults,
    searchingMessages,
    messageSearchTotalItems,
    messageSearchTotalPages,
    messageSearchPage,
    messageSearchQuery,
  } = useConversationWs({
    token,
    campaignId,
    campaignType,
    enabled: true,
  });


  const [inboxSearchQuery, setInboxSearchQuery] = useState("");
  const [inboxSearchFilters, setInboxSearchFilters] = useState<
    Omit<WsSearchInboxPayload, "query">
  >({});
  const [inboxSearchError, setInboxSearchError] = useState<string | null>(null);


  const [messageQuery, setMessageQuery] = useState("");
  const [messageSearchError, setMessageSearchError] = useState<string | null>(
    null,
  );


  const debouncedInboxSearch = useCallback(() => {
    const debouncer = createDebouncedSearch(
      (query: string, filters: Omit<WsSearchInboxPayload, "query">) => {
        const trimmed = query.trim();

        if (trimmed) {
          const error = validateSearchQuery(trimmed);
          if (error) {
            setInboxSearchError(error);
            return;
          }
        }

        setInboxSearchError(null);

        if (!trimmed && Object.keys(filters).length === 0) {
          clearSearch();
          return;
        }

        searchInbox({
          query: trimmed || undefined,
          ...filters,
          page: 1,
          page_size: 20,
        });
      },
      300,
    );

    return debouncer;
  }, [searchInbox, clearSearch]);

  const debouncedMessageSearch = useCallback(() => {
    const debouncer = createDebouncedSearch(
      (query: string, page: number = 1) => {
        const trimmed = query.trim();

        if (!trimmed) {
          clearMessageSearch();
          return;
        }

        const error = validateSearchQuery(trimmed);
        if (error) {
          setMessageSearchError(error);
          return;
        }

        setMessageSearchError(null);
        searchMessages(trimmed, page);
      },
      300,
    );

    return debouncer;
  }, [searchMessages, clearMessageSearch]);


  const handleInboxSearchInput = (query: string) => {
    setInboxSearchQuery(query);
    const debouncer = debouncedInboxSearch();
    debouncer.execute(query, inboxSearchFilters);
  };

  const handleInboxFilterChange = (
    filters: Omit<WsSearchInboxPayload, "query">,
  ) => {
    setInboxSearchFilters(filters);
    const debouncer = debouncedInboxSearch();
    debouncer.execute(inboxSearchQuery, filters);
  };

  const handleMessageSearchInput = (query: string) => {
    setMessageQuery(query);
    const debouncer = debouncedMessageSearch();
    debouncer.execute(query, 1);
  };

  const handleClearInboxSearch = () => {
    setInboxSearchQuery("");
    setInboxSearchFilters({});
    setInboxSearchError(null);
    clearSearch();
  };

  const handleClearMessageSearch = () => {
    setMessageQuery("");
    setMessageSearchError(null);
    clearMessageSearch();
  };


  const handleInboxSearchNextPage = () => {
    if (searchPage < searchTotalPages) {
      searchInbox({
        query: inboxSearchQuery || undefined,
        ...inboxSearchFilters,
        page: searchPage + 1,
        page_size: 20,
      });
    }
  };

  const handleInboxSearchPrevPage = () => {
    if (searchPage > 1) {
      searchInbox({
        query: inboxSearchQuery || undefined,
        ...inboxSearchFilters,
        page: searchPage - 1,
        page_size: 20,
      });
    }
  };

  const handleMessageSearchNextPage = () => {
    if (messageSearchPage < messageSearchTotalPages) {
      const debouncer = debouncedMessageSearch();
      debouncer.execute(messageQuery, messageSearchPage + 1);
    }
  };

  const handleMessageSearchPrevPage = () => {
    if (messageSearchPage > 1) {
      const debouncer = debouncedMessageSearch();
      debouncer.execute(messageQuery, messageSearchPage - 1);
    }
  };


  const renderHighlightedText = (text: string, query: string) => {
    const segments = highlightMatches(text, query);
    return (
      <span>
        {segments.map((segment, index) => (
          <span
            key={index}
            className={
              segment.isMatch
                ? "bg-muted dark:bg-warning font-semibold"
                : ""
            }
          >
            {segment.text}
          </span>
        ))}
      </span>
    );
  };

  const renderMessageContext = (text: string, query: string) => {
    const context = extractMatchContext(text, query, 40);
    if (!context) {
      return (
        <span className="text-muted-foreground">
          {text.substring(0, 100)}...
        </span>
      );
    }
    return (
      <span className="text-sm">
        <span className="text-muted-foreground">{context.before}</span>
        <span className="bg-muted dark:bg-warning font-semibold">
          {context.match}
        </span>
        <span className="text-muted-foreground">{context.after}</span>
      </span>
    );
  };


  const displayedInbox = searchResults || inbox;
  const isSearching = searching || searchingMessages;
  const activeFilters = getActiveFilterLabels({
    query: inboxSearchQuery,
    ...inboxSearchFilters,
  });

  return (
    <div className="flex h-screen">
      {/* ── Left Panel: Inbox with Search ─────────────────────────── */}
      <div className="w-1/3 border-r flex flex-col">
        {/* Connection Status */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                status === "connected"
                  ? "bg-healthy"
                  : status === "connecting"
                    ? "bg-warning"
                    : "bg-destructive"
              }`}
            />
            <span className="text-sm font-medium capitalize">{status}</span>
          </div>
        </div>

        {/* Inbox Search Bar */}
        <div className="p-4 border-b space-y-3">
          <div className="relative">
            <input
              type="text"
              value={inboxSearchQuery}
              onChange={(e) => handleInboxSearchInput(e.target.value)}
              placeholder="Search conversations..."
              className="w-full px-4 py-2 border rounded-lg pr-10"
              disabled={status !== "connected"}
            />
            {inboxSearchQuery && (
              <button
                onClick={handleClearInboxSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
              >
                ✕
              </button>
            )}
          </div>

          {/* Search Filters */}
          <div className="flex flex-wrap gap-2">
            <select
              value={inboxSearchFilters.stage_name || ""}
              onChange={(e) =>
                handleInboxFilterChange({
                  ...inboxSearchFilters,
                  stage_name: e.target.value || undefined,
                })
              }
              className="text-sm px-2 py-1 border rounded"
              disabled={status !== "connected"}
            >
              <option value="">All tags</option>
              <option value="recebido">Recebido</option>
              <option value="em atendimento">Em Atendimento</option>
              <option value="finalizado">Finalizado</option>
            </select>

            <select
              value={
                inboxSearchFilters.window_open === undefined
                  ? ""
                  : inboxSearchFilters.window_open
                    ? "open"
                    : "closed"
              }
              onChange={(e) =>
                handleInboxFilterChange({
                  ...inboxSearchFilters,
                  window_open:
                    e.target.value === ""
                      ? undefined
                      : e.target.value === "open",
                })
              }
              className="text-sm px-2 py-1 border rounded"
              disabled={status !== "connected"}
            >
              <option value="">All windows</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>

            <label className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={inboxSearchFilters.has_unread === true}
                onChange={(e) =>
                  handleInboxFilterChange({
                    ...inboxSearchFilters,
                    has_unread: e.target.checked ? true : undefined,
                  })
                }
                disabled={status !== "connected"}
              />
              Unread only
            </label>
          </div>

          {/* Active Filters Display */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((label, index) => (
                <span
                  key={index}
                  className="text-xs bg-muted text-info-ink px-2 py-1 rounded-full"
                >
                  {label}
                </span>
              ))}
            </div>
          )}

          {/* Search Error */}
          {inboxSearchError && (
            <div className="text-sm text-destructive-ink">{inboxSearchError}</div>
          )}

          {/* Search Status */}
          {searching && (
            <div className="text-sm text-muted-foreground">Searching...</div>
          )}
          {searchResults && !searching && (
            <div className="text-sm text-muted-foreground">
              {formatSearchResultsCount(searchTotalItems, searchPage, 20)}
            </div>
          )}
        </div>

        {/* Inbox List */}
        <div className="flex-1 overflow-y-auto">
          {displayedInbox.map((entry) => (
            <button
              key={`${entry.entry_type}-${entry.entry_id}`}
              onClick={() => subscribe(entry.entry_id, entry.entry_type)}
              className="w-full p-4 border-b hover:bg-muted hover:bg-muted text-left"
            >
              <div className="flex justify-between items-start mb-1">
                <div className="font-medium">
                  {renderHighlightedText(
                    entry.lead_name || entry.lead_number,
                    inboxSearchQuery,
                  )}
                </div>
                {entry.unread_count > 0 && (
                  <span className="bg-muted text-muted-foreground text-xs px-2 py-1 rounded-full">
                    {entry.unread_count}
                  </span>
                )}
              </div>
              <div className="text-sm text-muted-foreground truncate">
                {renderHighlightedText(
                  entry.last_message_preview,
                  inboxSearchQuery,
                )}
              </div>
              {entry.stage && (
                <div className="mt-2">
                  <span
                    className="text-xs px-2 py-1 rounded"
                    style={{ backgroundColor: entry.stage.color, color: "white" }}
                  >
                    {entry.stage.name}
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Pagination Controls */}
        {searchResults && searchTotalPages > 1 && (
          <div className="p-3 border-t flex justify-between items-center">
            <button
              onClick={handleInboxSearchPrevPage}
              disabled={searchPage === 1 || searching}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-muted-foreground">
              Page {searchPage} of {searchTotalPages}
            </span>
            <button
              onClick={handleInboxSearchNextPage}
              disabled={searchPage === searchTotalPages || searching}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* ── Right Panel: Conversation with Message Search ────────── */}
      <div className="flex-1 flex flex-col">
        {activeConversation ? (
          <>
            {/* Conversation Header with Message Search */}
            <div className="p-4 border-b space-y-3">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">
                  {activeConversation.lead_name ||
                    activeConversation.lead_number}
                </h2>
                {!activeConversation.window_open && (
                  <span className="text-xs bg-muted text-destructive-ink px-2 py-1 rounded">
                    Window Closed
                  </span>
                )}
              </div>

              {/* Message Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  value={messageQuery}
                  onChange={(e) => handleMessageSearchInput(e.target.value)}
                  placeholder="Search messages in this conversation..."
                  className="w-full px-4 py-2 border rounded-lg pr-10 text-sm"
                />
                {messageQuery && (
                  <button
                    onClick={handleClearMessageSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Message Search Error */}
              {messageSearchError && (
                <div className="text-sm text-destructive-ink">{messageSearchError}</div>
              )}

              {/* Message Search Status */}
              {searchingMessages && (
                <div className="text-sm text-muted-foreground">
                  Searching messages...
                </div>
              )}
              {messageSearchResults && !searchingMessages && (
                <div className="text-sm text-muted-foreground">
                  {formatSearchResultsCount(
                    messageSearchTotalItems,
                    messageSearchPage,
                    50,
                  )}
                </div>
              )}
            </div>

            {/* Message List or Search Results */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messageSearchResults
                ? 
                  messageSearchResults.map((message) => (
                    <div
                      key={message.id}
                      className="p-3 border rounded-lg bg-muted"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-sm">
                          {message.sender_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(message.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        {renderMessageContext(
                          message.text,
                          messageSearchQuery || "",
                        )}
                      </div>
                    </div>
                  ))
                : 
                  activeConversation.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`p-3 rounded-lg max-w-[70%] ${
                        message.message_type === "user_message"
                          ? "bg-muted text-muted-foreground ml-auto"
                          : "bg-border"
                      }`}
                    >
                      <div className="text-sm">{message.text}</div>
                      <div className="text-xs opacity-70 mt-1">
                        {new Date(message.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
            </div>

            {/* Message Search Pagination */}
            {messageSearchResults && messageSearchTotalPages > 1 && (
              <div className="p-3 border-t flex justify-between items-center">
                <button
                  onClick={handleMessageSearchPrevPage}
                  disabled={messageSearchPage === 1 || searchingMessages}
                  className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-muted-foreground">
                  Page {messageSearchPage} of {messageSearchTotalPages}
                </span>
                <button
                  onClick={handleMessageSearchNextPage}
                  disabled={
                    messageSearchPage === messageSearchTotalPages ||
                    searchingMessages
                  }
                  className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Select a conversation to view messages
          </div>
        )}
      </div>
    </div>
  );
}
