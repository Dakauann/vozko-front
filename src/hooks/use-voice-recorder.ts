"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toWav from "audiobuffer-to-wav";

import { microphoneErrorCode } from "@/lib/dialer/dial-string";

const LEVEL_HISTORY = 50;

export type VoiceRecorderErrorCode =
  | "microphone_unsupported"
  | "microphone_denied"
  | "microphone_not_found"
  | "microphone_busy"
  | "microphone_failed"
  | "recording_unsupported"
  | "recording_empty";

async function convertBlobToWav(blob: Blob): Promise<File> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new AudioContext();
  try {
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const wavBuffer = toWav(audioBuffer);
    const wavBlob = new Blob([wavBuffer], { type: "audio/wav" });
    return new File([wavBlob], "audio-message.wav", { type: "audio/wav" });
  } finally {
    await audioCtx.close();
  }
}

function supportedMimeType(): string {
  if (MediaRecorder.isTypeSupported("audio/webm; codecs=opus")) return "audio/webm; codecs=opus";
  if (MediaRecorder.isTypeSupported("audio/ogg; codecs=opus")) return "audio/ogg; codecs=opus";
  return "audio/mp4";
}

function rawRecordingFile(blob: Blob, mimeType: string): File {
  const extension = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "m4a" : "webm";
  return new File([blob], `audio-message.${extension}`, { type: mimeType });
}

function recordingSupported(): boolean {
  return typeof MediaRecorder !== "undefined" && typeof AudioContext !== "undefined";
}

function microphoneReachable(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function";
}

function failureCode(failure: unknown): VoiceRecorderErrorCode {
  const code = microphoneErrorCode(failure);
  return code === "call_audio_unsupported" ? "recording_unsupported" : code;
}

interface VoiceRecorderOptions {
  onError?: (code: VoiceRecorderErrorCode) => void;
}

export function useVoiceRecorder(onRecorded: (file: File) => void, options: VoiceRecorderOptions = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [error, setError] = useState<VoiceRecorderErrorCode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const attemptRef = useRef(0);
  const mountedRef = useRef(true);
  const onRecordedRef = useRef(onRecorded);
  const onErrorRef = useRef(options.onError);

  useEffect(() => {
    onRecordedRef.current = onRecorded;
    onErrorRef.current = options.onError;
  }, [onRecorded, options.onError]);

  const stopMeters = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  const releaseMicrophone = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const closeAnalyser = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    analyserRef.current = null;
    const audioCtx = audioCtxRef.current;
    audioCtxRef.current = null;
    if (audioCtx && audioCtx.state !== "closed") void audioCtx.close().catch(() => undefined);
  }, []);

  const fail = useCallback((code: VoiceRecorderErrorCode) => {
    if (!mountedRef.current) return;
    setError(code);
    onErrorRef.current?.(code);
  }, []);

  const abandonRecorder = useCallback(() => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder?.state === "recording") {
      recorder.onstop = null;
      recorder.stop();
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      attemptRef.current += 1;
      stopMeters();
      abandonRecorder();
      closeAnalyser();
      releaseMicrophone();
    };
  }, [abandonRecorder, closeAnalyser, releaseMicrophone, stopMeters]);

  const start = useCallback(async () => {
    if (recorderRef.current?.state === "recording") return;
    const attempt = ++attemptRef.current;
    setError(null);
    if (!microphoneReachable()) {
      fail("microphone_unsupported");
      return;
    }
    if (!recordingSupported()) {
      fail("recording_unsupported");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (failure) {
      if (attempt === attemptRef.current) fail(failureCode(failure));
      return;
    }
    if (attempt !== attemptRef.current || !mountedRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    streamRef.current = stream;

    try {
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      audioCtx.createMediaStreamSource(stream).connect(analyser);
      analyserRef.current = analyser;

      const mimeType = supportedMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      recorder.onstop = async () => {
        if (recorderRef.current === recorder) recorderRef.current = null;
        closeAnalyser();
        releaseMicrophone();

        const rawBlob = new Blob(chunks, { type: mimeType });
        if (rawBlob.size === 0) {
          fail("recording_empty");
          return;
        }
        let file: File;
        try {
          file = await convertBlobToWav(rawBlob);
        } catch {
          file = rawRecordingFile(rawBlob, mimeType);
        }
        if (mountedRef.current) onRecordedRef.current(file);
      };

      const samples = new Uint8Array(analyser.frequencyBinCount);
      const sampleLevels = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(samples);
        const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
        setLevels((previous) => [...previous, Math.min(average / 128, 1)].slice(-LEVEL_HISTORY));
        frameRef.current = requestAnimationFrame(sampleLevels);
      };

      recorder.start();
      recorderRef.current = recorder;
      setIsRecording(true);
      setDuration(0);
      setLevels([]);
      sampleLevels();
      timerRef.current = setInterval(() => setDuration((previous) => previous + 1), 1000);
    } catch (failure) {
      stopMeters();
      abandonRecorder();
      closeAnalyser();
      releaseMicrophone();
      setIsRecording(false);
      fail(failureCode(failure));
    }
  }, [abandonRecorder, closeAnalyser, fail, releaseMicrophone, stopMeters]);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    stopMeters();
    setIsRecording(false);
  }, [stopMeters]);

  const cancel = useCallback(() => {
    attemptRef.current += 1;
    abandonRecorder();
    stopMeters();
    closeAnalyser();
    releaseMicrophone();
    setIsRecording(false);
    setDuration(0);
    setLevels([]);
  }, [abandonRecorder, closeAnalyser, releaseMicrophone, stopMeters]);

  return { isRecording, duration, levels, error, start, stop, cancel };
}
