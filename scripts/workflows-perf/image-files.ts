import { join } from "node:path";

import { ffmpeg } from "../studio-e2e/fixtures";
import { IMAGE_FIXTURE_SHAPE, largeFile, previewFile, VIDEO_FILE } from "./image-fixture";

const LARGE_IMAGE = { width: 2400, height: 3200 };
const PREVIEW_IMAGE = { width: 150, height: 200 };
const VIDEO_SIZE = "1080x1920";
const PALETTES = [
  ["0x1f6feb", "0xf0b429", "0x0b1f33"],
  ["0xd1495b", "0xedae49", "0x00798c"],
  ["0x2e294e", "0xefbcd5", "0x8661c1"],
  ["0x0a8754", "0xf2f5ea", "0x1c3144"],
];

export function writeImageFixtures(dir: string): void {
  for (let n = 1; n <= IMAGE_FIXTURE_SHAPE.largeImages; n++) {
    const [c0, c1, c2] = PALETTES[n % PALETTES.length];
    const source = `gradients=s=${LARGE_IMAGE.width}x${LARGE_IMAGE.height}:seed=${n}:c0=${c0}:c1=${c1}:c2=${c2},drawgrid=w=300:h=160:t=6:c=white@0.8,noise=alls=10:allf=t`;
    ffmpeg(["-f", "lavfi", "-i", source, "-frames:v", "1", "-q:v", "4", join(dir, largeFile(n))]);
  }
  for (let n = 1; n <= IMAGE_FIXTURE_SHAPE.previews; n++) {
    ffmpeg(["-i", join(dir, largeFile(n)), "-vf", `scale=${PREVIEW_IMAGE.width}:${PREVIEW_IMAGE.height}`, "-q:v", "6", join(dir, previewFile(n))]);
  }
  ffmpeg(["-f", "lavfi", "-i", `testsrc2=s=${VIDEO_SIZE}:r=30:d=3`, "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-movflags", "+faststart", join(dir, VIDEO_FILE)]);
}
