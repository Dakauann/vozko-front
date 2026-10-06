const FIRST_FRAME_FRAGMENT = "#t=0.001";

export function firstFrameSrc(url: string): string {
  return url.includes("#") ? url : `${url}${FIRST_FRAME_FRAGMENT}`;
}
