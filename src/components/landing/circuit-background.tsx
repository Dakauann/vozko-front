"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { useTheme } from "next-themes";
import { CircuitBoard } from "@/components/brand/circuit";
import { createCircuitRoutes } from "@/components/brand/circuit-geometry";
import styles from "./landing.module.css";

type CircuitBackgroundProps = { branches?: number; cycleSeconds?: number; speed?: number };

/** Independent decorative renderer: two draw calls, capped resolution and 24fps. */
export function CircuitBackground({ branches = 22, cycleSeconds = 32, speed = 0.065 }: CircuitBackgroundProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (reduced || connection?.saveData || !canvas.current) return;
    const element = canvas.current;
    let cancelled = false;
    let dispose = () => {};
    let idle = 0;
    let timer = 0;
    const start = async () => {
      const THREE = await import("three");
      if (cancelled) return;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ canvas: element, alpha: true, antialias: false, powerPreference: "low-power" });
      } catch {
        return; // The static circuit below the canvas remains the fallback.
      }
      renderer.setClearColor(0x000000, 0);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 80);
      camera.position.z = 22;
      const group = new THREE.Group();
      group.rotation.x = -0.22;
      scene.add(group);
      const seed = () => crypto.getRandomValues(new Uint32Array(1))[0];
      const geometry = () => {
        const positions: number[] = [];
        const distances: number[] = [];
        const phases: number[] = [];
        const births: number[] = [];
        const routes = createCircuitRoutes({ seed: seed(), width: 24, height: 34, branches: innerWidth < 700 ? Math.min(branches, 12) : branches, steps: 7 });
        routes.forEach((route, routeIndex) => {
          let distance = 0;
          for (let i = 1; i < route.points.length; i++) {
            const a = route.points[i - 1];
            const b = route.points[i];
            const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
            positions.push(a[0] - 12, 17 - a[1], route.depth, b[0] - 12, 17 - b[1], route.depth);
            distances.push(distance, distance + length);
            phases.push(route.phase, route.phase);
            births.push(routeIndex / routes.length, routeIndex / routes.length);
            distance += length;
          }
        });
        const result = new THREE.BufferGeometry();
        result.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        result.setAttribute("distance", new THREE.Float32BufferAttribute(distances, 1));
        result.setAttribute("phase", new THREE.Float32BufferAttribute(phases, 1));
        result.setAttribute("birth", new THREE.Float32BufferAttribute(births, 1));
        return result;
      };
      const material = () => new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          time: { value: 0 }, fade: { value: 0 }, growth: { value: 0 },
          ink: { value: new THREE.Color(resolvedTheme === "dark" ? "#4DCB9D" : "#007A5C") },
        },
        vertexShader: `attribute float distance; attribute float phase; attribute float birth;
          varying float vDistance; varying float vPhase; varying float vBirth;
          void main() { vDistance = distance; vPhase = phase; vBirth = birth;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform float time; uniform float fade; uniform float growth; uniform vec3 ink;
          varying float vDistance; varying float vPhase; varying float vBirth;
          void main() {
            float travel = fract(vDistance * 0.045 - time + vPhase);
            float pulse = exp(-pow((travel - 0.5) * 13.0, 2.0));
            float reveal = 1.0 - smoothstep(growth - 0.16, growth, vBirth + vDistance * 0.012);
            gl_FragColor = vec4(ink, (0.13 + pulse * 0.64) * fade * reveal);
          }`,
      });
      const layers = [0, 1].map(() => {
        const mesh = new THREE.LineSegments(geometry(), material());
        group.add(mesh);
        return mesh;
      });
      let frame = 0;
      let last = 0;
      let elapsed = 0;
      let cycle = 0;
      let scroll = window.scrollY;
      const duration = Math.max(16, cycleSeconds);
      const resize = () => {
        const { width, height } = element.getBoundingClientRect();
        renderer.setPixelRatio(Math.min(1, 1280 / Math.max(width, height)));
        renderer.setSize(width, height, false);
        camera.aspect = width / Math.max(1, height);
        camera.updateProjectionMatrix();
        group.scale.x = Math.max(0.55, camera.aspect * 0.8);
      };
      const onScroll = () => { scroll = window.scrollY; };
      const tick = (now: number) => {
        frame = requestAnimationFrame(tick);
        if (now - last < 1000 / 24) return;
        elapsed += Math.min((now - last) / 1000, 0.1);
        last = now;
        const nextCycle = Math.floor(elapsed / duration);
        if (nextCycle !== cycle) {
          cycle = nextCycle;
          const incoming = layers[cycle % 2];
          incoming.geometry.dispose();
          incoming.geometry = geometry();
        }
        const age = (elapsed % duration) / duration;
        const blend = Math.min(1, age * 5);
        layers.forEach((layer, index) => {
          const incoming = index === cycle % 2;
          layer.material.uniforms.time.value = elapsed * speed;
          layer.material.uniforms.fade.value = incoming ? blend : (cycle === 0 ? 0 : 1 - blend);
          layer.material.uniforms.growth.value = incoming ? 0.25 + age * 2.5 : 2;
        });
        const progress = scroll / Math.max(1, document.documentElement.scrollHeight - innerHeight);
        group.rotation.y = -0.14 + progress * 0.28;
        group.position.y = progress * 4 - 2;
        renderer.render(scene, camera);
      };
      const visibility = () => {
        cancelAnimationFrame(frame);
        if (!document.hidden) { last = performance.now(); frame = requestAnimationFrame(tick); }
      };
      const observer = new ResizeObserver(resize);
      observer.observe(element);
      window.addEventListener("scroll", onScroll, { passive: true });
      document.addEventListener("visibilitychange", visibility);
      resize();
      visibility();
      dispose = () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        window.removeEventListener("scroll", onScroll);
        document.removeEventListener("visibilitychange", visibility);
        layers.forEach(layer => { layer.geometry.dispose(); layer.material.dispose(); });
        renderer.dispose();
      };
    };
    const launch = () => { void start().catch(() => { /* Keep the static fallback on import/render failure. */ }); };
    if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(launch, { timeout: 1800 });
    else timer = window.setTimeout(launch, 400);
    return () => {
      cancelled = true;
      if (idle) window.cancelIdleCallback(idle);
      window.clearTimeout(timer);
      dispose();
    };
  }, [branches, cycleSeconds, speed, reduced, resolvedTheme]);

  return (
    <div className={styles.circuitBackground} aria-hidden="true">
      <CircuitBoard pulse={false} tone="quiet" className={styles.circuitFallback} />
      <canvas ref={canvas} className="h-full w-full" />
    </div>
  );
}
