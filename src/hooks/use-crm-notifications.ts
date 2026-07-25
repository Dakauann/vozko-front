"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getBrand } from "@/config/brand";


interface NotificationOptions {
    title: string;
    body: string;
    icon?: string;
    tag?: string;
    onClick?: () => void;
}

interface UseCrmNotificationsReturn {
    isMuted: boolean;
    toggleMute: () => void;
    setMuted: (muted: boolean) => void;
    playNotificationSound: () => void;
    playRingtone: () => void;
    stopRingtone: () => void;
    playOutgoingRingtone: () => void;
    stopOutgoingRingtone: () => void;
    showNotification: (options: NotificationOptions) => void;
    requestNotificationPermission: () => Promise<NotificationPermission>;
    notificationPermission: NotificationPermission | "default";
}


const MUTE_STORAGE_KEY = "crm_sound_muted";
const NOTIFICATION_SOUND_PATH = "/audio/NOTIFICATION.mp3";
const RINGTONE_SOUND_PATH = "/audio/RINGING.mp3";
const OUTGOING_RINGTONE_PATH = "/audio/RINGING_OUTGOING.mp3";


export function useCrmNotifications(): UseCrmNotificationsReturn {
    const [isMuted, setIsMuted] = useState(false);
    const [hasLoadedMutePreference, setHasLoadedMutePreference] = useState(false);

    const [notificationPermission, setNotificationPermission] = useState<
        NotificationPermission | "default"
    >("default");

    const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
    const ringtoneAudioRef = useRef<HTMLAudioElement | null>(null);
    const outgoingRingtoneAudioRef = useRef<HTMLAudioElement | null>(null);
    const outgoingRingtoneIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const userInteractedRef = useRef(false);

    useEffect(() => {
        if (typeof window === "undefined") return;

        try {
            const stored = localStorage.getItem(MUTE_STORAGE_KEY);
            if (stored === "true") {
                setIsMuted(true);
            } else if (stored === "false") {
                setIsMuted(false);
            }
        } catch {
            // Ignore storage access failures and keep the default state.
        } finally {
            setHasLoadedMutePreference(true);
        }

        notificationAudioRef.current = new Audio(NOTIFICATION_SOUND_PATH);
        notificationAudioRef.current.preload = "auto";
        notificationAudioRef.current.volume = 0.7;

        ringtoneAudioRef.current = new Audio(RINGTONE_SOUND_PATH);
        ringtoneAudioRef.current.preload = "auto";
        ringtoneAudioRef.current.loop = true;
        ringtoneAudioRef.current.volume = 0.8;

        outgoingRingtoneAudioRef.current = new Audio(OUTGOING_RINGTONE_PATH);
        outgoingRingtoneAudioRef.current.preload = "auto";
        outgoingRingtoneAudioRef.current.loop = false; 
        outgoingRingtoneAudioRef.current.volume = 0.7;

        if ("Notification" in window) {
            requestAnimationFrame(() => {
                setNotificationPermission(Notification.permission);
            });
        }

        const handleInteraction = () => {
            userInteractedRef.current = true;
            if (notificationAudioRef.current) {
                notificationAudioRef.current.volume = 0;
                notificationAudioRef.current.play().then(() => {
                    notificationAudioRef.current?.pause();
                    notificationAudioRef.current!.currentTime = 0;
                    notificationAudioRef.current!.volume = 0.7;
                }).catch(() => { });
            }
        };

        const events = ["click", "touchstart", "keydown"];
        events.forEach((event) => {
            document.addEventListener(event, handleInteraction, { once: true });
        });

        return () => {
            events.forEach((event) => {
                document.removeEventListener(event, handleInteraction);
            });
            notificationAudioRef.current?.pause();
            ringtoneAudioRef.current?.pause();
            outgoingRingtoneAudioRef.current?.pause();
            if (outgoingRingtoneIntervalRef.current) {
                clearInterval(outgoingRingtoneIntervalRef.current);
            }
            notificationAudioRef.current = null;
            ringtoneAudioRef.current = null;
            outgoingRingtoneAudioRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;

        if (!hasLoadedMutePreference) return;

        try {
            localStorage.setItem(MUTE_STORAGE_KEY, String(isMuted));
        } catch {
            // Ignore storage access failures.
        }
    }, [hasLoadedMutePreference, isMuted]);

    const toggleMute = useCallback(() => {
        setIsMuted((prev) => !prev);
    }, []);

    const setMuted = useCallback((muted: boolean) => {
        setIsMuted(muted);
    }, []);

    const playNotificationSound = useCallback(() => {
        if (isMuted || !notificationAudioRef.current) return;

        const audio = notificationAudioRef.current;

        audio.currentTime = 0;
        audio.play().catch((err) => {
            console.warn("[CrmNotifications] Could not play notification sound:", err.message);
        });
    }, [isMuted]);

    const playRingtone = useCallback(() => {
        if (isMuted || !ringtoneAudioRef.current) return;

        const audio = ringtoneAudioRef.current;
        audio.currentTime = 0;
        audio.play().catch((err) => {
            console.warn("[CrmNotifications] Could not play ringtone:", err.message);
        });
    }, [isMuted]);

    const stopRingtone = useCallback(() => {
        if (!ringtoneAudioRef.current) return;
        ringtoneAudioRef.current.pause();
        ringtoneAudioRef.current.currentTime = 0;
    }, []);

    const playOutgoingRingtone = useCallback(() => {
        if (isMuted || !outgoingRingtoneAudioRef.current) return;

        if (outgoingRingtoneIntervalRef.current) {
            clearInterval(outgoingRingtoneIntervalRef.current);
        }

        const audio = outgoingRingtoneAudioRef.current;

        audio.currentTime = 0;
        audio.play().catch((err) => {
            console.warn("[CrmNotifications] Could not play outgoing ringtone:", err.message);
        });

        outgoingRingtoneIntervalRef.current = setInterval(() => {
            if (outgoingRingtoneAudioRef.current && !isMuted) {
                outgoingRingtoneAudioRef.current.currentTime = 0;
                outgoingRingtoneAudioRef.current.play().catch(() => { });
            }
        }, 4000);
    }, [isMuted]);

    const stopOutgoingRingtone = useCallback(() => {
        if (outgoingRingtoneIntervalRef.current) {
            clearInterval(outgoingRingtoneIntervalRef.current);
            outgoingRingtoneIntervalRef.current = null;
        }
        if (!outgoingRingtoneAudioRef.current) return;
        outgoingRingtoneAudioRef.current.pause();
        outgoingRingtoneAudioRef.current.currentTime = 0;
    }, []);

    const requestNotificationPermission = useCallback(async () => {
        if (!("Notification" in window)) {
            return "denied" as NotificationPermission;
        }

        if (Notification.permission === "granted") {
            return "granted";
        }

        if (Notification.permission === "denied") {
            return "denied";
        }

        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
        return permission;
    }, []);

    const showNotification = useCallback(
        ({ title, body, icon, tag, onClick }: NotificationOptions) => {
            if (!("Notification" in window)) return;
            if (Notification.permission !== "granted") return;

            if (document.hasFocus()) return;

            try {
                const notification = new Notification(title, {
                    body,
                    icon: icon || getBrand().logo.mark,
                    tag: tag || "crm-message",
                    badge: getBrand().logo.mark,
                    requireInteraction: false,
                    silent: true, // We handle sound ourselves
                });

                if (onClick) {
                    notification.onclick = () => {
                        onClick();
                        window.focus();
                        notification.close();
                    };
                }

                setTimeout(() => {
                    notification.close();
                }, 5000);
            } catch (err) {
                console.warn("[CrmNotifications] Could not show notification:", err);
            }
        },
        [],
    );

    return {
        isMuted,
        toggleMute,
        setMuted,
        playNotificationSound,
        playRingtone,
        stopRingtone,
        playOutgoingRingtone,
        stopOutgoingRingtone,
        showNotification,
        requestNotificationPermission,
        notificationPermission,
    };
}
