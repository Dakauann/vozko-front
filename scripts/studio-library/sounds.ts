import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const OUT = resolve(import.meta.dir, "../../public/audio/studio");
const RATE = 44100;

interface Recipe {
  name: string;
  input: string[];
  filter: string;
}

const RECIPES: Recipe[] = [
  { name: "pop", input: ["-f", "lavfi", "-i", `aevalsrc='0.9*sin(2*PI*(170*t+21*(1-exp(-20*t))))*exp(-22*t)*min(1\\,t*400)':s=${RATE}:d=0.28`], filter: "afade=t=out:st=0.22:d=0.06" },
  { name: "click", input: ["-f", "lavfi", "-i", `aevalsrc='(0.7*sin(2*PI*2300*t)*exp(-110*t)+0.35*sin(2*PI*5200*t)*exp(-260*t))*min(1\\,t*2000)':s=${RATE}:d=0.12`], filter: "afade=t=out:st=0.09:d=0.03" },
  { name: "whoosh", input: ["-f", "lavfi", "-i", `anoisesrc=d=0.75:c=pink:r=${RATE}:a=0.9:s=7`], filter: "highpass=f=350,lowpass=f=3200,volume='pow(sin(PI*t/0.75)\\,2)':eval=frame,afade=t=out:st=0.6:d=0.15,volume=2.2" },
  { name: "ding", input: ["-f", "lavfi", "-i", `aevalsrc='(0.5*sin(2*PI*880*t)*exp(-3*t)+0.25*sin(2*PI*1760*t)*exp(-5*t)+0.12*sin(2*PI*2640*t)*exp(-8*t))*min(1\\,t*300)':s=${RATE}:d=1.4`], filter: "afade=t=out:st=1.2:d=0.2" },
];

function ffmpeg(args: string[]): void {
  const run = spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);
  if (run.status !== 0) throw new Error(`ffmpeg failed: ${run.stderr.toString()}`);
}

function durationMs(file: string): number {
  const run = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  if (run.status !== 0) throw new Error(`ffprobe failed: ${run.stderr.toString()}`);
  return Math.floor(Number(run.stdout.toString().trim()) * 1000);
}

mkdirSync(OUT, { recursive: true });
for (const recipe of RECIPES) {
  const file = resolve(OUT, `${recipe.name}.mp3`);
  ffmpeg([...recipe.input, "-af", recipe.filter, "-ac", "1", "-ar", String(RATE), "-c:a", "libmp3lame", "-b:a", "128k", file]);
  console.log(`${recipe.name}: ${durationMs(file)} ms`);
}
