import { afterEach, describe, expect, it, vi } from "vitest";

import { desktopAlertsAllowed, enableDesktopAlerts, setDesktopAlertsOff } from "./desktop-preference";

function installNotification(permission: NotificationPermission, answer: NotificationPermission = permission) {
  const fake = { permission, requestPermission: vi.fn(() => Promise.resolve(answer)) };
  vi.stubGlobal("Notification", fake);
  return fake;
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("desktop alerts", () => {
  it("are allowed only with the browser permission and without the person turning them off", () => {
    installNotification("granted");
    expect(desktopAlertsAllowed()).toBe(true);
    setDesktopAlertsOff(true);
    expect(desktopAlertsAllowed()).toBe(false);
    installNotification("denied");
    setDesktopAlertsOff(false);
    expect(desktopAlertsAllowed()).toBe(false);
  });

  it("asks the browser only while the answer is still open", async () => {
    const open = installNotification("default", "granted");
    expect(await enableDesktopAlerts()).toBe("granted");
    expect(open.requestPermission).toHaveBeenCalledTimes(1);
    const blocked = installNotification("denied");
    expect(await enableDesktopAlerts()).toBe("denied");
    expect(blocked.requestPermission).not.toHaveBeenCalled();
  });

  it("is unsupported without the Notification API", async () => {
    vi.stubGlobal("Notification", undefined);
    expect(desktopAlertsAllowed()).toBe(false);
    expect(await enableDesktopAlerts()).toBe("unsupported");
  });
});
