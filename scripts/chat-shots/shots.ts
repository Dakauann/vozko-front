import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { navigate, ROOT, withHarness } from "../studio-perf/harness";

const HERE = import.meta.dir;
const READY = "Boolean(window.harness && window.harness.ready())";
const SETTLE_MS = 900;
const HEIGHT = 860;
const VIEWS = ["tester-waiting", "tester-error", "team"];
const THEMES = ["light", "dark"];
const WIDTHS = [{ name: "phone", px: 390 }, { name: "desktop", px: 560 }];

const out = process.argv[2];
const label = process.argv[3] ?? "shot";
if (!out) throw new Error("usage: bun scripts/chat-shots/shots.ts <output dir> [label]");
mkdirSync(out, { recursive: true });

const stubs = join(HERE, "team-chat-stubs.ts");

await withHarness(
  async ({ page }) => {
    for (const width of WIDTHS) {
      await page.send("Emulation.setDeviceMetricsOverride", { width: width.px, height: HEIGHT, deviceScaleFactor: 1, mobile: false });
      for (const view of VIEWS) {
        for (const theme of THEMES) {
          await navigate(page, `/?view=${view}&theme=${theme}&width=${width.px}`, READY);
          await Bun.sleep(SETTLE_MS);
          const { data } = (await page.send("Page.captureScreenshot", { format: "png" })) as { data: string };
          const file = join(out, `${label}-${view}-${theme}-${width.name}.png`);
          writeFileSync(file, Buffer.from(data, "base64"));
          console.log(file);
          await page.evaluate("document.querySelectorAll('.overflow-y-auto').forEach((el) => { el.scrollTop = 0; })");
          await Bun.sleep(SETTLE_MS);
          const top = (await page.send("Page.captureScreenshot", { format: "png" })) as { data: string };
          writeFileSync(join(out, `${label}-${view}-${theme}-${width.name}-top.png`), Buffer.from(top.data, "base64"));
        }
      }
    }
  },
  {
    entry: join(HERE, "page.ts"),
    ready: READY,
    fixtures: (dir) => copyFileSync(join(ROOT, "public/images/hero-robot.png"), join(dir, "folheto.png")),
    modules: {
      "@/hooks/use-team-chat": stubs,
      "@/hooks/use-team-chat-messages": stubs,
      "@/hooks/use-team-chat-scheduled": stubs,
      "@/hooks/use-team-chat-typing": stubs,
    },
  },
);
