import { CheckCircle, EyeSlash, LockKey, NotePencil, Prohibit, ShieldCheck } from "@/components/icons";

import type { ExplainerArea } from "./types";

export const formExplainers = {
  required: {
    icon: NotePencil,
    scene: {
      kind: "compare",
      off: { label: "off", rows: [{ icon: CheckCircle, label: "skips" }, { icon: CheckCircle, label: "sends" }] },
      on: { label: "on", rows: [{ icon: NotePencil, label: "asks" }, { icon: Prohibit, label: "blocks" }] },
    },
    steps: 2,
  },
  sensitive: {
    icon: LockKey,
    scene: {
      kind: "compare",
      off: { label: "off", rows: [{ icon: CheckCircle, label: "shown" }, { icon: CheckCircle, label: "summary" }] },
      on: { label: "on", rows: [{ icon: EyeSlash, label: "masked" }, { icon: ShieldCheck, label: "permission" }] },
    },
    steps: 3,
    footnote: true,
  },
} satisfies ExplainerArea;
