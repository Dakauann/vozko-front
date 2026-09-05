"use client";

import { Html, RoundedBox } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import type { MotionValue } from "framer-motion";
import { useRef, type CSSProperties, type ReactNode } from "react";
import { MathUtils, type DirectionalLight, type MeshStandardMaterial } from "three";

/**
 * Shared material vocabulary for every landing scene. The kanban board set the
 * look (paper cards with a coloured edge, sitting on recessed boards); every
 * other stage inherits these values instead of restating them.
 *
 * Both themes are real, and both take their values from the product's own
 * tokens (`globals.css`), not from a second palette invented for marketing:
 * a panel is a well in the canvas, a card is a sheet on top of it, and
 * elevation carries the separation. Accents are deeper in daylight because a
 * value tuned to glow on graphite goes invisible on white.
 */
export type ScenePalette = {
  dark: boolean;
  /** Panel and column bodies. */
  board: string;
  /** The one column or panel that is raised above the rest. */
  boardRaised: string;
  /** A recess: the workflow canvas, the roulette table. */
  well: string;
  /** Paper: cards, records, tokens a person holds. */
  card: string;
  /** A quieter sheet sitting on paper. */
  chip: string;
  cardInk: string;
  cardInkMuted: string;
  /** Text sitting on `board`, not on paper. */
  panelInk: string;
  panelMuted: string;
  /** Hairlines and inert connectors. */
  edge: string;
  rim: string;
  /** An attendant who is out of the window. */
  offline: string;
  offlineInk: string;
  /** A customer's message bubble on a panel. */
  bubble: string;
  /** The brand-tinted ground behind something the AI is carrying. */
  wash: string;
  /** A row echoed into the agent's context. */
  ghost: string;
  light: { ambient: number; key: number; fill: number; cool: number; point: number };
  /** Accents as MATERIAL: rims, bars, the travelling packet. */
  accent: { ai: string; wait: string; team: string; tag: string };
  /** The same roles as TEXT, at the product's `-ink` weights. */
  ink: { ai: string; wait: string; team: string; tag: string };
};

const DARK: ScenePalette = {
  dark: true,
  board: "#1B1F22",
  boardRaised: "#22272B",
  well: "#16191C",
  card: "#F7F9FA",
  chip: "#E6EBEE",
  cardInk: "#101315",
  cardInkMuted: "#596168",
  panelInk: "#F3F6F7",
  panelMuted: "#9AA4AA",
  edge: "#3A4247",
  rim: "#5C666D",
  offline: "#3A4146",
  offlineInk: "#AAB2B7",
  bubble: "#2A3034",
  wash: "#173A30",
  ghost: "#2A3034",
  light: { ambient: 1.0, key: 3.9, fill: 0.75, cool: 0.5, point: 9 },
  accent: { ai: "#00C28A", wait: "#FFB020", team: "#47A3FF", tag: "#8B7CF6" },
  ink: { ai: "#4DCB9D", wait: "#FFC559", team: "#7CC0FF", tag: "#A99BF9" },
};

const LIGHT: ScenePalette = {
  dark: false,
  // Daylight needs a deeper well than dark does: a white sheet only reads as
  // an object on the canvas when the recess under it is genuinely darker.
  board: "#DAE2E6",
  boardRaised: "#E6ECEE",
  well: "#CCD7DC",
  card: "#FFFFFF",
  chip: "#EEF2F4",
  cardInk: "#141A1D",
  cardInkMuted: "#58646B",
  panelInk: "#141A1D",
  panelMuted: "#58646B",
  edge: "#AFBBC2",
  rim: "#8E9BA3",
  offline: "#C3CDD3",
  offlineInk: "#58646B",
  bubble: "#D6DEE3",
  wash: "#C7E8D8",
  ghost: "#D6DEE3",
  // Less ambient than dark so the key light's cast shadows survive; the
  // product's own rule is that depth is carried by real shadow, not by fill.
  light: { ambient: 1.15, key: 3.7, fill: 0.32, cool: 0.22, point: 4 },
  accent: { ai: "#00A57A", wait: "#E1A70B", team: "#1877D4", tag: "#6D5AE0" },
  ink: { ai: "#007A5C", wait: "#8F4C06", team: "#0A4FA6", tag: "#4B35B8" },
};

