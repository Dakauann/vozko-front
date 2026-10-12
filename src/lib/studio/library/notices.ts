import { ART_NOTICES } from "./sets/art/notices";
import { SET_NOTICES } from "./sets/data/notices";
import type { SetNotice } from "./sets/format";
import { THREE_D_NOTICES } from "./sets/three-d/notices";

export const LIBRARY_NOTICES: readonly SetNotice[] = [...SET_NOTICES, ...ART_NOTICES, ...THREE_D_NOTICES];
