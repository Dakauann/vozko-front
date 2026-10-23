import { Archive, CheckCircle, NotePencil, Prohibit, Robot, Table } from "@/components/icons";

import type { ExplainerArea } from "./types";

export const sheetExplainers = {
  requiredColumn: {
    icon: NotePencil,
    scene: {
      kind: "compare",
      off: { label: "off", rows: [{ icon: CheckCircle, label: "blank" }, { icon: Table, label: "written" }] },
      on: { label: "on", rows: [{ icon: Robot, label: "asks" }, { icon: Prohibit, label: "refused" }] },
    },
    steps: 2,
  },
  archivedColumn: {
    icon: Archive,
    scene: {
      kind: "compare",
      off: { label: "off", rows: [{ icon: Robot, label: "filled" }, { icon: Table, label: "kept" }] },
      on: { label: "on", rows: [{ icon: Prohibit, label: "skipped" }, { icon: Table, label: "history" }] },
    },
    steps: 3,
  },
} satisfies ExplainerArea;
