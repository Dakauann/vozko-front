import { cn } from "@/lib/utils";

/**
 * The room light behind an identity surface.
 *
 * On the landing page the 3D scenes sit in a pool of light rather than inside a
 * frame: one soft wash in the brand green where the object stands, and a cooler
 * one at the far edge. It is the same idea as the trace ornament — periphery,
 * never information — and it belongs to the same places: empty states, auth
 * plates, the panel behind no data.
 *
 * This is NOT the glow the design system bans. There is no blur filter, no halo
 * on a control, and nothing sits behind text an operator reads for a shift: it
 * is a low-alpha gradient on the ground itself, at 5% in daylight and 8% on
 * graphite (`--pool-brand`), which is why it reads as ambient light rather than
 * as bloom.
 *
 * Place it as the FIRST child of a `relative` container and leave its siblings
 * `relative`, exactly like `CircuitBoard`. It deliberately does not use a
 * negative z-index: a host that paints its own background would swallow it.
 */
export function LightPool({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      style={{
        background: [
          "radial-gradient(58% 46% at 62% 48%, hsl(var(--primary) / var(--pool-brand)), transparent 72%)",
          "radial-gradient(38% 34% at 12% 78%, hsl(var(--info) / var(--pool-cool)), transparent 74%)",
        ].join(", "),
      }}
    />
  );
}
