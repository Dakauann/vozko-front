export const DATA_CHANGED_EVENT = "vozko:data-changed";

interface DataChangedDetail {
  resource: string;
}

export function announceDataChanged(resource: string, target: EventTarget = window): void {
  if (!resource) return;
  target.dispatchEvent(new CustomEvent<DataChangedDetail>(DATA_CHANGED_EVENT, { detail: { resource } }));
}

export function onDataChanged(resource: string, listener: () => void, target: EventTarget = window): () => void {
  const handle = (event: Event) => {
    if ((event as CustomEvent<DataChangedDetail>).detail?.resource === resource) listener();
  };
  target.addEventListener(DATA_CHANGED_EVENT, handle);
  return () => target.removeEventListener(DATA_CHANGED_EVENT, handle);
}
