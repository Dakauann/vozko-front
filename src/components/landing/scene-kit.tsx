"use client";

import { Html, RoundedBox } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import type { MotionValue } from "framer-motion";
import { createContext, useContext, useRef, type CSSProperties, type ReactNode } from "react";
import { MathUtils, type DirectionalLight, type MeshStandardMaterial } from "three";

export type ScenePalette = {
  dark: boolean;
  board: string;
  boardRaised: string;
  well: string;
  card: string;
  chip: string;
  cardInk: string;
  cardInkMuted: string;
  panelInk: string;
  panelMuted: string;
  edge: string;
  rim: string;
  offline: string;
  offlineInk: string;
  bubble: string;
  wash: string;
  ghost: string;
  light: { ambient: number; key: number; fill: number; cool: number; point: number };
  accent: { ai: string; wait: string; team: string; tag: string };
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
  light: { ambient: 1.15, key: 3.7, fill: 0.32, cool: 0.22, point: 4 },
  accent: { ai: "#00A57A", wait: "#E1A70B", team: "#1877D4", tag: "#6D5AE0" },
  ink: { ai: "#007A5C", wait: "#8F4C06", team: "#0A4FA6", tag: "#4B35B8" },
};

export function scenePalette(dark: boolean): ScenePalette {
  return dark ? DARK : LIGHT;
}

export function sheet(palette: ScenePalette) {
  return palette.dark ? palette.boardRaised : palette.card;
}

export function sheetWell(palette: ScenePalette) {
  return palette.dark ? palette.well : palette.board;
}

export function sheetChip(palette: ScenePalette) {
  return palette.dark ? palette.bubble : palette.chip;
}

export const CHANNEL = {
  whatsapp: "#25D366",
  instagram: "#E1306C",
  telegram: "#2AABEE",
} as const;

export const R = {
  card: 0.05,
  rim: 0.06,
  board: 0.06,
  chip: 0.04,
} as const;

export const STAGE_CAMERA = {
  position: [0, 0, 8.8] as [number, number, number],
  fov: 50,
  near: 0.1,
  far: 40,
};

const LABEL_SCREEN_RATIO = 1.152;

const PanelScaleContext = createContext(1);

export function PanelScale({ scale, children }: { scale: number; children: ReactNode }) {
  return <PanelScaleContext.Provider value={scale}>{children}</PanelScaleContext.Provider>;
}

const FONT_CEILING = 1.85;

export function usePanelType(sceneScale: number) {
  const { size, viewport } = useThree();
  const pixelsPerUnit = (size.height / viewport.height) * sceneScale;
  return {
    px: (units: number) => units * 100,
    font: (size: number) => Math.min(size * FONT_CEILING, (size * LABEL_SCREEN_RATIO * 100) / pixelsPerUnit),
  };
}

export function PanelLabel({ position, width, className, style, children }: LabelProps) {
  const sceneScale = useContext(PanelScaleContext);
  const height = useThree(state => state.size.height);
  return (
    <Html
      center
      position={position}
      distanceFactor={(height * sceneScale) / 100}
      zIndexRange={[40, 0]}
      style={{ pointerEvents: "none" }}
    >
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

export function arc(value: number) {
  return Math.sin(value * Math.PI);
}

export function lerp3(from: Vec3, to: Vec3, t: number): Vec3 {
  return [MathUtils.lerp(from[0], to[0], t), MathUtils.lerp(from[1], to[1], t), MathUtils.lerp(from[2], to[2], t)];
}

export function useCompact() {
  const { size } = useThree();
  return size.width < 700;
}

export function useFitScale(width: number, height: number, margin = 0.9) {
  const { viewport } = useThree();
  const depth = 1.8;
  const distance = STAGE_CAMERA.position[2];
  const fit = (span: number, extent: number) => (span * margin) / (extent + span * margin * depth / distance);
  return Math.min(fit(viewport.width, width), fit(viewport.height, height));
}

const REWIND = 0.5;

export function useDampedProgress(
  progress: MotionValue<number>,
  reduced: boolean,
  onFrame: (value: number, delta: number, elapsed: number) => void,
) {
  const smoothed = useRef(reduced ? 1 : progress.get());
  useFrame((state, delta) => {
    const target = reduced ? 1 : progress.get();
    smoothed.current = reduced || target - smoothed.current < -REWIND
      ? target
      : MathUtils.damp(smoothed.current, target, 8, delta);
    onFrame(smoothed.current, delta, state.clock.elapsedTime);
  });
}

const ORBIT_RADIUS = 11;
const ORBIT_SECONDS = 90;
const ORBIT_HEIGHT = 3.2;
const ORBIT_COLOR = "#FFFFFF";

function OrbitingLight({ intensity, phase = 0, reduced }: { intensity: number; phase?: number; reduced: boolean }) {
  const light = useRef<DirectionalLight>(null);
  useFrame((state) => {
    if (!light.current) return;
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
      {
}
      <ambientLight intensity={ambient} />
      {
}
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

export function labelStyle(fontSize: number, color: string, backgroundColor: string): CSSProperties {
  return { fontSize, color, backgroundColor };
}

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
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};
