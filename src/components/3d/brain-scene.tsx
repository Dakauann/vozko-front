"use client";

import * as THREE from "three";

import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef } from "react";

import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";

const BRAIN_MODEL_PATH = "/3d/human_brain.glb";

type MousePos = { x: number; y: number };

const PRIMARY_COLOR = new THREE.Color("#1d4ed8");
const PRIMARY_EMISSIVE = new THREE.Color("#2563eb");
const WIREFRAME_COLOR = new THREE.Color("#3b82f6");

const GAP_RADIUS = 1.6; 
const GAP_STRENGTH = 0.7; 
const GAP_MAX_LOCAL = 12; 
const LERP_IN = 0.06; 
const LERP_OUT = 0.02; 

function BrainModel({ mouseRef }: { mouseRef: { current: MousePos } }) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(BRAIN_MODEL_PATH);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const mouseNDC = useMemo(() => new THREE.Vector2(), []);

  const _wv = useMemo(() => new THREE.Vector3(), []);
  const _center = useMemo(() => new THREE.Vector3(), []);
  const _dir = useMemo(() => new THREE.Vector3(), []);

  const originals = useRef<Map<string, Float32Array>>(new Map());

  const hitSphere = useMemo(() => {
    const geo = new THREE.SphereGeometry(1.25, 32, 32);
    const mat = new THREE.MeshBasicMaterial({ visible: false });
    return new THREE.Mesh(geo, mat);
  }, []);
  const hitTarget = useRef<THREE.Vector3 | null>(null);

  const { clonedScene, normalizedScale } = useMemo(() => {
    const clone = scene.clone(true);
    const meshes: THREE.Mesh[] = [];
    clone.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;

        if (mesh.geometry.index) {
          mesh.geometry = mesh.geometry.toNonIndexed();
        }

        mesh.material = new THREE.MeshPhysicalMaterial({
          color: PRIMARY_COLOR,
          emissive: PRIMARY_EMISSIVE,
          emissiveIntensity: 0.1,
          metalness: 0.35,
          roughness: 0.28,
          clearcoat: 0.9,
          clearcoatRoughness: 0.1,
          envMapIntensity: 0.6,
          side: THREE.DoubleSide,
        });
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        meshes.push(mesh);
      }
    });

    for (const mesh of meshes) {
      const wireGeo = mesh.geometry.clone();
      const wireMat = new THREE.MeshBasicMaterial({
        color: WIREFRAME_COLOR,
        wireframe: true,
        transparent: true,
        opacity: 0.12,
      });
      const wireMesh = new THREE.Mesh(wireGeo, wireMat);
      wireMesh.raycast = () => {}; 
      mesh.add(wireMesh);
    }

    const baseSize = 2.5;
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = maxDim > 0 ? baseSize / maxDim : 1;

    return { clonedScene: clone, normalizedScale: scale };
  }, [scene]);

  useEffect(() => {
    clonedScene.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const pos = mesh.geometry.attributes.position;
        if (pos) {
          originals.current.set(
            mesh.uuid,
            new Float32Array(pos.array as Float32Array),
          );
        }
      }
    });
  }, [clonedScene]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    groupRef.current.rotation.y += delta * 0.15;

    const { x, y } = mouseRef.current;
    const isActive = x !== 0 || y !== 0;

    if (isActive) {
      mouseNDC.set(x, y);
      raycaster.setFromCamera(mouseNDC, state.camera);
      const hits = raycaster.intersectObject(hitSphere, false);
      if (hits.length > 0) {
        if (!hitTarget.current) hitTarget.current = hits[0].point.clone();
        else hitTarget.current.copy(hits[0].point);
      }
    } else {
      hitTarget.current = null;
    }

    const hitPoint = hitTarget.current;

    const invScale = 1 / normalizedScale;

    groupRef.current.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const geo = mesh.geometry;
      const orig = originals.current.get(mesh.uuid);
      if (!orig) return;

      const posAttr = geo.attributes.position;
      const arr = posAttr.array as Float32Array;
      const count = posAttr.count;

      mesh.updateWorldMatrix(true, false);
      const wm = mesh.matrixWorld;

      for (let face = 0; face < count; face += 3) {
        const i0 = face * 3,
          i1 = (face + 1) * 3,
          i2 = (face + 2) * 3;

        _center.set(
          (orig[i0] + orig[i1] + orig[i2]) / 3,
          (orig[i0 + 1] + orig[i1 + 1] + orig[i2 + 1]) / 3,
          (orig[i0 + 2] + orig[i1 + 2] + orig[i2 + 2]) / 3,
        );

        _wv.copy(_center).applyMatrix4(wm);

        let offsetX = 0,
          offsetY = 0,
          offsetZ = 0;

        if (hitPoint) {
          const dist = _wv.distanceTo(hitPoint);
          if (dist < GAP_RADIUS) {
            const t = 1 - dist / GAP_RADIUS;
            const push = t * t * t * GAP_STRENGTH;

            _dir.subVectors(_wv, hitPoint).normalize().multiplyScalar(push);

            offsetX = _dir.x * invScale;
            offsetY = _dir.y * invScale;
            offsetZ = _dir.z * invScale;

            const mag = Math.sqrt(
              offsetX * offsetX + offsetY * offsetY + offsetZ * offsetZ,
            );
            if (mag > GAP_MAX_LOCAL) {
              const s = GAP_MAX_LOCAL / mag;
              offsetX *= s;
              offsetY *= s;
              offsetZ *= s;
            }
          }
        }

        const hasOffset = offsetX !== 0 || offsetY !== 0 || offsetZ !== 0;
        const lf = hasOffset ? LERP_IN : LERP_OUT;

        for (let v = 0; v < 3; v++) {
          const ix = (face + v) * 3;
          const tx = orig[ix] + offsetX;
          const ty = orig[ix + 1] + offsetY;
          const tz = orig[ix + 2] + offsetZ;

          arr[ix] += (tx - arr[ix]) * lf;
          arr[ix + 1] += (ty - arr[ix + 1]) * lf;
          arr[ix + 2] += (tz - arr[ix + 2]) * lf;
        }
      }

      posAttr.needsUpdate = true;
      geo.computeVertexNormals();
    });
  });

  return (
    <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.6}>
      <group ref={groupRef} scale={normalizedScale} position={[0, 0, 0]}>
        <primitive object={clonedScene} />
      </group>
    </Float>
  );
}


const glowVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const glowFragmentShader = `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec2 vUv;
  void main() {
    float dist = length(vUv - vec2(0.5));
    // Smooth radial falloff, bright center, soft edge
    float glow = smoothstep(0.5, 0.0, dist);
    glow = pow(glow, 2.2); // sharpen the center
    gl_FragColor = vec4(uColor, glow * uIntensity);
  }
`;

function GroundGlow({ isDark }: { isDark: boolean }) {
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(isDark ? "#3b82f6" : "#60a5fa") },
      uIntensity: { value: isDark ? 0.45 : 0.3 },
    }),
    [isDark],
  );

  useFrame(() => {
    uniforms.uColor.value.set(isDark ? "#3b82f6" : "#60a5fa");
    // eslint-disable-next-line react-hooks/immutability
    uniforms.uIntensity.value = isDark ? 0.45 : 0.3;
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.45, 0]}>
      <planeGeometry args={[5, 5]} />
      <shaderMaterial
        vertexShader={glowVertexShader}
        fragmentShader={glowFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

function Lighting({ isDark }: { isDark: boolean }) {
  return (
    <>
      {/* Ambient, lower in dark mode for moodier look */}
      <ambientLight
        intensity={isDark ? 0.12 : 0.3}
        color={isDark ? "#1e3a8a" : "#ffffff"}
      />

      {/* KEY: Uplight from below, hero signature */}
      <spotLight
        position={[0, -5, 2]}
        angle={0.6}
        penumbra={0.8}
        intensity={isDark ? 4 : 6}
        color={isDark ? "#60a5fa" : "#ffffff"}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      {/* FILL: Front-left */}
      <pointLight
        position={[-3, 1, 3]}
        intensity={isDark ? 1.5 : 3}
        color={isDark ? "#93c5fd" : "#f8fafc"}
        distance={14}
        decay={2}
      />

      {/* RIM: Top-right */}
      <directionalLight
        position={[3, 4, -1]}
        intensity={isDark ? 0.8 : 1.5}
        color={isDark ? "#bfdbfe" : "#e0e7ff"}
      />

      {/* BACK: Indigo contour */}
      <pointLight
        position={[0, 0, -5]}
        intensity={isDark ? 0.8 : 1.2}
        color="#4f46e5"
        distance={14}
        decay={2}
      />

      {/* ACCENT: Bottom bounce */}
      <pointLight
        position={[2, -3, 1]}
        intensity={isDark ? 0.6 : 1}
        color={isDark ? "#60a5fa" : "#f0f0ff"}
        distance={12}
        decay={2}
      />
    </>
  );
}

function MouseLight({ mouseRef }: { mouseRef: { current: MousePos } }) {
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(() => {
    if (!lightRef.current) return;
    const { x, y } = mouseRef.current;
    lightRef.current.position.x += (x * 4 - lightRef.current.position.x) * 0.08;
    lightRef.current.position.y += (y * 3 - lightRef.current.position.y) * 0.08;
  });

  return (
    <pointLight
      ref={lightRef}
      position={[0, 0, 3]}
      intensity={7}
      color="#dbeafe"
      distance={12}
      decay={2}
    />
  );
}

export default function BrainScene({ className }: { className?: string }) {
  const mouseRef = useRef<MousePos>({ x: 0, y: 0 });
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <div
      className={cn("overflow-hidden", className)}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        mouseRef.current = {
          x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
          y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
        };
      }}
      onMouseLeave={() => {
        mouseRef.current = { x: 0, y: 0 };
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 4], fov: 50 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: isDark ? 1.1 : 1.4,
        }}
        style={{ background: "transparent" }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <Lighting isDark={isDark} />
          <MouseLight mouseRef={mouseRef} />
          <BrainModel mouseRef={mouseRef} />
          <GroundGlow isDark={isDark} />
          <Environment
            preset={isDark ? "night" : "city"}
            environmentIntensity={isDark ? 0.4 : 0.7}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

useGLTF.preload(BRAIN_MODEL_PATH);
