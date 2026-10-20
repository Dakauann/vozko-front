export const EDGE_TAB_WIDTH = "2.25rem";

export interface EdgeRailRegistry {
  enter: () => void;
  leave: () => void;
}

export function createEdgeRailRegistry(apply: (width: string) => void): EdgeRailRegistry {
  let tabs = 0;
  const publish = () => apply(tabs > 0 ? EDGE_TAB_WIDTH : "0px");
  return {
    enter: () => {
      tabs += 1;
      publish();
    },
    leave: () => {
      tabs = Math.max(0, tabs - 1);
      publish();
    },
  };
}
