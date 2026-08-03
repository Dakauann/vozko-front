/**
 * Which automation value the conversation header should trust.
 *
 * Three sources can answer, and they are not equally informed:
 *
 *  - the `conversation:subscribed` frame, read from the conversation's own row
 *    at subscribe time;
 *  - the cached inbox entry, which only covers the campaign currently listed;
 *  - whatever the previous render held.
 *
 * The subscribe handler consulted the cache first. That cache is campaign
 * scoped, so a Telegram or Instagram conversation is usually absent from it
 * entirely, the value resolved to null, null means "inherit", and a paused
 * conversation rendered as running. The write had landed, the server reported
 * it correctly, and every read denied it.
 *
 * So the server frame wins whenever it is present, and the cache is a fallback
 * for the frames that do not carry the field.
 */
export function resolveAutomationEnabled(
  fromFrame: boolean | null | undefined,
  fromInboxCache: boolean | null | undefined,
  previous: boolean | null | undefined = null,
): boolean | null {
  // `??` and not `||`: false is the meaningful value, and `||` would discard
  // exactly the state an operator just set.
  return fromFrame ?? fromInboxCache ?? previous ?? null;
}

/**
 * Whether the agent is answering this conversation.
 *
 * null is "inherit", which means the account-level switch decides and the
 * conversation is not individually paused, so it reads as active.
 */
export function isAutomationActive(value: boolean | null | undefined): boolean {
  return value !== false;
}
