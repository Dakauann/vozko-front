import { describe, expect, it } from "vitest";

import { appendDialKey, callOutcome, dialerErrorCode, isDialable, microphoneErrorCode, DIAL_KEYS } from "./dial-string";

describe("dial string", () => {
  it("accepts what the trunk can dial and nothing else", () => {
    for (const value of ["+55 (11) 99999-0000", "1001", "*100#", "011 4003.1234"]) {
      expect(isDialable(value)).toBe(true);
    }
    for (const value of ["", "   ", "+", "abc", "100@evil.example", "12+34", "1;user=phone"]) {
      expect(isDialable(value)).toBe(false);
    }
  });

  it("appends keypad keys and caps the length", () => {
    expect(appendDialKey("11", "9")).toBe("119");
    expect(appendDialKey("", "+")).toBe("+");
    expect(appendDialKey("1", "+")).toBe("1");
    expect(appendDialKey("9".repeat(32), "1")).toBe("9".repeat(32));
    expect(DIAL_KEYS).toHaveLength(12);
  });

  it("maps server end reasons to a known outcome", () => {
    expect(callOutcome("busy")).toBe("busy");
    expect(callOutcome("no_answer")).toBe("no_answer");
    expect(callOutcome("insufficient_balance")).toBe("insufficient_balance");
    expect(callOutcome("connection_lost")).toBe("connection_lost");
    expect(callOutcome("something_new")).toBe("ended");
    expect(callOutcome(undefined)).toBe("ended");
  });

  it("knows the refusals the dialer explains in the member's language", () => {
    for (const code of ["lead_not_dialable", "lead_blocked", "number_required", "call_service_offline", "already_in_call", "call_list_item_unavailable"]) {
      expect(dialerErrorCode(code)).toBe(code);
    }
    expect(dialerErrorCode("something_new")).toBeNull();
    expect(dialerErrorCode(null)).toBeNull();
  });

  it("names why the browser would not hand over the microphone", () => {
    const cases = [
      { failure: "NotAllowedError", want: "microphone_denied" },
      { failure: "PermissionDeniedError", want: "microphone_denied" },
      { failure: "SecurityError", want: "microphone_denied" },
      { failure: "NotFoundError", want: "microphone_not_found" },
      { failure: "DevicesNotFoundError", want: "microphone_not_found" },
      { failure: "OverconstrainedError", want: "microphone_not_found" },
      { failure: "NotReadableError", want: "microphone_busy" },
      { failure: "TrackStartError", want: "microphone_busy" },
      { failure: "AbortError", want: "microphone_busy" },
      { failure: "NotSupportedError", want: "call_audio_unsupported" },
      { failure: "TypeError", want: "microphone_failed" },
    ];
    for (const { failure, want } of cases) {
      expect(microphoneErrorCode(new DOMException("browser words", failure)), failure).toBe(want);
      expect(dialerErrorCode(want)).toBe(want);
    }
    expect(microphoneErrorCode("not an error")).toBe("microphone_failed");
    expect(microphoneErrorCode(null)).toBe("microphone_failed");
    expect(dialerErrorCode("microphone_unsupported")).toBe("microphone_unsupported");
  });
});
