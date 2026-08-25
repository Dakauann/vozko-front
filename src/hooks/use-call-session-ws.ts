"use client";

import type {
    IncomingCallOffer,
    IncomingCallPayload,
} from "@/lib/call-session/inbound-call-types";
import {
    WS_EVENT_INCOMING_CALL,
    WS_EVENT_INCOMING_CALL_ACCEPT,
    WS_EVENT_INCOMING_CALL_DECLINE,
} from "@/lib/call-session/inbound-call-types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ConnectionStatus } from "@/lib/conversations/types";
import { hasUserDataCookie } from "@/lib/auth/client-cookies";
import {
    createReconnectController,
    type ReconnectController,
} from "@/lib/ws/reconnect";
import { toast } from "sonner";
import { useDepartment } from "@/contexts/department-context";
import { useWorkspace } from "@/contexts/workspace-context";

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4000";
const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 30000;

const WS_EVENT_CALL_SESSION_PRESENCE = "call-session:presence" as const;

export type CallSessionStatus = "ringing" | "answered" | "waiting_slot" | "ended";

export interface StartCallOptions {
    whatsAppPhoneId?: string;
}

export interface CallSessionState {
    callId?: string;
    phoneNumber: string;
    status: CallSessionStatus;
    reason?: string;
    durationSeconds?: number;
    requestId?: string;
    answeredAt?: number;
}

interface CallSessionPresenceUser {
    user_id: string;
    username?: string;
    busy: boolean;
}

interface CallSessionPresencePayload {
    users: CallSessionPresenceUser[];
}

// Live presence of a workspace member on the call session. `busy` reflects an
// active call (or a busy-while-ringing reservation); members with no active
// session are absent from the roster (offline).
export interface CallSessionPresenceEntry {
    userId: string;
    username?: string;
    busy: boolean;
}

interface UseCallSessionWsOptions {
    token: string | null;
    enabled?: boolean;
}

interface UseCallSessionWsReturn {
    status: ConnectionStatus;
    callState: CallSessionState | null;
    lastError: string | null;
    startCall: (phoneNumber: string, options?: StartCallOptions) => void;
    endCall: () => void;
    clearError: () => void;

    // Inbound WhatsApp calls still need to be answerable.
    incomingCall: IncomingCallOffer | null;
    acceptIncomingCall: (offerId: string) => void;
    declineIncomingCall: (offerId: string, reason?: string) => void;
    selfUserId: string;
}

type CallSessionServerEvent =
    | { type: "conversation:connected"; payload: Record<string, unknown> }
    | {
        type: "call:waiting_slot";
        payload: {
            reason?: string;
        };
    }
    | {
        type: "call:status";
        payload: {
            status?: string;
            reason?: string;
            call_id?: string;
            phone_number?: string;
            request_id?: string;
        };
    }
    | {
        type: "call:audio";
        payload: {
            audio: string;
            sample_rate?: number;
        };
    }
    | {
        type: "call:ended";
        payload: {
            reason?: string;
            call_id?: string;
            phone_number?: string;
            duration_seconds?: number;
            request_id?: string;
        };
    }
    | {
        type: "conversation:error";
        payload: {
            code?: string;
            message?: string;
        };
    }
    | { type: typeof WS_EVENT_INCOMING_CALL; payload: IncomingCallPayload }
    | { type: typeof WS_EVENT_CALL_SESSION_PRESENCE; payload: CallSessionPresencePayload };

const CALL_SAMPLE_RATE = 8000;

