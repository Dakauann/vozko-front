import { spawnSync } from "node:child_process";
import { join } from "node:path";

export function ffmpeg(args: string[]): void {
  const run = spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);
  if (run.status !== 0) throw new Error(`ffmpeg failed: ${run.stderr.toString()}`);
}

export function writeFixtures(dir: string): void {
  ffmpeg(["-f", "lavfi", "-i", "color=c=0x996633:s=256x256", "-frames:v", "1", "-pix_fmt", "rgb24", join(dir, "swatch.png")]);
  ffmpeg(["-f", "lavfi", "-i", "color=c=0x00ff00:s=256x256", "-vf", "drawbox=x=96:y=64:w=64:h=128:color=0x996633:t=fill", "-frames:v", "1", "-pix_fmt", "rgb24", join(dir, "green-screen.png")]);
  ffmpeg(["-f", "lavfi", "-i", "testsrc2=s=640x360:r=30:d=4", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=4", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-g", "15", "-c:a", "aac", "-shortest", "-movflags", "+faststart", join(dir, "clip.mp4")]);
  ffmpeg(["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=3", "-c:a", "aac", "-b:a", "128k", join(dir, "tone.m4a")]);
}
