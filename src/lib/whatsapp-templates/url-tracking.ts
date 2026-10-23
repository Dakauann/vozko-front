import type { DraggableComponent } from "@/components/whatsapp/DragDropBuilder";

const URL_BUTTON = "URL";

function buttonsOf(components: readonly DraggableComponent[]) {
  return components.find((component) => component.type === "BUTTONS")?.data.buttons ?? [];
}

export function trackedUrlButtons(components: readonly DraggableComponent[]): number[] {
  return buttonsOf(components).flatMap((button, index) => (button.type === URL_BUTTON && button.trackClicks ? [index] : []));
}

export function urlTrackingFields(components: readonly DraggableComponent[], always: boolean): { trackedUrlButtons?: number[] } {
  const tracked = trackedUrlButtons(components);
  return always || tracked.length > 0 ? { trackedUrlButtons: tracked } : {};
}

export function withTrackedUrls(components: DraggableComponent[], tracked: readonly number[]): DraggableComponent[] {
  const chosen = new Set(tracked);
  return components.map((component) => {
    if (component.type !== "BUTTONS" || !component.data.buttons) return component;
    const buttons = component.data.buttons.map((button, index) => {
      const restored = { ...button };
      delete restored.trackClicks;
      return button.type === URL_BUTTON && chosen.has(index) ? { ...restored, trackClicks: true } : restored;
    });
    return { ...component, data: { ...component.data, buttons } };
  });
}
