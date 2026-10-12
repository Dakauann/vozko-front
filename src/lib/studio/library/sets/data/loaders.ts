export const ICON_INDEX = () => import("./icon-index");
export const ICON_CHUNK_SIZE = {"regular":390,"thin":363,"light":363,"bold":391,"fill":447,"duotone":314} as const;
export const ICON_CHUNKS = {
  regular: [() => import("./icons-regular-0"), () => import("./icons-regular-1"), () => import("./icons-regular-2"), () => import("./icons-regular-3")],
  thin: [() => import("./icons-thin-0"), () => import("./icons-thin-1"), () => import("./icons-thin-2"), () => import("./icons-thin-3"), () => import("./icons-thin-4")],
  light: [() => import("./icons-light-0"), () => import("./icons-light-1"), () => import("./icons-light-2"), () => import("./icons-light-3"), () => import("./icons-light-4")],
  bold: [() => import("./icons-bold-0"), () => import("./icons-bold-1"), () => import("./icons-bold-2"), () => import("./icons-bold-3")],
  fill: [() => import("./icons-fill-0"), () => import("./icons-fill-1"), () => import("./icons-fill-2"), () => import("./icons-fill-3")],
  duotone: [() => import("./icons-duotone-0"), () => import("./icons-duotone-1"), () => import("./icons-duotone-2"), () => import("./icons-duotone-3"), () => import("./icons-duotone-4")],
} as const;
export const EMOJI_INDEX = () => import("./emoji-index");
export const EMOJI_CHUNKS = [() => import("./emoji-0"), () => import("./emoji-1"), () => import("./emoji-2"), () => import("./emoji-3"), () => import("./emoji-4"), () => import("./emoji-5"), () => import("./emoji-6"), () => import("./emoji-7"), () => import("./emoji-8"), () => import("./emoji-9"), () => import("./emoji-10"), () => import("./emoji-11"), () => import("./emoji-12"), () => import("./emoji-13"), () => import("./emoji-14"), () => import("./emoji-15"), () => import("./emoji-16"), () => import("./emoji-17"), () => import("./emoji-18"), () => import("./emoji-19"), () => import("./emoji-20"), () => import("./emoji-21"), () => import("./emoji-22"), () => import("./emoji-23"), () => import("./emoji-24"), () => import("./emoji-25"), () => import("./emoji-26"), () => import("./emoji-27"), () => import("./emoji-28"), () => import("./emoji-29")] as const;
