import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDocumentPictureInPicture } from "@/hooks/use-document-picture-in-picture";

const size = { width: 400, height: 600 };

function fakePictureWindow() {
  const target = new EventTarget();
  const pictureDocument = document.implementation.createHTMLDocument("pip");
  return Object.assign(target, {
    document: pictureDocument,
    close: vi.fn(() => target.dispatchEvent(new Event("pagehide"))),
  }) as unknown as Window & { close: ReturnType<typeof vi.fn> };
}

function installBrowserApi(requestWindow: () => Promise<Window>) {
  Object.defineProperty(window, "documentPictureInPicture", {
    configurable: true,
    value: { requestWindow: vi.fn(requestWindow) },
  });
}

afterEach(() => {
  Reflect.deleteProperty(window, "documentPictureInPicture");
});

describe("useDocumentPictureInPicture", () => {
  it("reports no support where the browser has none", () => {
    const { result } = renderHook(() => useDocumentPictureInPicture(vi.fn()));

    expect(result.current.supported).toBe(false);
  });

  it("stays in the page when the browser refuses the window", async () => {
    installBrowserApi(() => Promise.reject(new Error("NotAllowedError")));
    const { result } = renderHook(() => useDocumentPictureInPicture(vi.fn()));

    const onOpened = vi.fn();
    await act(async () => {
      await result.current.open(size, onOpened);
    });

    expect(onOpened).not.toHaveBeenCalled();
    expect(result.current.pictureWindow).toBeNull();
  });

  it("hands out the window the browser opened and says so", async () => {
    const pictureWindow = fakePictureWindow();
    installBrowserApi(() => Promise.resolve(pictureWindow));
    const { result } = renderHook(() => useDocumentPictureInPicture(vi.fn()));
    const onOpened = vi.fn();

    expect(result.current.supported).toBe(true);
    await act(async () => {
      await result.current.open(size, onOpened);
    });

    expect(result.current.pictureWindow).toBe(pictureWindow);
    expect(onOpened).toHaveBeenCalledTimes(1);
  });

  it("reports the window closing, however it was closed", async () => {
    const pictureWindow = fakePictureWindow();
    installBrowserApi(() => Promise.resolve(pictureWindow));
    const onClosed = vi.fn();
    const { result } = renderHook(() => useDocumentPictureInPicture(onClosed));
    await act(async () => {
      await result.current.open(size, vi.fn());
    });

    act(() => {
      pictureWindow.dispatchEvent(new Event("pagehide"));
    });

    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(result.current.pictureWindow).toBeNull();
  });

  it("does not report the new window closed when the replaced one goes", async () => {
    const first = fakePictureWindow();
    const second = fakePictureWindow();
    const windows = [first, second];
    installBrowserApi(() => Promise.resolve(windows.shift()!));
    const onClosed = vi.fn();
    const { result } = renderHook(() => useDocumentPictureInPicture(onClosed));
    await act(async () => {
      await result.current.open(size, vi.fn());
    });
    await act(async () => {
      await result.current.open(size, vi.fn());
    });

    act(() => {
      first.dispatchEvent(new Event("pagehide"));
    });

    expect(onClosed).not.toHaveBeenCalled();
    expect(result.current.pictureWindow).toBe(second);
  });

  it("closes the window when the page lets go of it", async () => {
    const pictureWindow = fakePictureWindow();
    installBrowserApi(() => Promise.resolve(pictureWindow));
    const onClosed = vi.fn();
    const { result, unmount } = renderHook(() =>
      useDocumentPictureInPicture(onClosed),
    );
    await act(async () => {
      await result.current.open(size, vi.fn());
    });

    unmount();

    expect(pictureWindow.close).toHaveBeenCalled();
    expect(onClosed).not.toHaveBeenCalled();
  });
});
