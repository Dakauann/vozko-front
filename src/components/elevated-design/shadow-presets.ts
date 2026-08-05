/**
 * Surface depth.
 *
 * Depth is STACKED again, not cut. The outgoing identity resolved all three of
 * these to an inset hairline and a darker top edge, so a surface read as
 * recessed into a panel and nothing in the product ever floated. That model is
 * retired: these now point at the shared elevation stack in globals.css, where
 * each step is a tinted contact shadow plus a softer ambient one.
 *
 * They stay as named exports rather than being deleted precisely so the call
 * sites across elevated-design keep compiling and keep resolving to whatever
 * the current system says depth is — which is the reason a single edit here
 * moves all of them at once.
 */

/** A resting surface: the first step off the canvas. */
export const softSurfaceShadow = "var(--elev-1)";

/**
 * Kept identical. The old variant existed only to add an inset top highlight,
 * a raised-card cue this system does not use — its highlight token is still
 * defined as transparent so any hand-written string interpolating it stays
 * valid rather than invalidating the whole declaration.
 */
export const softSurfaceWithInset = softSurfaceShadow;

/**
 * Hover lifts rather than deepening a cut, so this differs from the resting
 * state by blur and spread instead of by edge contrast.
 */
export const softHoverShadow = "var(--elev-3)";