export function useCallSessionWs({
    token,
    enabled = true,
}: UseCallSessionWsOptions): UseCallSessionWsReturn {
    const { currentWorkspace } = useWorkspace();
    const { currentDepartment } = useDepartment();

    const workspaceId = currentWorkspace?.id ?? "";
    const departmentId = currentDepartment?.id ?? "";
    const scopeKey = `${workspaceId}:${departmentId}`;

    const [status, setStatus] = useState<ConnectionStatus>("disconnected");
    const [callState, setCallState] = useState<CallSessionState | null>(null);
    const [lastError, setLastError] = useState<string | null>(null);

    const [incomingCall, setIncomingCall] = useState<IncomingCallOffer | null>(null);
    const [presence, setPresence] = useState<CallSessionPresenceEntry[]>([]);
    const [selfUserId, setSelfUserId] = useState<string>("");

    const selfUserIdRef = useRef<string>("");

    const wsRef = useRef<WebSocket | null>(null);
    const connectRef = useRef<(() => void) | null>(null);
    const controllerRef = useRef<ReconnectController | null>(null);
    const clearCallStateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const intentionalDisconnectRef = useRef(false);
    const isConnectingRef = useRef(false);
    const prevScopeRef = useRef(scopeKey);

    const micStreamRef = useRef<MediaStream | null>(null);
    const captureContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const playbackContextRef = useRef<AudioContext | null>(null);
    const nextPlayTimeRef = useRef(0);
    const micStartedRef = useRef(false);

    const paramsRef = useRef({
        token,
        enabled,
        workspaceId,
        departmentId,
    });

    useEffect(() => {
        paramsRef.current = {
            token,
            enabled,
            workspaceId,
            departmentId,
        };
    }, [token, enabled, workspaceId, departmentId]);

    // One reconnect controller for the socket's whole lifetime: infinite capped
    // backoff + reconnect-on-visibility/online, gated by shouldReconnect so we
    // never loop while disabled or logged out.
    if (controllerRef.current === null) {
        controllerRef.current = createReconnectController({
            connect: () => connectRef.current?.(),
            shouldReconnect: () =>
                paramsRef.current.enabled &&
                !intentionalDisconnectRef.current &&
                hasUserDataCookie(),
            baseDelayMs: RECONNECT_BASE_DELAY,
            maxDelayMs: RECONNECT_MAX_DELAY,
        });
    }

    useEffect(() => {
        if (prevScopeRef.current !== scopeKey) {
            setCallState(null);
            setLastError(null);
            // Presence is workspace-scoped; drop the stale roster so a switch
            // doesn't briefly show the previous workspace's team.
            setPresence([]);
        }
        prevScopeRef.current = scopeKey;
    }, [scopeKey]);

    const clearError = useCallback(() => {
        setLastError(null);
    }, []);

    const send = useCallback((type: string, payload: Record<string, unknown>) => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
            return;
        }
        wsRef.current.send(JSON.stringify({ type, payload }));
    }, []);

    const stopAudioPipeline = useCallback(() => {
        micStartedRef.current = false;
        if (scriptProcessorRef.current) {
            try {
                scriptProcessorRef.current.disconnect();
            } catch {
                /* ignore */
            }
            scriptProcessorRef.current = null;
        }
        if (captureContextRef.current && captureContextRef.current.state !== "closed") {
            captureContextRef.current.close().catch(() => {
                /* ignore */
            });
        }
        captureContextRef.current = null;
        if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach((t) => t.stop());
            micStreamRef.current = null;
        }
        if (playbackContextRef.current && playbackContextRef.current.state !== "closed") {
            playbackContextRef.current.close().catch(() => {
                /* ignore */
            });
        }
        playbackContextRef.current = null;
        nextPlayTimeRef.current = 0;
    }, []);

    const startMicCapture = useCallback(async (): Promise<boolean> => {
        if (micStartedRef.current) return true;
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
            const message = "Microphone not available in this browser.";
            setLastError(message);
            toast.error(message);
            return false;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: CALL_SAMPLE_RATE,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });
            micStreamRef.current = stream;

            const ctx = new AudioContext({ sampleRate: CALL_SAMPLE_RATE });
            captureContextRef.current = ctx;
            if (ctx.sampleRate !== CALL_SAMPLE_RATE) {
                const message = `Call audio must run at ${CALL_SAMPLE_RATE} Hz PCM16, but the browser opened ${ctx.sampleRate} Hz.`;
                setLastError(message);
                toast.error(message);
                stopAudioPipeline();
                return false;
            }
            const source = ctx.createMediaStreamSource(stream);

            const processor = ctx.createScriptProcessor(1024, 1, 1);
            scriptProcessorRef.current = processor;

            processor.onaudioprocess = (e) => {
                if (wsRef.current?.readyState !== WebSocket.OPEN) return;
                const input = e.inputBuffer.getChannelData(0);
                const pcm16 = new Int16Array(input.length);
                for (let i = 0; i < input.length; i++) {
                    const s = Math.max(-1, Math.min(1, input[i]));
                    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
                }
                const bytes = new Uint8Array(pcm16.buffer);
                let binary = "";
                for (let i = 0; i < bytes.length; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                const b64 = btoa(binary);
                send("call_audio", { audio: b64, sample_rate: ctx.sampleRate });
            };

            source.connect(processor);
            processor.connect(ctx.destination);
            micStartedRef.current = true;
            return true;
        } catch (err) {
            console.error("[CallSessionWS] Microphone access error:", err);
            const message =
                err instanceof Error && err.name === "NotAllowedError"
                    ? "Microphone permission denied. Allow access to make calls."
                    : "Microphone access failed. Cannot start call audio.";
            setLastError(message);
            toast.error(message);
            stopAudioPipeline();
            return false;
        }
    }, [send, stopAudioPipeline]);

    const clearEndedCallAfterDelay = useCallback(() => {
        if (clearCallStateTimerRef.current) {
            clearTimeout(clearCallStateTimerRef.current);
            clearCallStateTimerRef.current = null;
        }

        clearCallStateTimerRef.current = setTimeout(() => {
            setCallState((prev) => (prev?.status === "ended" ? null : prev));
            clearCallStateTimerRef.current = null;
        }, 3000);
    }, []);

    const handleServerEvent = useCallback(
        (event: CallSessionServerEvent) => {
            if (event.type === "conversation:connected") {
                setStatus("connected");
                const uid = event.payload?.user_id;
                if (typeof uid === "string" && uid.length > 0) {
                    selfUserIdRef.current = uid;
                    setSelfUserId(uid);
                }
                return;
            }

            if (event.type === WS_EVENT_CALL_SESSION_PRESENCE) {
                setPresence(
                    event.payload.users.map((u) => ({
                        userId: u.user_id,
                        username: u.username,
                        busy: u.busy,
                    })),
                );
                return;
            }

            if (event.type === "call:waiting_slot") {
                setCallState((prev) => {
                    if (!prev) {
                        return {
                            phoneNumber: "",
                            status: "waiting_slot",
                            reason: event.payload.reason,
                        };
                    }
                    return {
                        ...prev,
                        status: "waiting_slot",
                        reason: event.payload.reason,
                    };
                });
                return;
            }

            if (event.type === "call:status") {
                const wsStatus = event.payload.status;
                if (wsStatus !== "ringing" && wsStatus !== "answered" && wsStatus !== "waiting_slot") {
                    return;
                }

                setCallState((prev) => {
                    const base: CallSessionState =
                        prev ??
                        ({
                            phoneNumber: event.payload.phone_number ?? "",
                            status: wsStatus,
                            requestId: event.payload.request_id,
                        } as CallSessionState);

                    return {
                        ...base,
                        callId: event.payload.call_id ?? base.callId,
                        phoneNumber: event.payload.phone_number ?? base.phoneNumber,
                        requestId: event.payload.request_id ?? base.requestId,
                        reason: event.payload.reason ?? base.reason,
                        status: wsStatus,
                        ...(wsStatus === "answered" ? { answeredAt: Date.now() } : {}),
                    };
                });
                return;
            }

            if (event.type === "call:audio") {
                const { audio, sample_rate } = event.payload;
                if (!audio) return;
                try {
                    const sampleRate = sample_rate || CALL_SAMPLE_RATE;
                    if (
                        !playbackContextRef.current ||
                        playbackContextRef.current.state === "closed"
                    ) {
                        playbackContextRef.current = new AudioContext({ sampleRate });
                        nextPlayTimeRef.current = 0;
                    }
                    const ctx = playbackContextRef.current;
                    const raw = atob(audio);
                    const bytes = new Uint8Array(raw.length);
                    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
                    const int16 = new Int16Array(bytes.buffer);
                    const float32 = new Float32Array(int16.length);
                    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;

                    const buffer = ctx.createBuffer(1, float32.length, sampleRate);
                    buffer.copyToChannel(float32, 0);
                    const source = ctx.createBufferSource();
                    source.buffer = buffer;
                    source.connect(ctx.destination);

                    const now = ctx.currentTime;
                    const startTime = Math.max(now, nextPlayTimeRef.current);
                    source.start(startTime);
                    nextPlayTimeRef.current = startTime + buffer.duration;
                } catch (err) {
                    console.error("[CallSessionWS] Audio playback error:", err);
                }
                return;
            }

            if (event.type === "call:ended") {
                stopAudioPipeline();
                setCallState((prev) => ({
                    callId: event.payload.call_id ?? prev?.callId,
                    phoneNumber: event.payload.phone_number ?? prev?.phoneNumber ?? "",
                    requestId: event.payload.request_id ?? prev?.requestId,
                    status: "ended",
                    reason: event.payload.reason,
                    durationSeconds:
                        typeof event.payload.duration_seconds === "number"
                            ? Math.max(0, Math.round(event.payload.duration_seconds))
                            : prev?.durationSeconds,
                    answeredAt: prev?.answeredAt,
                }));
                clearEndedCallAfterDelay();
                return;
            }

            if (event.type === "conversation:error") {
                const message = event.payload.message || "Call connection error.";
                setLastError(message);
                toast.error(message);
                stopAudioPipeline();
                setCallState(null);
                setIncomingCall(null);
                return;
            }

            if (event.type === WS_EVENT_INCOMING_CALL) {
                setIncomingCall({
                    offerId: event.payload.offer_id,
                    callId: event.payload.call_id,
                    workspaceId: event.payload.workspace_id,
                    fromNumber: event.payload.from_number,
                    toNumber: event.payload.to_number,
                    channel: event.payload.channel,
                    expiresAt: event.payload.expires_at,
                    receivedAt: Date.now(),
                });
                return;
            }
        },
        [clearEndedCallAfterDelay, stopAudioPipeline],
    );

    const connect = useCallback(async () => {
        const current = paramsRef.current;
        if (!current.enabled || !current.workspaceId) {
            return;
        }

        if (isConnectingRef.current) return;
        if (wsRef.current?.readyState === WebSocket.OPEN) return;
        if (wsRef.current?.readyState === WebSocket.CONNECTING) return;

        isConnectingRef.current = true;
        intentionalDisconnectRef.current = false;
        setStatus("connecting");

        const previousSocket = wsRef.current;
        if (previousSocket) {
            try {
                previousSocket.onclose = null;
                previousSocket.onerror = null;
                previousSocket.onmessage = null;
                previousSocket.onopen = null;
                if (
                    previousSocket.readyState === WebSocket.OPEN ||
                    previousSocket.readyState === WebSocket.CONNECTING
                ) {
                    previousSocket.close();
                }
            } catch {
                // Ignore socket cleanup errors during reconnect attempts.
            }
            wsRef.current = null;
        }

        // Auth rides the httpOnly cookie on the WS handshake (the browser
        // attaches it same-site); we no longer put the access token in the URL.
        // `current.token` is used only as a presence gate for whether the app
        // believes it is logged in.
        if (!current.token) {
            isConnectingRef.current = false;
            setStatus("disconnected");
            return;
        }
        // Bail if a later connect/disconnect superseded this attempt.
        if (intentionalDisconnectRef.current || !paramsRef.current.enabled) {
            isConnectingRef.current = false;
            return;
        }

        const params = new URLSearchParams();
        params.set("workspaceId", current.workspaceId);
        if (current.departmentId) {
            params.set("departmentId", current.departmentId);
        }

        const ws = new WebSocket(`${WS_BASE_URL}/ws/call-session?${params.toString()}`);
        wsRef.current = ws;

        ws.onopen = () => {
            isConnectingRef.current = false;
            setStatus("connected");

            // Reset backoff only after the connection has stayed up a while, so
            // a flapping socket doesn't reset to the base delay every cycle.
            const stableTimer = setTimeout(() => {
                controllerRef.current?.resetBackoff();
            }, 5000);
            ws.addEventListener("close", () => clearTimeout(stableTimer), { once: true });
        };

        ws.onmessage = (event) => {
            const raw = event.data as string;
            const chunks = raw.split("\n").filter((value) => value.trim());

            for (const chunk of chunks) {
                try {
                    const payload = JSON.parse(chunk) as CallSessionServerEvent;
                    handleServerEvent(payload);
                } catch (err) {
                    console.error("[CallSessionWS] Parse error:", err);
                }
            }
        };

        ws.onerror = () => {
            isConnectingRef.current = false;
            setStatus("error");
        };

        ws.onclose = () => {
            isConnectingRef.current = false;
            if (wsRef.current !== ws) {
                return;
            }

            setStatus("disconnected");
            wsRef.current = null;

            // The controller decides whether/when to retry (infinite capped
            // backoff, gated by shouldReconnect).
            controllerRef.current?.scheduleReconnect();
        };
    }, [handleServerEvent]);

    useEffect(() => {
        connectRef.current = connect;
    }, [connect]);

    const disconnect = useCallback(() => {
        intentionalDisconnectRef.current = true;
        isConnectingRef.current = false;

        stopAudioPipeline();

        controllerRef.current?.stop();

        if (wsRef.current) {
            const ws = wsRef.current;
            ws.onclose = null;
            ws.onerror = null;
            ws.onmessage = null;
            ws.onopen = null;

            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close();
            }

            wsRef.current = null;
        }

        setStatus("disconnected");
        setIncomingCall(null);
    }, [stopAudioPipeline]);

    // The socket's lifecycle is tied to the ACCOUNT and scope, NOT to the access
    // token string. A token refresh happens every few minutes (POST /auth/refresh)
    // and changes `token`; if the socket were torn down on every refresh, the old
    // session's Shutdown would HANG UP the agent's live call and the reconnect would
    // create a fresh session that owns nothing (the frontend then shows a call the
    // backend no longer has: "call no longer exists" on end, and the agent still
    // gets rung while "busy"). So we key the effect on a stable presence boolean
    // that flips only on login/logout, and read the freshest token from paramsRef
    // inside connect(). This is why the conversation socket stays up and the call
    // socket used to churn.
    const hasToken = !!token;
    useEffect(() => {
        if (enabled && hasToken && workspaceId) {
            // Attach visibility/online reconnect listeners for the socket's life.
            controllerRef.current?.start();
            const timer = setTimeout(() => {
                connect();
            }, 50);

            return () => {
                clearTimeout(timer);
                disconnect();
            };
        }

        disconnect();
        return;
    }, [enabled, hasToken, workspaceId, departmentId, connect, disconnect]);

    useEffect(() => {
        return () => {
            if (clearCallStateTimerRef.current) {
                clearTimeout(clearCallStateTimerRef.current);
                clearCallStateTimerRef.current = null;
            }
            setIncomingCall(null);
            stopAudioPipeline();
        };
    }, [stopAudioPipeline]);

    const startCall = useCallback(
        (phoneNumber: string, options?: StartCallOptions) => {
            const { whatsAppPhoneId } = options ?? {};
            const target = phoneNumber.trim();
            if (!target) {
                const message = "Phone number is required.";
                setLastError(message);
                toast.error(message);
                return;
            }

            if (wsRef.current?.readyState !== WebSocket.OPEN) {
                const message = "Calling is offline. Reconnecting...";
                setLastError(message);
                toast.error(message);
                return;
            }

            if (callState && callState.status !== "ended") {
                const message = "You already have an active call.";
                setLastError(message);
                toast.error(message);
                return;
            }

            const requestId = crypto.randomUUID();

            setLastError(null);
            setCallState({
                phoneNumber: target,
                status: "ringing",
                requestId,
            });

            send("start_call", {
                phone_number: target,
                request_id: requestId,
                ...(whatsAppPhoneId ? { whatsapp_phone_id: whatsAppPhoneId } : {}),
            });

            void startMicCapture().then((ok) => {
                if (!ok && wsRef.current?.readyState === WebSocket.OPEN) {
                    send("end_call", { request_id: requestId });
                }
            });
        },
        [callState, send, startMicCapture],
    );

    const endCall = useCallback(() => {
        stopAudioPipeline();
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
            return;
        }
        send("end_call", { request_id: crypto.randomUUID() });
    }, [send, stopAudioPipeline]);

    const acceptIncomingCall = useCallback(
        (offerId: string) => {
            if (wsRef.current?.readyState !== WebSocket.OPEN) return;
            if (callState && callState.status !== "ended") {
                toast.error("Você já está em uma chamada.");
                return;
            }
            const offer = incomingCall?.offerId === offerId ? incomingCall : null;
            void startMicCapture().then((ok) => {
                if (!ok) {
                    send(WS_EVENT_INCOMING_CALL_DECLINE, {
                        offer_id: offerId,
                        reason: "microphone_unavailable",
                    });
                    setIncomingCall((prev) => (prev?.offerId === offerId ? null : prev));
                    return;
                }
                send(WS_EVENT_INCOMING_CALL_ACCEPT, { offer_id: offerId });
                setIncomingCall((prev) => (prev?.offerId === offerId ? null : prev));
                setCallState({
                    callId: offer?.callId,
                    phoneNumber: offer?.fromNumber ?? "",
                    status: "answered",
                    answeredAt: Date.now(),
                    requestId: offerId,
                });
            });
        },
        [callState, incomingCall, send, startMicCapture],
    );

    const declineIncomingCall = useCallback(
        (offerId: string, reason?: string) => {
            if (wsRef.current?.readyState !== WebSocket.OPEN) return;
            send(WS_EVENT_INCOMING_CALL_DECLINE, {
                offer_id: offerId,
                ...(reason ? { reason } : {}),
            });
            setIncomingCall((prev) => (prev?.offerId === offerId ? null : prev));
        },
        [send],
    );

    return useMemo(
        () => ({
            status,
            callState,
            lastError,
            startCall,
            endCall,
            clearError,
            presence,
            selfUserId,
            incomingCall,
            acceptIncomingCall,
            declineIncomingCall,
        }),
        [
            status,
            callState,
            lastError,
            startCall,
            endCall,
            clearError,
            presence,
            selfUserId,
            incomingCall,
            acceptIncomingCall,
            declineIncomingCall,
        ],
    );
}
