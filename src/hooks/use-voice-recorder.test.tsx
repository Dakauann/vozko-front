import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  FakeAudioContext,
  FakeMediaRecorder,
  grantedMicrophone,
  installFakeRecorder,
  refusedMicrophone,
} from "@/test/fake-media-recorder";
import { useVoiceRecorder } from "./use-voice-recorder";

function recorder() {
  const onRecorded = vi.fn();
  const onError = vi.fn();
  const hook = renderHook(() => useVoiceRecorder(onRecorded, { onError }));
  return { hook, onRecorded, onError };
}

beforeEach(() => {
  installFakeRecorder();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useVoiceRecorder", () => {
  it("hands over a WAV voice note and lets go of the microphone once stopped", async () => {
    const microphone = grantedMicrophone();
    const { hook, onRecorded } = recorder();

    await act(() => hook.result.current.start());
    expect(hook.result.current.isRecording).toBe(true);
    act(() => hook.result.current.stop());

    await waitFor(() => expect(onRecorded).toHaveBeenCalledTimes(1));
    const file = onRecorded.mock.calls[0][0] as File;
    expect(file.type).toBe("audio/wav");
    expect(file.name).toBe("audio-message.wav");
    expect(microphone.track.stop).toHaveBeenCalled();
    expect(hook.result.current.isRecording).toBe(false);
  });

  it("keeps the browser's own take when it cannot be turned into WAV", async () => {
    grantedMicrophone();
    FakeAudioContext.decodable = false;
    const { hook, onRecorded } = recorder();

    await act(() => hook.result.current.start());
    act(() => hook.result.current.stop());

    await waitFor(() => expect(onRecorded).toHaveBeenCalledTimes(1));
    const file = onRecorded.mock.calls[0][0] as File;
    expect(file.name).toBe("audio-message.webm");
    expect(file.type).toContain("audio/webm");
  });

  it.each([
    { failure: "NotAllowedError", code: "microphone_denied" },
    { failure: "SecurityError", code: "microphone_denied" },
    { failure: "NotFoundError", code: "microphone_not_found" },
    { failure: "NotReadableError", code: "microphone_busy" },
    { failure: "UnknownError", code: "microphone_failed" },
  ])("names a $failure as $code and records nothing", async ({ failure, code }) => {
    refusedMicrophone(failure);
    const { hook, onRecorded, onError } = recorder();

    await act(() => hook.result.current.start());

    expect(hook.result.current.error).toBe(code);
    expect(onError).toHaveBeenCalledWith(code);
    expect(hook.result.current.isRecording).toBe(false);
    expect(FakeMediaRecorder.instances).toHaveLength(0);
    expect(onRecorded).not.toHaveBeenCalled();
  });

  it("says the browser has no microphone access without asking for one", async () => {
    vi.stubGlobal("navigator", { ...globalThis.navigator, mediaDevices: undefined });
    const { hook, onError } = recorder();

    await act(() => hook.result.current.start());

    expect(hook.result.current.error).toBe("microphone_unsupported");
    expect(onError).toHaveBeenCalledWith("microphone_unsupported");
  });

  it("says the browser cannot record before asking for the microphone", async () => {
    const microphone = grantedMicrophone();
    vi.stubGlobal("MediaRecorder", undefined);
    const { hook } = recorder();

    await act(() => hook.result.current.start());

    expect(hook.result.current.error).toBe("recording_unsupported");
    expect(microphone.getUserMedia).not.toHaveBeenCalled();
  });

  it("lets go of a granted microphone when the recorder cannot start", async () => {
    const microphone = grantedMicrophone();
    FakeMediaRecorder.failConstruction = new DOMException("no codec", "NotSupportedError");
    const { hook } = recorder();

    await act(() => hook.result.current.start());

    expect(hook.result.current.error).toBe("recording_unsupported");
    expect(hook.result.current.isRecording).toBe(false);
    expect(microphone.track.stop).toHaveBeenCalled();
    expect(FakeAudioContext.instances.every((context) => context.closed)).toBe(true);
  });

  it("never starts a recording the page left while the permission prompt was open", async () => {
    const track = { stop: vi.fn() };
    let grant: (stream: MediaStream) => void = () => undefined;
    const getUserMedia = vi.fn(() => new Promise<MediaStream>((resolve) => (grant = resolve)));
    vi.stubGlobal("navigator", { ...globalThis.navigator, mediaDevices: { getUserMedia } });
    const { hook } = recorder();

    let started: Promise<void> = Promise.resolve();
    act(() => {
      started = hook.result.current.start();
    });
    hook.unmount();
    await act(async () => {
      grant({ getTracks: () => [track] } as unknown as MediaStream);
      await started;
    });

    expect(track.stop).toHaveBeenCalled();
    expect(FakeMediaRecorder.instances).toHaveLength(0);
  });

  it("drops a take that is cancelled and frees the microphone", async () => {
    const microphone = grantedMicrophone();
    const { hook, onRecorded } = recorder();

    await act(() => hook.result.current.start());
    act(() => hook.result.current.cancel());

    expect(hook.result.current.isRecording).toBe(false);
    expect(microphone.track.stop).toHaveBeenCalled();
    await act(async () => undefined);
    expect(onRecorded).not.toHaveBeenCalled();
  });

  it("refuses an empty take instead of attaching silence", async () => {
    grantedMicrophone();
    FakeMediaRecorder.nextChunk = new Blob([], { type: "audio/webm" });
    const { hook, onRecorded, onError } = recorder();

    await act(() => hook.result.current.start());
    act(() => hook.result.current.stop());

    await waitFor(() => expect(onError).toHaveBeenCalledWith("recording_empty"));
    expect(hook.result.current.error).toBe("recording_empty");
    expect(onRecorded).not.toHaveBeenCalled();
  });

  it("clears the last failure when a new recording starts", async () => {
    refusedMicrophone("NotAllowedError");
    const { hook } = recorder();
    await act(() => hook.result.current.start());
    expect(hook.result.current.error).toBe("microphone_denied");

    grantedMicrophone();
    await act(() => hook.result.current.start());

    expect(hook.result.current.error).toBeNull();
    expect(hook.result.current.isRecording).toBe(true);
  });

  it("stops recording and frees the microphone when the page goes away", async () => {
    const microphone = grantedMicrophone();
    const { hook, onRecorded } = recorder();

    await act(() => hook.result.current.start());
    const [active] = FakeMediaRecorder.instances;
    hook.unmount();

    expect(active.state).toBe("inactive");
    expect(microphone.track.stop).toHaveBeenCalled();
    expect(onRecorded).not.toHaveBeenCalled();
  });
});
