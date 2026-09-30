import { describe, expect, it } from "vitest";

import { receivesCalls, type SipTrunk } from "@/lib/sip-trunks/types";

const trunk = (trunkType: SipTrunk["trunkType"]) => ({ trunkType }) as SipTrunk;

describe("receivesCalls", () => {
  it("lets inbound and two-way trunks answer calls, never outbound-only ones", () => {
    expect(receivesCalls(trunk("INBOUND"))).toBe(true);
    expect(receivesCalls(trunk("BIDIRECTIONAL"))).toBe(true);
    expect(receivesCalls(trunk("OUTBOUND"))).toBe(false);
  });
});
