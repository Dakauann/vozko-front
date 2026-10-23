import { ChatText, Clock, Megaphone, Prohibit, Receipt } from "@/components/icons";

import type { ExplainerArea } from "./types";

export const workflowExplainers = {
  carrierMarketing: {
    icon: Megaphone,
    scene: {
      kind: "compare",
      off: { label: "off", rows: [{ icon: Receipt, label: "service" }, { icon: ChatText, label: "always" }] },
      on: { label: "on", rows: [{ icon: Prohibit, label: "optOut" }, { icon: Clock, label: "hours" }] },
    },
    steps: 3,
  },
} satisfies ExplainerArea;
