const DTMF_ROWS = [697, 770, 852, 941] as const;
const DTMF_COLUMNS = [1209, 1336, 1477] as const;
const DTMF_LAYOUT = ["123", "456", "789", "*0#"] as const;

export type SoundCue = "message" | "callConnected" | "callEnded";

export function dtmfFrequencies(key: string): [number, number] | null {
    const row = DTMF_LAYOUT.findIndex((keys) => key.length === 1 && keys.includes(key));
    if (row < 0) return null;
    return [DTMF_ROWS[row], DTMF_COLUMNS[DTMF_LAYOUT[row].indexOf(key)]];
}

export type CallSoundStatus = "ringing" | "waiting_slot" | "answered" | "ended" | null;

export interface CallSoundState {
    status: CallSoundStatus;
    offered: boolean;
}

function live(status: CallSoundStatus): boolean {
    return status === "ringing" || status === "waiting_slot" || status === "answered";
}

export function callSoundCue(previous: CallSoundState, next: CallSoundState): { ring: boolean; cue: SoundCue | null } {
    const ring = next.offered && !live(next.status);
    if (next.status === "answered" && previous.status !== "answered") return { ring, cue: "callConnected" };
    if (next.status === "ended" && live(previous.status)) return { ring, cue: "callEnded" };
    return { ring, cue: null };
}
