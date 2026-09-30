"use client";

import { useCallback, useEffect, useState } from "react";

import { getBrand } from "@/config/brand";
import { setMessageSoundsMuted, useMessageSoundsMuted } from "@/lib/sounds/message-sound-preference";

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
    showNotification: (options: NotificationOptions) => void;
    requestNotificationPermission: () => Promise<NotificationPermission>;
    notificationPermission: NotificationPermission | "default";
}

export function useCrmNotifications(): UseCrmNotificationsReturn {
    const isMuted = useMessageSoundsMuted();
    const [notificationPermission, setNotificationPermission] = useState<
        NotificationPermission | "default"
    >("default");

    useEffect(() => {
        if (!("Notification" in window)) return;
        const frame = requestAnimationFrame(() => {
            setNotificationPermission(Notification.permission);
        });
        return () => cancelAnimationFrame(frame);
    }, []);

    const toggleMute = useCallback(() => {
        setMessageSoundsMuted(!isMuted);
    }, [isMuted]);

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
                    silent: true,
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
        setMuted: setMessageSoundsMuted,
        showNotification,
        requestNotificationPermission,
        notificationPermission,
    };
}