export function scenePalette(dark: boolean): ScenePalette {
  return dark ? DARK : LIGHT;
}

/**
 * A card in the product's own terms: a white sheet in daylight, a raised panel
 * on graphite. Paper never survives a dark theme, so an object that is a sheet
 * in light has to become a lifted surface in dark rather than staying white.
 * Text on it takes `panelInk` / `panelMuted`, which are correct in both themes.
 */
export function sheet(palette: ScenePalette) {
  return palette.dark ? palette.boardRaised : palette.card;
}

/** The recess a sheet sits in, one step below it in both themes. */
export function sheetWell(palette: ScenePalette) {
  return palette.dark ? palette.well : palette.board;
}

/** A quieter block ON a sheet: a chip, a tag, an avatar ground. */
export function sheetChip(palette: ScenePalette) {
  return palette.dark ? palette.bubble : palette.chip;
}

/** Channel marks are brand identity: never recoloured, never theme-swapped. */
export const CHANNEL = {
  whatsapp: "#25D366",
  instagram: "#E1306C",
  telegram: "#2AABEE",
} as const;

/**
 * Corner radii, in world units, matched to the product's sharp control corner:
 * 6px on a ~300px sheet is about 2% of its width, so these stay tight. A
 * chunky 3D fillet reads as a different product.
 */
export const R = {
  card: 0.05,
  rim: 0.06,
  board: 0.06,
  chip: 0.04,
} as const;

/**
 * A wider lens, closer in. At 38° from eleven units the projection was nearly
 * orthographic: a card lifted off its board barely changed size, so nothing
 * read as being in front of anything. At 50° from under nine, the same lift
 * produces real convergence, and `useFitScale` reframes every scene for the
 * new viewport on its own.
 */
export const STAGE_CAMERA = {
  position: [0, 0.2, 8.8] as [number, number, number],
  fov: 50,
  near: 0.1,
  far: 40,
};

/**
 * drei sizes a `distanceFactor` label against the canvas, not against the
 * geometry, so a fixed factor renders text at wildly different sizes on a
 * desktop frame and a phone one (measured: 8px vs 16px for the same source).
 * Deriving the factor from the canvas height instead keeps in-scene text at a
 * predictable on-screen size everywhere, and each scene then picks its CSS
 * sizes for its own composition.
 */
const LABEL_FACTOR_PER_PX = 0.0167;
/** Measured screen px per CSS px at that factor, constant across viewports. */
const LABEL_SCREEN_RATIO = 1.152;

/**
 * The CSS width a label needs to cover a given span of the scene. Hand-picked
 * widths cannot track a scene that rescales itself, which is how text ended up
 * over the colour bar it was supposed to sit beside.
 */
export function useLabelPx(sceneScale: number) {
  const { size, viewport } = useThree();
  const pxPerUnit = (size.height / viewport.height) * sceneScale;
  return (units: number) => Math.max(20, Math.round((units * pxPerUnit) / LABEL_SCREEN_RATIO));
}

/** World-sized HTML for content printed on a moving panel (100 CSS px/unit). */
export function usePanelType(sceneScale: number) {
  const { size, viewport } = useThree();
  const pixelsPerUnit = (size.height / viewport.height) * sceneScale;
  return {
    px: (units: number) => units * 100,
    font: (size: number) => Math.min(size * 2.1, (size * LABEL_SCREEN_RATIO * 100) / pixelsPerUnit),
  };
}

export function PanelLabel({ position, width, className, style, children }: LabelProps) {
  return (
    <Html transform position={position} distanceFactor={4} zIndexRange={[40, 0]} pointerEvents="none">
      <div className={className} style={{ width, minWidth: 0, ...style }} aria-hidden="true" data-scene-label="panel">
        {children}
      </div>
    </Html>
  );
}

