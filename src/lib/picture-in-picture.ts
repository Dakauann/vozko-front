export interface PictureInPictureSize {
  width: number;
  height: number;
}

interface DocumentPictureInPicture {
  requestWindow(options: PictureInPictureSize): Promise<Window>;
}

type PictureInPictureHost = Window & {
  documentPictureInPicture?: DocumentPictureInPicture;
};

const STYLESHEET_SELECTOR = 'style, link[rel="stylesheet"]';

function documentPictureInPictureOf(host: Window) {
  return (host as PictureInPictureHost).documentPictureInPicture ?? null;
}

export function supportsDocumentPictureInPicture(host: Window): boolean {
  return documentPictureInPictureOf(host) !== null;
}

export async function requestPictureInPictureWindow(
  host: Window,
  size: PictureInPictureSize,
): Promise<Window> {
  const api = documentPictureInPictureOf(host);
  if (!api) {
    throw new Error("Document picture-in-picture is not available");
  }
  return api.requestWindow(size);
}

export function setWindowTitle(target: Window, title: string) {
  target.document.title = title;
}

function copyAttributes(from: Element, to: Element) {
  for (const { name } of [...to.attributes]) {
    if (!from.hasAttribute(name)) to.removeAttribute(name);
  }
  for (const { name, value } of [...from.attributes]) {
    if (to.getAttribute(name) !== value) to.setAttribute(name, value);
  }
}

export function mirrorDocumentAppearance(
  source: Document,
  target: Document,
): () => void {
  const copies = new Map<Element, Element>();

  const syncStylesheets = () => {
    const current = new Set(source.head.querySelectorAll(STYLESHEET_SELECTOR));

    for (const [original, copy] of copies) {
      if (current.has(original)) continue;
      copy.remove();
      copies.delete(original);
    }

    for (const original of current) {
      const copy = copies.get(original);
      if (!copy) {
        const created = target.importNode(original, true);
        target.head.appendChild(created);
        copies.set(original, created);
      } else if (copy.textContent !== original.textContent) {
        copy.textContent = original.textContent;
      }
    }
  };

  const syncRoots = () => {
    copyAttributes(source.documentElement, target.documentElement);
    target.body.className = source.body.className;
  };

  syncStylesheets();
  syncRoots();

  const headObserver = new MutationObserver(syncStylesheets);
  headObserver.observe(source.head, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  const rootObserver = new MutationObserver(syncRoots);
  rootObserver.observe(source.documentElement, { attributes: true });
  rootObserver.observe(source.body, {
    attributes: true,
    attributeFilter: ["class"],
  });

  return () => {
    headObserver.disconnect();
    rootObserver.disconnect();
  };
}
