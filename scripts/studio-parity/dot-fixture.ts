export const DOT_FILE = "dot.mp4";
export const DOT_SIZE = { width: 640, height: 360 } as const;
export const DOT_PATCH = 32;
export const DOT_FRAMES = 60;
export const DOT_FPS = 30;

export function dotArgs(out: string): string[] {
  const seconds = DOT_FRAMES / DOT_FPS;
  const dot = "geq=lum='255*exp(-((X-15.5)*(X-15.5)+(Y-15.5)*(Y-15.5))/40)':cb=128:cr=128";
  return [
    "-f", "lavfi", "-i", `color=c=black:s=${DOT_SIZE.width}x${DOT_SIZE.height}:r=${DOT_FPS}:d=${seconds}`,
    "-f", "lavfi", "-i", `color=c=black:s=${DOT_PATCH}x${DOT_PATCH}:r=${DOT_FPS}:d=${seconds}`,
    "-filter_complex", `[1]format=yuv444p,${dot}[dot];[0][dot]overlay=x='100+4*n':y='120+2*round(15*sin(n/8))':format=yuv444,format=yuv420p`,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "10", "-g", "15", "-movflags", "+faststart", out,
  ];
}
