"use client";

import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

import type { Keyframes } from "@/lib/studio/keyframes";

const DISMISSED_KEY = "vozko.studio.keyframeCoach.dismissed";

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    window.localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    return;
  }
}

interface KeyframeUiState {
  coachOpen: boolean;
  clipboard: Keyframes | null;
}

const uiStore = createStore<KeyframeUiState>()(() => ({ coachOpen: false, clipboard: null }));

export function useKeyframeUi<T>(selector: (state: KeyframeUiState) => T): T {
  return useStore(uiStore, selector);
}

export function noteMomentClick() {
  if (!uiStore.getState().coachOpen && !readDismissed()) uiStore.setState({ coachOpen: true });
}

export function openCoach() {
  uiStore.setState({ coachOpen: true });
}

export function dismissCoach() {
  writeDismissed();
  uiStore.setState({ coachOpen: false });
}

export function setKeyframeClipboard(keyframes: Keyframes) {
  uiStore.setState({ clipboard: keyframes });
}

export function keyframeClipboard(): Keyframes | null {
  return uiStore.getState().clipboard;
}