export type Vec3 = [number, number, number];
export type Window = readonly [number, number];

export function smoothWindow(value: number, [start, end]: Window) {
  const normalized = MathUtils.clamp((value - start) / (end - start), 0, 1);
  return normalized * normalized * (3 - 2 * normalized);
}

export function smoothstep(value: number) {
  const clamped = MathUtils.clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

/** 0 at both ends of a window, 1 in the middle: the lift a card takes while it travels. */
export function arc(value: number) {
  return Math.sin(value * Math.PI);
}

export function lerp3(from: Vec3, to: Vec3, t: number): Vec3 {
  return [MathUtils.lerp(from[0], to[0], t), MathUtils.lerp(from[1], to[1], t), MathUtils.lerp(from[2], to[2], t)];
}

/**
 * True on phone-width canvases, where a scene laid out for a desktop frame
 * would shrink until its labels stopped being readable. Scenes answer it by
 * pulling their composition in, not by getting smaller.
 */
export function useCompact() {
  const { size } = useThree();
  return size.width < 700;
}

/**
 * Scale that makes a scene of the given native extents fill the canvas on
 * whichever axis binds. The scene is the subject, so it grows to the space it
 * has instead of sitting small inside it; `margin` keeps its labels off the edge.
 */
export function useFitScale(width: number, height: number, margin = 0.94) {
  const { viewport } = useThree();
  return Math.min((viewport.width * margin) / width, (viewport.height * margin) / height);
}

/**
 * Damps the scroll progress every frame so scroll jitter never reaches the
 * scene. Reduced motion pins the scene at its final state.
 */
export function useDampedProgress(
  progress: MotionValue<number>,
  reduced: boolean,
  onFrame: (value: number, delta: number, elapsed: number) => void,
) {
  const smoothed = useRef(reduced ? 1 : progress.get());
  useFrame((state, delta) => {
    const target = reduced ? 1 : progress.get();
    smoothed.current = MathUtils.damp(smoothed.current, target, 8, delta);
    onFrame(smoothed.current, delta, state.clock.elapsedTime);
  });
}

/**
 * The travelling light: an unseen source circling the stage like a planet,
 * carried far enough out that only its effect is visible. It never casts
 * shadows — the fixed key owns those, so the scene's own depth never swings
 * around — and it dips below the horizon on the far side, which is what makes
 * a band sweep across the objects instead of a highlight sitting still.
 */
const ORBIT_RADIUS = 11;
/** One lap in a minute and a half: a car circling the object, not a strobe. */
const ORBIT_SECONDS = 90;
/** A level orbit, so the light behaves like something driving around the stage. */
const ORBIT_HEIGHT = 3.2;
/** White: the travelling light is a light, not a second accent. */
const ORBIT_COLOR = "#FFFFFF";

function OrbitingLight({ intensity, phase = 0, reduced }: { intensity: number; phase?: number; reduced: boolean }) {
  const light = useRef<DirectionalLight>(null);
  useFrame((state) => {
    if (!light.current) return;
    // Reduced motion keeps the light, and parks it where the scene reads best.
    const t = reduced ? 0.9 : (state.clock.elapsedTime / ORBIT_SECONDS) * Math.PI * 2;
    const angle = t + phase;
    light.current.position.set(Math.cos(angle) * ORBIT_RADIUS, ORBIT_HEIGHT, Math.sin(angle) * ORBIT_RADIUS);
  });
  return <directionalLight ref={light} intensity={intensity} color={ORBIT_COLOR} />;
}

export function StageLights({
  palette,
  accent,
  cool,
  warm,
  reduced = false,
}: {
  palette: ScenePalette;
  accent?: string;
  cool?: string;
  warm?: string;
  reduced?: boolean;
}) {
  const { size } = useThree();
  const shadowSize = size.width < 700 ? 1024 : 2048;
  const { ambient, key, fill, cool: coolIntensity, point } = palette.light;
  return (
    <>
      {/* No background colour: the canvas is transparent so the scene sits on
          the section itself rather than inside a lighter rectangle. */}
      <ambientLight intensity={ambient} />
      {/* A directional light's shadow camera defaults to a ±5 box, and these
          scenes are about ten units across, so most of the cast shadow was
          being clipped away and the stage read flat. The frustum now covers
          the whole stage, at a map fine enough for a card's edge. */}
      <directionalLight
        position={[4.5, 7, 8]}
        intensity={key}
        castShadow
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-camera-near={1}
        shadow-camera-far={34}
      />
      <directionalLight position={[-5, -2, 4]} intensity={fill} color={accent ?? palette.accent.ai} />
      <directionalLight position={[5, 1, 3]} intensity={coolIntensity} color={cool ?? palette.accent.team} />
      <pointLight position={[0, -3, 4]} intensity={point} distance={8} decay={2} color={warm ?? palette.accent.wait} />
      <OrbitingLight intensity={key * 0.5} reduced={reduced} />
      <OrbitingLight intensity={key * 0.22} phase={Math.PI} reduced={reduced} />
    </>
  );
}

/**
 * The material every lit surface in the scenes uses. One place, so the whole
 * page changes together. Physical, not stylised: a banded toon ramp was tried
 * here and rejected — the travelling light reads better against a real falloff.
 */
export function Surface({
  color,
  roughness = 0.6,
  metalness = 0.04,
  transparent,
  opacity,
  materialRef,
}: {
  color: string;
  roughness?: number;
  metalness?: number;
  transparent?: boolean;
  opacity?: number;
  materialRef?: (node: MeshStandardMaterial | null) => void;
}) {
  return (
    <meshStandardMaterial ref={materialRef} color={color} roughness={roughness} metalness={metalness} transparent={transparent} opacity={opacity} />
  );
}

type SlabProps = {
  size: Vec3;
  color: string;
  radius?: number;
  roughness?: number;
  metalness?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
  position?: Vec3;
};

export function Slab({ size, color, radius = R.card, roughness = 0.6, metalness = 0.04, castShadow = true, receiveShadow = false, position }: SlabProps) {
  return (
    <RoundedBox args={size} radius={radius} smoothness={3} castShadow={castShadow} receiveShadow={receiveShadow} position={position}>
      <Surface color={color} roughness={roughness} metalness={metalness} />
    </RoundedBox>
  );
}

/** A coin facing the camera: avatars, tokens, anything that stands for a person. */
export function Disc({
  radius,
  depth = 0.16,
  color,
  position,
  roughness = 0.6,
  castShadow = true,
}: {
  radius: number;
  depth?: number;
  color: string;
  position?: Vec3;
  roughness?: number;
  castShadow?: boolean;
}) {
  return (
    <mesh position={position} rotation={[Math.PI / 2, 0, 0]} castShadow={castShadow}>
      <cylinderGeometry args={[radius, radius, depth, 48]} />
      <Surface color={color} roughness={roughness} />
    </mesh>
  );
}

/** A chat-bubble style block: size, ink and ground in one place. */
export function labelStyle(fontSize: number, color: string, backgroundColor: string): CSSProperties {
  return { fontSize, color, backgroundColor };
}

/** The coloured edge a kanban card carries: a flat bar sitting on a slab face. */
export function Bar({ position, size, color }: { position: Vec3; size: Vec3; color: string }) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

type LabelProps = {
  position: Vec3;
  width: number;
  distanceFactor?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

/** DOM text pinned to a point in the scene. Never interactive: the stage is a picture. */
export function Label({ position, width, distanceFactor, className, style, children }: LabelProps) {
  const { size } = useThree();
  const factor = distanceFactor ?? size.height * LABEL_FACTOR_PER_PX;
  return (
    <Html center position={position} distanceFactor={factor} zIndexRange={[40, 0]} style={{ pointerEvents: "none" }}>
      <div className={className} style={{ width, minWidth: 0, overflowWrap: "anywhere", ...style }} data-scene-label="floating">
        {children}
      </div>
    </Html>
  );
}
