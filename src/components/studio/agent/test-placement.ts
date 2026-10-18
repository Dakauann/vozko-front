interface PlacedBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function placed(attribute: string, box: PlacedBox, parent: HTMLElement = document.body): HTMLElement {
  const element = document.createElement("div");
  element.setAttribute(attribute, "");
  element.getBoundingClientRect = () => ({ ...box, right: box.left + box.width, bottom: box.top + box.height, x: box.left, y: box.top, toJSON: () => box }) as DOMRect;
  parent.appendChild(element);
  return element;
}
