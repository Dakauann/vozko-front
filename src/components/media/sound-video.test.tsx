import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import { SoundVideo } from "./sound-video";

function renderVideo(props: Partial<Parameters<typeof SoundVideo>[0]> = {}) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <SoundVideo src="https://cdn.example.com/ad.mp4" {...props} />
    </NextIntlClientProvider>,
  );
}

describe("SoundVideo", () => {
  it("starts muted on its first frame with a visible sound toggle", () => {
    const { container } = renderVideo({ autoPlay: true });
    const video = container.querySelector("video") as HTMLVideoElement;
    expect(video.muted).toBe(true);
    expect(video.getAttribute("src")).toBe("https://cdn.example.com/ad.mp4#t=0.001");
    expect(video.getAttribute("preload")).toBe("metadata");
    expect(screen.getByRole("button", { name: ptMessages.mediaPlayer.unmute })).toHaveAttribute("aria-pressed", "false");
  });

  it("turns the sound on and off", () => {
    const { container } = renderVideo({ controls: true });
    const video = container.querySelector("video") as HTMLVideoElement;
    vi.spyOn(video, "play").mockResolvedValue(undefined);

    fireEvent.click(screen.getByRole("button", { name: ptMessages.mediaPlayer.unmute }));
    expect(video.muted).toBe(false);
    expect(video.play).toHaveBeenCalled();
    const toggle = screen.getByRole("button", { name: ptMessages.mediaPlayer.mute });
    expect(toggle).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(toggle);
    expect(video.muted).toBe(true);
  });

  it("follows the sound the viewer changes in the native controls", () => {
    const { container } = renderVideo({ controls: true });
    const video = container.querySelector("video") as HTMLVideoElement;
    video.muted = false;
    fireEvent(video, new Event("volumechange"));
    expect(screen.getByRole("button", { name: ptMessages.mediaPlayer.mute })).toBeTruthy();
  });
});
