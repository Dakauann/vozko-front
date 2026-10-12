import { join } from "node:path";

import { ffmpeg } from "../studio-e2e/fixtures";
import { HEAVY_ASSETS } from "./heavy-document";

const { header, portrait, dragon, cutout } = HEAVY_ASSETS;

function photo(size: { width: number; height: number }, source: string, file: string): void {
  ffmpeg(["-f", "lavfi", "-i", `${source}=s=${size.width}x${size.height}`, "-vf", "noise=alls=24:allf=t", "-frames:v", "1", "-q:v", "3", file]);
}

export function writeHeavyFixtures(dir: string): void {
  photo(header, "testsrc2", join(dir, header.file));
  photo(portrait, "mandelbrot", join(dir, portrait.file));
  ffmpeg(["-f", "lavfi", "-i", `gradients=s=${dragon.width}x${dragon.height}:c0=0x401010:c1=0xd08030:c2=0x102040:n=3`, "-vf", "noise=alls=12:allf=t", "-frames:v", "1", "-pix_fmt", "rgb24", join(dir, dragon.file)]);
  const radius = Math.round(cutout.width * 0.45);
  ffmpeg(["-f", "lavfi", "-i", `testsrc2=s=${cutout.width}x${cutout.height}`, "-vf", `format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lt(hypot(X-W/2,Y-H/2),${radius}),255,0)'`, "-frames:v", "1", join(dir, cutout.file)]);
}
