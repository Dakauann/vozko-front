/**
 * Surface depth in the Console identity.
 *
 * Depth here is CUT, not stacked: a surface reads as recessed into the panel
 * because it carries an engraved hairline and a darker top edge, not because it
 * floats on a soft drop shadow. These three constants are consumed across
 * elevated-design, so redefining them retires the old raised-card model at every
 * call site at once rather than editing each one.
 *
 * They are kept as named exports (rather than deleted) precisely so those call
 * sites keep compiling and keep resolving to the current system.
 */

/** An engraved hairline. The 1px inset top edge is the recess cue. */
export const softSurfaceShadow =
  "inset 0 1px 0 hsl(var(--rule-strong)), 0 1px 0 hsl(var(--card) / 0.6)";

/** Identical: the old variant existed only to add a raised inset highlight. */
export const softSurfaceWithInset = softSurfaceShadow;

/**
 * Hover does not lift. It deepens the cut, so this differs from the resting
 * state by edge contrast rather than by blur radius.
 */
export const softHoverShadow =
  "inset 0 1px 0 hsl(var(--rule-strong)), inset 0 0 0 1px hsl(var(--border))";
