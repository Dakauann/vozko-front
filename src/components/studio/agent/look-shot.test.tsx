import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import { createLookShots, LOOK_SHOT_LIMIT, type LookShots } from "./look-shots";
import { LookShotPeek, SHOT_VISIBLE_MS } from "./look-shot";

const BOARD = "data:image/jpeg;base64,Qk9BUkQ=";
const MOMENTS = "data:image/jpeg;base64,TU9NRU5UUw==";

function show(shots: LookShots, reduceMotion = false) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <LookShotPeek shots={shots} anchor="[data-missing-anchor]" reduceMotion={reduceMotion} />
    </NextIntlClientProvider>,
  );
}

const thumbnail = () => screen.queryByRole("button", { name: /Ampliar o que a Elo viu/ });

afterEach(() => {
  vi.useRealTimers();
});

describe("the picture Elo saw", () => {
  it("stays out of the way until she looks", () => {
    const { container } = show(createLookShots());
    expect(thumbnail()).toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });

  it("shows the exact image she received, then fades away on its own", () => {
    vi.useFakeTimers();
    const shots = createLookShots();
    show(shots);
    act(() => shots.add(BOARD, { kind: "artboard", artboardId: "ab-2", n: 2 }));
    const button = thumbnail();
    expect(button).not.toBeNull();
    expect(button!.getAttribute("aria-label")).toBe("Ampliar o que a Elo viu: Prancheta 2");
    expect(button!.querySelector("img")!.getAttribute("src")).toBe(BOARD);
    act(() => vi.advanceTimersByTime(SHOT_VISIBLE_MS - 1));
    expect(thumbnail()).not.toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(thumbnail()).toBeNull();
  });

  it("waits while the pointer rests on it and fades once it leaves", () => {
    vi.useFakeTimers();
    const shots = createLookShots();
    show(shots);
    act(() => shots.add(BOARD, { kind: "artboards" }));
    fireEvent.pointerEnter(thumbnail()!);
    act(() => vi.advanceTimersByTime(SHOT_VISIBLE_MS * 3));
    expect(thumbnail()).not.toBeNull();
    fireEvent.pointerLeave(thumbnail()!);
    act(() => vi.advanceTimersByTime(SHOT_VISIBLE_MS));
    expect(thumbnail()).toBeNull();
  });

  it("comes back for each new look", () => {
    vi.useFakeTimers();
    const shots = createLookShots();
    show(shots);
    act(() => shots.add(BOARD, { kind: "artboards" }));
    act(() => vi.advanceTimersByTime(SHOT_VISIBLE_MS));
    expect(thumbnail()).toBeNull();
    act(() => shots.add(MOMENTS, { kind: "moments", fromMs: 3000, toMs: 5000 }));
    expect(thumbnail()!.getAttribute("aria-label")).toBe("Ampliar o que a Elo viu: 0:03 a 0:05");
  });

  it("opens full size in a dialog and lets the reader step through the last few looks", () => {
    const shots = createLookShots();
    show(shots, true);
    act(() => shots.add(BOARD, { kind: "artboard", artboardId: "ab-2", n: 2, name: "Capa" }));
    act(() => shots.add(MOMENTS, { kind: "moments", fromMs: 3000, toMs: 5000 }));
    fireEvent.click(thumbnail()!);
    const dialog = screen.getByRole("dialog", { name: "O que a Elo viu" });
    expect(within(dialog).getByText("A mesma imagem enviada para a Elo: 0:03 a 0:05")).toBeTruthy();
    expect(within(dialog).getByRole("img", { name: "0:03 a 0:05" }).getAttribute("src")).toBe(MOMENTS);
    fireEvent.click(within(dialog).getByRole("button", { name: "Ver Capa" }));
    expect(within(dialog).getByRole("img", { name: "Capa" }).getAttribute("src")).toBe(BOARD);
    expect(within(dialog).getByRole("button", { name: "Ver Capa" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("never lists more looks than it keeps", () => {
    const shots = createLookShots();
    show(shots, true);
    for (let i = 0; i < LOOK_SHOT_LIMIT + 2; i++) act(() => shots.add(BOARD, { kind: "moments", fromMs: i * 1000, toMs: i * 1000 }));
    fireEvent.click(thumbnail()!);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByRole("button", { name: /^Ver / })).toHaveLength(LOOK_SHOT_LIMIT);
  });
});
