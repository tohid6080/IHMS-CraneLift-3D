"use client";

/**
 * IHMS CraneLift 3D — صحنه سه‌بعدی (React Three Fiber)
 * -----------------------------------------------------------
 * شماتیک واقعی و قابل چرخش/زوم از جرثقیل انتخابی + بار + زمین + مانع.
 * - بوم و جیب دقیقاً بر اساس زوایای ورودی حرکت می‌کنند
 * - بار با اسلینگ به قلاب متصل است و رنگ آن وضعیت لیفت را نشان می‌دهد
 * - شامل: خط شعاع کاری، منطقه ممنوعه، خطوط نیرو، برچسب‌ها، شیب زمین
 * این کامپوننت باید صرفاً به‌صورت client-only (dynamic + ssr:false) لود شود.
 */

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Edges, Grid, Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useLiftStore } from "@/lib/cranelift/store";
import { getCraneById } from "@/lib/cranelift/cranes";
import { solveGeometry, STATUS_COLORS, HOOK_BLOCK_HEIGHT_M } from "@/lib/cranelift/analysis";
import { sceneCapture } from "@/lib/cranelift/capture";
import { useView3D, type FlagMode } from "./view3d-store";
import { useSim } from "./sim-store";
import {
  buildTimeline,
  finalPoseOf,
  sampleTimeline,
  slewDegFor,
  staticPoseOf,
  type SegPose,
  type SimPose,
} from "@/lib/cranelift/simulation";
import type { Crane, GroundPoint, LiftInputs, SceneObjectInstance } from "@/lib/cranelift/types";
import { SCENE_OBJECT_CATALOG, sceneObjectLabel } from "@/lib/cranelift/scene-objects";

const D2R = Math.PI / 180;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

// ───────────────────────── برچسب سه‌بعدی (Sprite بافت‌متنی) ─────────────────────────
// به‌جای drei Html (که با React 19 خطای unmount می‌دهد) از Sprite با
// CanvasTexture استفاده می‌کنیم — کاملاً داخل WebGL و بدون React root.
function makeTextTexture(
  text: string,
  opts: { color?: string; bg?: string; border?: string }
): { tex: THREE.CanvasTexture; aspect: number } {
  const pad = 16;
  const font = "700 46px Vazirmatn, Tahoma, sans-serif";
  const measure = document.createElement("canvas").getContext("2d");
  measure!.font = font;
  const w = Math.ceil(measure!.measureText(text).width) + pad * 2;
  const h = 72;
  const canvas = document.createElement("canvas");
  canvas.width = w * 2;
  canvas.height = h * 2;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(2, 2);
  // پس‌زمینه گرد
  ctx.fillStyle = opts.bg ?? "rgba(10,10,10,0.78)";
  ctx.beginPath();
  ctx.roundRect(0.5, 0.5, w - 1, h - 1, 10);
  ctx.fill();
  if (opts.border) {
    ctx.strokeStyle = opts.border;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  ctx.font = font;
  ctx.fillStyle = opts.color ?? "#ffffff";
  ctx.textBaseline = "middle";
  ctx.fillText(text, pad, h / 2 + 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, aspect: w / h };
}

function Label3D({
  position,
  text,
  color = "#ffffff",
  bg = "rgba(10,10,10,0.78)",
  border,
  height = 2.1,
}: {
  position: [number, number, number];
  text: string;
  color?: string;
  bg?: string;
  border?: string;
  height?: number;
}) {
  const { tex, aspect } = useMemo(() => makeTextTexture(text, { color, bg, border }), [text, color, bg, border]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <sprite position={position} scale={[height * aspect, height, 1]}>
      <spriteMaterial map={tex} transparent depthTest={false} toneMapped={false} />
    </sprite>
  );
}

// ───────────────────────── ثبت تابع اسکرین‌شات ─────────────────────────
function CaptureRegister() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    sceneCapture.capture = () => {
      gl.render(scene, camera);
      return gl.domElement.toDataURL("image/png");
    };
    return () => {
      sceneCapture.capture = null;
    };
  }, [gl, scene, camera]);
  return null;
}

// ───────────────────────── دوربین هوشمند ─────────────────────────
function CameraRig({
  radius,
  height,
  frozen,
  center = [0, 0],
}: {
  radius: number;
  height: number;
  frozen: boolean;
  center?: [number, number];
}) {
  const controls = useThree((s) => s.controls) as unknown as {
    target: THREE.Vector3;
    object: THREE.PerspectiveCamera;
    update: () => void;
  } | null;
  const lastFit = useRef({ radius: 0, height: 0 });

  useEffect(() => {
    if (!controls || frozen) return;
    const first = lastFit.current.radius === 0;
    const dr = Math.abs(radius - lastFit.current.radius);
    const dh = Math.abs(height - lastFit.current.height);
    if (first || dr > 8 || dh > 12) {
      lastFit.current = { radius, height };
      // فاصله دوربین متناسب با بزرگ‌ترین بعد صحنه + مارجین برای قاب کامل
      const dist = Math.max(radius, height * 0.9) * 1.25 + 18;
      controls.target.set(center[0] + radius * 0.45, Math.max(2, height * 0.32), center[1]);
      controls.object.position.set(
        center[0] + dist * 0.82,
        Math.max(11, height * 0.6 + 7),
        center[1] + dist * 0.82
      );
      controls.update();
    }
  }, [controls, radius, height, frozen, center[0], center[1]]);
  return null;
}

// ───────────────────────── جزئیات مشترک ─────────────────────────

/** زمین + گرید — با کلیک: پرچم A/B، جابه‌جایی جرثقیل یا افزودن تجهیز */
function Ground({
  flagMode,
  onGroundClick,
}: {
  flagMode: FlagMode;
  onGroundClick?: (x: number, z: number) => void;
}) {
  const downRef = useRef<{ x: number; y: number } | null>(null);
  const tint =
    flagMode === "pick"
      ? "#33280f"
      : flagMode === "place"
        ? "#0f2e22"
        : flagMode === "moveCrane"
          ? "#322412"
          : flagMode === "object"
            ? "#202a24"
            : "#262626";
  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
        onPointerDown={(e) => {
          downRef.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY };
        }}
        onClick={(e) => {
          // ثبت نقطه فقط با کلیک واقعی (بدون درگ چرخش دوربین)
          if (!onGroundClick) return;
          const d = downRef.current;
          downRef.current = null;
          if (!d) return;
          if (Math.hypot(e.nativeEvent.clientX - d.x, e.nativeEvent.clientY - d.y) > 6) return;
          e.stopPropagation();
          onGroundClick(e.point.x, e.point.z);
        }}
      >
        <planeGeometry args={[260, 260]} />
        <meshStandardMaterial color={tint} roughness={1} metalness={0} />
      </mesh>
      <Grid
        position={[0, 0.02, 0]}
        infiniteGrid
        cellSize={2}
        sectionSize={10}
        cellColor="#3a3a3a"
        sectionColor="#555555"
        fadeDistance={140}
        fadeStrength={1.4}
      />
    </group>
  );
}

/** منطقه ممنوعه (دایره قرمز نیمه‌شفاف روی زمین) */
function ExclusionZone({ radiusM }: { radiusM: number }) {
  const ring = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      pts.push([Math.cos(a) * radiusM, 0.04, Math.sin(a) * radiusM]);
    }
    return pts;
  }, [radiusM]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[radiusM, 72]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0.06} side={THREE.DoubleSide} />
      </mesh>
      <Line points={ring} color="#ef4444" lineWidth={1.2} transparent opacity={0.55} />
      <Label3D
        position={[radiusM * 0.72, 0.6, radiusM * 0.72]}
        text="Exclusion Zone"
        color="#fca5a5"
        bg="rgba(20,5,5,0.7)"
        border="rgba(239,68,68,0.5)"
      />
    </group>
  );
}

/** فلش نیرو (عمودی) */
function ForceArrow({
  origin,
  length,
  color,
  dir,
}: {
  origin: [number, number, number];
  length: number;
  color: string;
  dir: 1 | -1;
}) {
  const shaftLen = length * 0.7;
  const coneLen = length - shaftLen;
  const shaftY = origin[1] + dir * (shaftLen / 2);
  const coneY = origin[1] + dir * (shaftLen + coneLen / 2);
  return (
    <group position={[origin[0], 0, origin[2]]}>
      <mesh position={[0, shaftY, 0]}>
        <cylinderGeometry args={[0.07, 0.07, shaftLen, 10]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, coneY, 0]} rotation={[dir === 1 ? 0 : Math.PI, 0, 0]}>
        <coneGeometry args={[0.2, coneLen, 14]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} />
      </mesh>
    </group>
  );
}

// ───────────────────────── پرچم نقاط برداشت/جایگذاری ─────────────────────────
function FlagMarker({
  x,
  z,
  label,
  color,
  showLabels,
}: {
  x: number;
  z: number;
  label: string;
  color: string;
  showLabels: boolean;
}) {
  return (
    <group position={[x, 0, z]}>
      {/* میله پرچم */}
      <mesh position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 2.2, 8]} />
        <meshStandardMaterial color="#e5e5e5" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* پارچه پرچم */}
      <mesh position={[0.42, 1.95, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
        <coneGeometry args={[0.42, 0.85, 4]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
      </mesh>
      {/* پایه */}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.28, 0.34, 0.1, 12]} />
        <meshStandardMaterial color="#52525b" metalness={0.5} roughness={0.5} />
      </mesh>
      {showLabels && (
        <Label3D
          position={[0, 2.9, 0]}
          text={label}
          color="#111111"
          bg={color}
          height={1.1}
        />
      )}
    </group>
  );
}

/** حلقه شعاع یک نقطه روی زمین */
function RadiusRing({ radiusM, color }: { radiusM: number; color: string }) {
  const ring = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      pts.push([Math.cos(a) * radiusM, 0.05, Math.sin(a) * radiusM]);
    }
    return pts;
  }, [radiusM]);
  return (
    <Line points={ring} color={color} lineWidth={1.4} dashed dashSize={0.7} gapSize={0.45} transparent opacity={0.65} />
  );
}

/** بار روی زمین (قبل از برداشت در A یا بعد از جایگذاری در B) */
function GroundLoad({
  x,
  z,
  groundY,
  inputs,
  color,
  showLabels,
  grossT,
}: {
  x: number;
  z: number;
  groundY: number;
  inputs: LiftInputs;
  color: string;
  showLabels: boolean;
  grossT: number;
}) {
  const { loadDims: dims } = inputs;
  const centerY = groundY + dims.heightM / 2;
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, centerY, 0]} castShadow>
        <boxGeometry args={[dims.lengthM, dims.heightM, dims.widthM]} />
        <meshStandardMaterial color={color} metalness={0.25} roughness={0.55} transparent opacity={0.92} />
        <Edges color="#ffffff" />
      </mesh>
      {showLabels && (
        <Label3D
          position={[0, centerY + dims.heightM / 2 + 0.9, 0]}
          text={`W = ${grossT.toFixed(1)} t`}
        />
      )}
    </group>
  );
}

// ───────────────────────── تجهیزات محوطه (نیروگاه / پالایشگاه) ─────────────────────────

/** پراپرتی‌های متریال با هایلایت انتخاب */
function objMat(color: string, selected: boolean) {
  return {
    color,
    emissive: selected ? "#f59e0b" : "#000000",
    emissiveIntensity: selected ? 0.45 : 0,
    roughness: 0.75,
    metalness: 0.25,
  } as const;
}

/** بدنه سه‌بعدی هر نوع تجهیز بر اساس کاتالوگ (ابعاد پایه × مقیاس) */
function SceneObjectBody({ type, s, selected }: { type: SceneObjectInstance["type"]; s: number; selected: boolean }) {
  const m = SCENE_OBJECT_CATALOG[type];
  const edge = <Edges color={selected ? "#fbbf24" : m.edge} />;
  switch (type) {
    case "foundation":
      return (
        <group>
          <mesh position={[0, (m.h * s) / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[m.w * s, m.h * s, m.d * s]} />
            <meshStandardMaterial {...objMat(m.color, selected)} />
            {edge}
          </mesh>
          <mesh position={[0, m.h * s + 0.15 * s, 0]} castShadow>
            <boxGeometry args={[m.w * s * 0.55, 0.3 * s, m.d * s * 0.55]} />
            <meshStandardMaterial {...objMat("#808a95", selected)} />
          </mesh>
        </group>
      );
    case "structure":
      return (
        <group>
          {[-1, 1].flatMap((sx) =>
            [-1, 1].map((sz) => (
              <mesh key={`${sx}${sz}`} position={[(sx * m.w * s) / 2, (m.h * s) / 2, (sz * m.d * s) / 2]} castShadow>
                <boxGeometry args={[0.45 * s, m.h * s, 0.45 * s]} />
                <meshStandardMaterial {...objMat(m.color, selected)} />
                {edge}
              </mesh>
            ))
          )}
          {[0.34, 0.67, 1].map((f, i) => (
            <mesh key={i} position={[0, m.h * s * f, 0]} castShadow>
              <boxGeometry args={[m.w * s + 0.3 * s, 0.35 * s, m.d * s + 0.3 * s]} />
              <meshStandardMaterial {...objMat(i === 2 ? m.color : "#7c8794", selected)} />
              {edge}
            </mesh>
          ))}
        </group>
      );
    case "column":
      return (
        <group>
          <mesh position={[0, (m.h * s) / 2, 0]} castShadow>
            <cylinderGeometry args={[(m.w * s) / 2, (m.w * s) / 2, m.h * s, 24]} />
            <meshStandardMaterial {...objMat(m.color, selected)} />
            {edge}
          </mesh>
          <mesh position={[0, 1.2 * s, 0]} castShadow>
            <cylinderGeometry args={[(m.w * s) / 2 + 0.5 * s, (m.w * s) / 2 + 0.7 * s, 2.4 * s, 24]} />
            <meshStandardMaterial {...objMat("#8f9aa6", selected)} />
          </mesh>
          {[0.4, 0.7].map((f, i) => (
            <mesh key={i} position={[0, m.h * s * f, 0]} castShadow>
              <cylinderGeometry args={[(m.w * s) / 2 + 0.7 * s, (m.w * s) / 2 + 0.7 * s, 0.25 * s, 24]} />
              <meshStandardMaterial {...objMat("#94a3b8", selected)} />
            </mesh>
          ))}
          <mesh position={[0, m.h * s + 0.4 * s, 0]} castShadow>
            <sphereGeometry args={[(m.w * s) / 2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial {...objMat(m.color, selected)} />
          </mesh>
        </group>
      );
    case "tank":
      return (
        <group>
          <mesh position={[0, (m.h * s * 0.88) / 2, 0]} castShadow>
            <cylinderGeometry args={[(m.w * s) / 2, (m.w * s) / 2, m.h * s * 0.88, 32]} />
            <meshStandardMaterial {...objMat(m.color, selected)} />
            {edge}
          </mesh>
          <mesh position={[0, m.h * s * 0.88 + (m.h * s * 0.12) / 2, 0]} castShadow>
            <coneGeometry args={[(m.w * s) / 2, m.h * s * 0.12, 32]} />
            <meshStandardMaterial {...objMat(m.edge, selected)} />
          </mesh>
          <mesh position={[0, 0.25 * s, 0]} castShadow>
            <cylinderGeometry args={[(m.w * s) / 2 + 0.15 * s, (m.w * s) / 2 + 0.15 * s, 0.5 * s, 32]} />
            <meshStandardMaterial {...objMat("#9aa4b0", selected)} />
          </mesh>
        </group>
      );
    case "exchanger":
      return (
        <group>
          <mesh position={[0, m.h * s * 0.62, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[(m.h * s) / 2, (m.h * s) / 2, m.w * s * 0.9, 24]} />
            <meshStandardMaterial {...objMat(m.color, selected)} />
            {edge}
          </mesh>
          {[-1, 1].map((sx) => (
            <mesh key={sx} position={[sx * m.w * s * 0.3, (m.h * s) / 6, 0]} castShadow>
              <boxGeometry args={[0.5 * s, (m.h * s) / 3, m.d * s]} />
              <meshStandardMaterial {...objMat("#57534e", selected)} />
            </mesh>
          ))}
          <mesh position={[m.w * s * 0.38, m.h * s * 0.62, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[(m.h * s) / 2.2, (m.h * s) / 2.2, 0.5 * s, 24]} />
            <meshStandardMaterial {...objMat("#78716c", selected)} />
          </mesh>
        </group>
      );
    case "coolingTower":
      return (
        <group>
          <mesh position={[0, (m.h * s) / 2, 0]} castShadow>
            <cylinderGeometry args={[(m.w * s) / 3.2, (m.w * s) / 2, m.h * s, 28]} />
            <meshStandardMaterial {...objMat(m.color, selected)} />
            {edge}
          </mesh>
          <mesh position={[0, 0.4 * s, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[(m.w * s) / 2 + 0.6 * s, (m.w * s) / 2 + 0.8 * s, 0.8 * s, 28]} />
            <meshStandardMaterial {...objMat("#8b939d", selected)} />
          </mesh>
        </group>
      );
    case "pipeRack":
      return (
        <group>
          {[-1, 1].map((sz) =>
            [-1, 1].map((sx) => (
              <mesh key={`${sx}${sz}`} position={[(sx * m.w * s) / 2, (m.h * s) / 2, (sz * m.d * s) / 2]} castShadow>
                <boxGeometry args={[0.35 * s, m.h * s, 0.35 * s]} />
                <meshStandardMaterial {...objMat(m.color, selected)} />
                {edge}
              </mesh>
            ))
          )}
          {[0.45, 1].map((f, i) => (
            <mesh key={i} position={[0, m.h * s * f, 0]} castShadow>
              <boxGeometry args={[m.w * s, 0.3 * s, m.d * s]} />
              <meshStandardMaterial {...objMat("#57534e", selected)} />
            </mesh>
          ))}
          {[-0.8, 0, 0.8].map((z, i) => (
            <mesh key={i} position={[0, m.h * s * 0.45 + 0.45 * s, z * s]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.4 * s, 0.4 * s, m.w * s - 0.6 * s, 16]} />
              <meshStandardMaterial {...objMat(i === 1 ? "#a8a29e" : "#8f8a84", selected)} />
            </mesh>
          ))}
        </group>
      );
    case "container":
      return (
        <group>
          <mesh position={[0, (m.h * s) / 2, 0]} castShadow>
            <boxGeometry args={[m.w * s, m.h * s, m.d * s]} />
            <meshStandardMaterial {...objMat(m.color, selected)} />
            {edge}
          </mesh>
          <mesh position={[m.w * s * 0.3, (m.h * s) / 2, m.d * s / 2 + 0.03]} castShadow>
            <boxGeometry args={[1.1 * s, m.h * s * 0.8, 0.06]} />
            <meshStandardMaterial {...objMat("#7c2d12", selected)} />
          </mesh>
        </group>
      );
    case "boiler":
      return (
        <group>
          <mesh position={[0, (m.h * s) / 2, 0]} castShadow>
            <boxGeometry args={[m.w * s, m.h * s, m.d * s]} />
            <meshStandardMaterial {...objMat(m.color, selected)} />
            {edge}
          </mesh>
          <mesh position={[0, m.h * s + 0.6 * s, 0]} castShadow>
            <cylinderGeometry args={[0.9 * s, 0.9 * s, 1.2 * s, 18]} />
            <meshStandardMaterial {...objMat("#64748b", selected)} />
          </mesh>
        </group>
      );
    case "stack":
      return (
        <group>
          <mesh position={[0, (m.h * s) / 2, 0]} castShadow>
            <cylinderGeometry args={[(m.w * s) / 2.6, (m.w * s) / 2, m.h * s, 20]} />
            <meshStandardMaterial {...objMat(m.color, selected)} />
            {edge}
          </mesh>
          {[0.3, 0.45].map((f, i) => (
            <mesh key={i} position={[0, m.h * s * f, 0]} castShadow>
              <cylinderGeometry args={[(m.w * s) / 2.45, (m.w * s) / 2.45, m.h * s * 0.06, 20]} />
              <meshStandardMaterial {...objMat("#b91c1c", selected)} />
            </mesh>
          ))}
        </group>
      );
    case "cableDrum":
      return (
        <group>
          {[-1, 1].map((sx) => (
            <mesh key={sx} position={[sx * 1.1 * s, (m.h * s) / 2, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[(m.h * s) / 2, (m.h * s) / 2, 0.25 * s, 24]} />
              <meshStandardMaterial {...objMat(m.color, selected)} />
              {edge}
            </mesh>
          ))}
          <mesh position={[0, (m.h * s) / 2, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[(m.h * s) / 2.6, (m.h * s) / 2.6, 2.2 * s, 24]} />
            <meshStandardMaterial {...objMat("#854d0e", selected)} />
          </mesh>
          {[-1, 1].map((sx) => (
            <mesh key={sx} position={[sx * 1.1 * s, 0.15 * s, 0]} castShadow>
              <boxGeometry args={[0.4 * s, 0.3 * s, m.h * s * 1.15]} />
              <meshStandardMaterial {...objMat("#57534e", selected)} />
            </mesh>
          ))}
        </group>
      );
    case "controlRoom":
      return (
        <group>
          <mesh position={[0, (m.h * s) / 2, 0]} castShadow>
            <boxGeometry args={[m.w * s, m.h * s, m.d * s]} />
            <meshStandardMaterial {...objMat(m.color, selected)} />
            {edge}
          </mesh>
          <mesh position={[0, m.h * s + 0.1 * s, 0]} castShadow>
            <boxGeometry args={[m.w * s + 0.4 * s, 0.2 * s, m.d * s + 0.4 * s]} />
            <meshStandardMaterial {...objMat("#a8a29e", selected)} />
          </mesh>
          <mesh position={[m.w * s * 0.28, m.h * s * 0.42, m.d * s / 2 + 0.03]} castShadow>
            <boxGeometry args={[0.9 * s, m.h * s * 0.75, 0.06]} />
            <meshStandardMaterial {...objMat("#44403c", selected)} />
          </mesh>
        </group>
      );
    case "transformer":
      return (
        <group>
          <mesh position={[0, (m.h * s * 0.7) / 2, 0]} castShadow>
            <boxGeometry args={[m.w * s, m.h * s * 0.7, m.d * s]} />
            <meshStandardMaterial {...objMat(m.color, selected)} />
            {edge}
          </mesh>
          {[-1, 0, 1].map((i) => (
            <mesh key={i} position={[i * m.w * s * 0.28, m.h * s * 0.7 + m.h * s * 0.14, 0]} castShadow>
              <cylinderGeometry args={[0.16 * s, 0.22 * s, m.h * s * 0.3, 12]} />
              <meshStandardMaterial {...objMat("#d6d3d1", selected)} />
            </mesh>
          ))}
          {[-1, 1].map((sz) => (
            <mesh key={sz} position={[0, (m.h * s) / 2, sz * (m.d * s / 2 + 0.25 * s)]} castShadow>
              <boxGeometry args={[m.w * s * 0.85, m.h * s * 0.55, 0.3 * s]} />
              <meshStandardMaterial {...objMat("#3f6212", selected)} />
            </mesh>
          ))}
        </group>
      );
  }
}

/** یک نمونه تجهیز روی زمین — قابل انتخاب با کلیک */
function SceneObjectItem({
  obj,
  selected,
  onSelect,
}: {
  obj: SceneObjectInstance;
  selected: boolean;
  onSelect: () => void;
}) {
  const meta = SCENE_OBJECT_CATALOG[obj.type];
  return (
    <group
      position={[obj.x, 0, obj.z]}
      rotation={[0, obj.rotDeg * D2R, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <SceneObjectBody type={obj.type} s={obj.scale} selected={selected} />
      {/* حلقه پایه — دیده شدن موقعیت روی زمین */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <ringGeometry args={[Math.max(meta.w, meta.d) * 0.42 * obj.scale, Math.max(meta.w, meta.d) * 0.5 * obj.scale, 40]} />
        <meshBasicMaterial color={selected ? "#fbbf24" : meta.edge} transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>
      {selected && (
        <Label3D
          position={[0, meta.h * obj.scale + 2.2, 0]}
          text={meta.label}
          color="#111111"
          bg="#fbbf24"
          height={1.15}
        />
      )}
    </group>
  );
}

/** لایه کامل تجهیزات محوطه */
function SceneObjectsLayer() {
  const objects = useLiftStore((s) => s.sceneObjects);
  const selectedId = useView3D((s) => s.selectedObjectId);
  const setSelected = useView3D((s) => s.set);
  return (
    <group>
      {objects.map((o) => (
        <SceneObjectItem
          key={o.id}
          obj={o}
          selected={selectedId === o.id}
          onSelect={() => setSelected({ selectedObjectId: o.id })}
        />
      ))}
    </group>
  );
}

// ───────────────────────── برچسب زنده زاویه بوم (داخل صحنه) ─────────────────────────
function BoomAngleLabel({
  isTower,
  boomDeg,
  boomLen,
  pivotOffsetM,
  pivotHeightM,
  radiusM,
}: {
  isTower: boolean;
  boomDeg: number;
  boomLen: number;
  pivotOffsetM: number;
  pivotHeightM: number;
  radiusM: number;
}) {
  const text = isTower
    ? `بوم افقی — Trolley ${radiusM.toFixed(1)}m`
    : `∠ بوم ${boomDeg.toFixed(0)}° — ${boomLen.toFixed(0)}m`;
  const dist = boomLen * 0.5 + 2.2;
  const pos: [number, number, number] = isTower
    ? [boomLen * 0.5, pivotHeightM + 3.4, 0]
    : [
        pivotOffsetM + Math.cos(boomDeg * D2R) * dist,
        pivotHeightM + Math.sin(boomDeg * D2R) * dist + 1.5,
        0,
      ];
  return (
    <Label3D
      position={pos}
      text={text}
      color="#fde68a"
      bg="rgba(26,15,2,0.85)"
      border="rgba(245,158,11,0.55)"
      height={1.15}
    />
  );
}

// ───────────────────────── موتور پخش انیمیشن جابجایی ─────────────────────────
function SimDriver() {
  const active = useSim((s) => s.active);
  const speed = useSim((s) => s.speed);
  const lastPush = useRef(0);
  const local = useRef<{ t: number; key: string; tl: ReturnType<typeof buildTimeline> | null }>({
    t: 0,
    key: "",
    tl: null,
  });

  useFrame((_, dt) => {
    if (!active) return;
    const s = useLiftStore.getState();
    const simS = useSim.getState();
    if (!s.pickPoint || !s.placePoint || !s.transfer) {
      simS.reset();
      return;
    }
    const crane = getCraneById(s.selectedCraneId, s.customCranes);
    if (!crane) {
      simS.reset();
      return;
    }
    const ox = s.cranePos?.x ?? 0;
    const oz = s.cranePos?.z ?? 0;
    const key = `${crane.id}|${s.inputs.boomLengthM}|${s.transfer.checkedAt}|${s.pickPoint.x},${s.pickPoint.z}|${s.placePoint.x},${s.placePoint.z}|${ox},${oz}`;
    if (local.current.key !== key || !local.current.tl) {
      // نقطه شروع نسبت به محل استقرار جرثقیل
      const rel = { x: s.pickPoint.x - ox, z: s.pickPoint.z - oz };
      const start = staticPoseOf(crane, s.inputs, rel);
      local.current.tl = buildTimeline(crane, s.inputs, s.transfer, start as SegPose);
      local.current.t = 0;
      local.current.key = key;
    }
    local.current.t += Math.min(dt, 0.12) * speed;
    const pose = sampleTimeline(local.current.tl, local.current.t);
    if (!pose) {
      // پایان حرکت — پوز پایانی + نمایش کارت نتیجه
      simS.finish(finalPoseOf(local.current.tl));
      return;
    }
    const now = performance.now();
    if (now - lastPush.current > 33) {
      // ~۳۰Hz — روان و بدون فشار به React
      lastPush.current = now;
      simS.setPose(pose);
    }
  });
  return null;
}

// ───────────────────────── جرثقیل سیار ─────────────────────────
function MobileCrane({
  specs,
  boomAngleRad,
  boomLengthM,
  useJib,
  jibLengthM,
  jibAngleRad,
}: {
  specs: Crane["specs"];
  boomAngleRad: number;
  boomLengthM: number;
  useJib: boolean;
  jibLengthM: number;
  jibAngleRad: number;
}) {
  const baseLen = 9;
  const extLen = Math.max(0.4, boomLengthM - (baseLen - 1));
  const axles = [-4.4, -2.2, 0, 2.2, 4.4];
  const halfSpan = specs.outriggerSpanM / 2;

  return (
    <group>
      {/* کفی و شاسی */}
      <mesh position={[0, 1.35, 0]} castShadow>
        <boxGeometry args={[11.5, 0.9, 3]} />
        <meshStandardMaterial color="#27272a" metalness={0.5} roughness={0.55} />
      </mesh>
      {/* محورها و چرخ‌ها */}
      {axles.map((x, i) => (
        <group key={i} position={[x, 0.55, 0]}>
          {[1.5, -1.5].map((z) => (
            <mesh key={z} position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.55, 0.55, 0.4, 18]} />
              <meshStandardMaterial color="#0a0a0a" roughness={0.9} />
            </mesh>
          ))}
        </group>
      ))}
      {/* اوت‌ریگرها */}
      {[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sx, sz], i) => (
        <group key={i}>
          <mesh position={[sx * 3.4, 1.0, sz * (1.5 + halfSpan / 2 - 0.75)]} castShadow>
            <boxGeometry args={[0.35, 0.3, halfSpan - 1.5]} />
            <meshStandardMaterial color="#3f3f46" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[sx * 4.6, 0.15, sz * halfSpan]} castShadow>
            <boxGeometry args={[1.4, 0.3, 1.4]} />
            <meshStandardMaterial color="#52525b" metalness={0.4} roughness={0.6} />
          </mesh>
          <mesh position={[sx * 4.6, 0.55, sz * halfSpan]} castShadow>
            <cylinderGeometry args={[0.16, 0.16, 0.9, 10]} />
            <meshStandardMaterial color="#71717a" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      ))}
      {/* سوپراستراکچر */}
      <mesh position={[-0.4, 2.15, 0]} castShadow>
        <boxGeometry args={[5.4, 0.5, 2.9]} />
        <meshStandardMaterial color="#f59e0b" metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[-1.2, 3.15, 0]} castShadow>
        <boxGeometry args={[4.4, 1.4, 2.7]} />
        <meshStandardMaterial color="#eab308" metalness={0.3} roughness={0.5} />
      </mesh>
      {/* کانترویت */}
      <mesh position={[-3.2, 3.05, 0]} castShadow>
        <boxGeometry args={[1.3, 2.1, 2.7]} />
        <meshStandardMaterial color="#52525b" metalness={0.4} roughness={0.6} />
        <Edges color="#3f3f46" />
      </mesh>
      {/* کابین اپراتور */}
      <mesh position={[1.8, 2.9, -1.55]} castShadow>
        <boxGeometry args={[1.7, 1.4, 1.1]} />
        <meshStandardMaterial color="#1c1917" metalness={0.5} roughness={0.3} />
      </mesh>
      {/* پایه بوم */}
      <mesh position={[specs.pivotOffsetM, specs.pivotHeightM, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.28, 0.28, 1.2, 14]} />
        <meshStandardMaterial color="#a16207" metalness={0.5} roughness={0.4} />
      </mesh>

      {/* بوم تلسکوپی: گروه با دوران زاویه بوم */}
      <group position={[specs.pivotOffsetM, specs.pivotHeightM, 0]} rotation={[0, 0, boomAngleRad]}>
        <mesh position={[baseLen / 2, 0, 0]} castShadow>
          <boxGeometry args={[baseLen, 0.75, 0.75]} />
          <meshStandardMaterial color="#f59e0b" metalness={0.35} roughness={0.45} />
          <Edges color="#92400e" />
        </mesh>
        <mesh position={[baseLen - 1 + extLen / 2 - 0.2, 0, 0]} castShadow>
          <boxGeometry args={[extLen, 0.55, 0.55]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.35} roughness={0.45} />
          <Edges color="#92400e" />
        </mesh>
        {/* جیب */}
        {useJib && (
          <group position={[boomLengthM - 0.4, 0.15, 0]} rotation={[0, 0, jibAngleRad - boomAngleRad]}>
            <mesh position={[jibLengthM / 2, 0, 0]} castShadow>
              <boxGeometry args={[jibLengthM, 0.32, 0.32]} />
              <meshStandardMaterial color="#d97706" metalness={0.35} roughness={0.5} />
              <Edges color="#78350f" />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
}

// ───────────────────────── جرثقیل شنی ─────────────────────────
function CrawlerCrane({
  specs,
  boomAngleRad,
  boomLengthM,
  useJib,
  jibLengthM,
  jibAngleRad,
}: {
  specs: Crane["specs"];
  boomAngleRad: number;
  boomLengthM: number;
  useJib: boolean;
  jibLengthM: number;
  jibAngleRad: number;
}) {
  const gauge = specs.outriggerSpanM;
  return (
    <group>
      {/* شنی‌ها */}
      {[gauge / 2, -gauge / 2].map((z) => (
        <group key={z} position={[0, 0, z]}>
          <mesh position={[0, 0.85, 0]} castShadow>
            <boxGeometry args={[12, 1.7, 1.9]} />
            <meshStandardMaterial color="#0a0a0a" roughness={0.95} />
          </mesh>
          {/* کفشک‌های شنی */}
          {Array.from({ length: 11 }).map((_, i) => (
            <mesh key={i} position={[-5 + i * 1.05, 0.12, 0]} castShadow>
              <boxGeometry args={[0.5, 0.28, 2.1]} />
              <meshStandardMaterial color="#27272a" roughness={0.9} />
            </mesh>
          ))}
        </group>
      ))}
      {/* بدنه بالا */}
      <mesh position={[0, 2.15, 0]} castShadow>
        <boxGeometry args={[7.2, 1.0, gauge - 1.6]} />
        <meshStandardMaterial color="#27272a" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[-0.6, 3.5, 0]} castShadow>
        <boxGeometry args={[6.2, 2.0, gauge - 2.2]} />
        <meshStandardMaterial color="#eab308" metalness={0.3} roughness={0.5} />
        <Edges color="#92400e" />
      </mesh>
      {/* کانترویت */}
      <mesh position={[-3.4, 3.6, 0]} castShadow>
        <boxGeometry args={[1.5, 2.4, gauge - 2.4]} />
        <meshStandardMaterial color="#52525b" metalness={0.4} roughness={0.6} />
        <Edges color="#3f3f46" />
      </mesh>
      {/* کابین */}
      <mesh position={[2.4, 3.7, -gauge / 2 + 1.6]} castShadow>
        <boxGeometry args={[1.8, 1.5, 1.2]} />
        <meshStandardMaterial color="#1c1917" metalness={0.5} roughness={0.3} />
      </mesh>
      {/* پایه بوم */}
      <mesh position={[specs.pivotOffsetM, specs.pivotHeightM, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 1.4, 14]} />
        <meshStandardMaterial color="#a16207" metalness={0.5} roughness={0.4} />
      </mesh>

      {/* بوم اصلی */}
      <group position={[specs.pivotOffsetM, specs.pivotHeightM, 0]} rotation={[0, 0, boomAngleRad]}>
        <mesh position={[boomLengthM / 2, 0, 0]} castShadow>
          <boxGeometry args={[boomLengthM, 0.7, 0.7]} />
          <meshStandardMaterial color="#ca8a04" metalness={0.35} roughness={0.5} />
          <Edges color="#78350f" />
        </mesh>
        {useJib && (
          <group position={[boomLengthM, 0.1, 0]} rotation={[0, 0, jibAngleRad - boomAngleRad]}>
            <mesh position={[jibLengthM / 2, 0, 0]} castShadow>
              <boxGeometry args={[jibLengthM, 0.3, 0.3]} />
              <meshStandardMaterial color="#d97706" metalness={0.35} roughness={0.5} />
              <Edges color="#78350f" />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
}

// ───────────────────────── جرثقیل برجی ─────────────────────────
function TowerCrane({
  specs,
  jibLengthM,
  radiusM,
}: {
  specs: Crane["specs"];
  jibLengthM: number;
  radiusM: number;
}) {
  const H = specs.freestandingHookHeightM ?? 50;
  return (
    <group>
      {/* فونداسیون */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[3.6, 0.5, 3.6]} />
        <meshStandardMaterial color="#52525b" roughness={0.9} />
      </mesh>
      {/* برج */}
      <mesh position={[0, H / 2, 0]} castShadow>
        <boxGeometry args={[2.0, H, 2.0]} />
        <meshStandardMaterial color="#f59e0b" metalness={0.3} roughness={0.5} />
        <Edges color="#92400e" />
      </mesh>
      {/* واحد دوران + کابین */}
      <mesh position={[0, H + 0.45, 0]} castShadow>
        <boxGeometry args={[2.6, 0.9, 2.6]} />
        <meshStandardMaterial color="#27272a" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[1.6, H + 1.3, 0]} castShadow>
        <boxGeometry args={[1.5, 1.3, 1.2]} />
        <meshStandardMaterial color="#1c1917" metalness={0.5} roughness={0.3} />
      </mesh>
      {/* سر برج */}
      <mesh position={[0, H + 2.3, 0]} castShadow>
        <boxGeometry args={[0.6, 3.0, 0.6]} />
        <meshStandardMaterial color="#d97706" metalness={0.3} roughness={0.5} />
      </mesh>
      {/* جیب (بوم افقی) */}
      <mesh position={[jibLengthM / 2, H + 1.0, 0]} castShadow>
        <boxGeometry args={[jibLengthM, 0.9, 0.9]} />
        <meshStandardMaterial color="#f59e0b" metalness={0.3} roughness={0.5} />
        <Edges color="#92400e" />
      </mesh>
      {/* جیب کانترویت */}
      <mesh position={[-3.4, H + 1.0, 0]} castShadow>
        <boxGeometry args={[6.2, 0.8, 1.3]} />
        <meshStandardMaterial color="#a16207" metalness={0.3} roughness={0.5} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-5.0 - i * 0.65, H + 0.35, 0]} castShadow>
          <boxGeometry args={[0.55, 1.3, 1.1]} />
          <meshStandardMaterial color="#52525b" roughness={0.7} />
        </mesh>
      ))}
      {/* مهارها */}
      <Line points={[[0, H + 3.6, 0], [jibLengthM * 0.45, H + 1.5, 0]]} color="#71717a" lineWidth={1.2} />
      <Line points={[[0, H + 3.6, 0], [-5.6, H + 1.4, 0]]} color="#71717a" lineWidth={1.2} />
      {/* تالی */}
      <mesh position={[radiusM, H + 0.35, 0]} castShadow>
        <boxGeometry args={[0.9, 0.5, 0.9]} />
        <meshStandardMaterial color="#1c1917" metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
}

// ───────────────────────── قلاب، اسلینگ و بار ─────────────────────────
function HookAndLoad({
  inputs,
  hookX,
  hookTopY,
  statusColor,
  showLabels,
  showForces,
  grossT,
  attached,
}: {
  inputs: LiftInputs;
  hookX: number;
  hookTopY: number;
  statusColor: string;
  showLabels: boolean;
  showForces: boolean;
  grossT: number;
  attached: boolean;
}) {
  const { loadDims: dims, rigging } = inputs;
  const blockY = hookTopY - HOOK_BLOCK_HEIGHT_M;

  // افت عمودی اسلینگ‌ها (مطابق منطق تحلیل)
  const halfSpan = Math.max(dims.lengthM, dims.widthM) / 2;
  const beta = Math.max(rigging.slingAngleDeg, 10);
  const drop = rigging.useSpreader ? 1.2 + halfSpan * 0.25 : halfSpan * Math.tan(beta * D2R);

  const loadTopY = Math.max(dims.heightM, blockY - drop - 0.15);
  const loadCenterY = loadTopY - dims.heightM / 2;
  const liftLen = clamp(grossT * 0.12, 1.4, 5);

  const slingColor = "#e5e5e5";
  const barY = blockY - 1.2;

  // نقاط اتصال اسلینگ‌ها
  const slingLines: [number, number, number][][] = useMemo(() => {
    if (rigging.useSpreader) {
      const ends = rigging.slingCount === 4 ? 1 : 1;
      const lower: [number, number, number][][] = [];
      // اسلینگ‌های بالایی: قلاب → دو سر تیر
      const up1: [number, number, number][] = [[hookX, blockY, 0], [hookX - halfSpan - 0.3, barY, 0]];
      const up2: [number, number, number][] = [[hookX, blockY, 0], [hookX + halfSpan + 0.3, barY, 0]];
      lower.push(up1, up2);
      if (rigging.slingCount === 4) {
        for (const sx of [-1, 1]) {
          for (const sz of [-1, 1]) {
            lower.push([
              [hookX + sx * (halfSpan + 0.3), barY, 0],
              [hookX + sx * (dims.lengthM / 2), loadTopY, sz * (dims.widthM / 2)],
            ]);
          }
        }
      } else {
        for (const sx of [-1, 1]) {
          lower.push([
            [hookX + sx * (halfSpan + 0.3), barY, 0],
            [hookX + sx * (dims.lengthM / 2), loadTopY, 0],
          ]);
        }
      }
      return lower.slice(0, 2 + ends * rigging.slingCount);
    }
    if (rigging.slingCount === 4) {
      return ([-1, 1] as const).flatMap((sx) =>
        ([-1, 1] as const).map(
          (sz): [number, number, number][] => [
            [hookX, blockY, 0],
            [hookX + sx * (dims.lengthM / 2), loadTopY, sz * (dims.widthM / 2)],
          ]
        )
      );
    }
    return ([-1, 1] as const).map(
      (sx): [number, number, number][] => [
        [hookX, blockY, 0],
        [hookX + sx * (dims.lengthM / 2), loadTopY, 0],
      ]
    );
  }, [rigging.useSpreader, rigging.slingCount, hookX, blockY, barY, halfSpan, loadTopY, dims.lengthM, dims.widthM]);

  return (
    <group>
      {/* کابل جرثقیل */}
      <Line points={[[hookX, hookTopY, 0], [hookX, blockY + 0.45, 0]]} color="#d4d4d8" lineWidth={1.4} />
      {/* بلاک قلاب */}
      <mesh position={[hookX, blockY, 0]} castShadow>
        <boxGeometry args={[0.55, 0.85, 0.45]} />
        <meshStandardMaterial color="#1c1917" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[hookX, blockY - 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.07, 0.3, 8]} />
        <meshStandardMaterial color="#a1a1aa" metalness={0.8} roughness={0.25} />
      </mesh>

      {/* تیر پخش‌کننده */}
      {rigging.useSpreader && attached && (
        <mesh position={[hookX, barY, 0]} castShadow>
          <boxGeometry args={[halfSpan * 2 + 0.9, 0.28, 0.28]} />
          <meshStandardMaterial color="#52525b" metalness={0.5} roughness={0.4} />
        </mesh>
      )}

      {/* اسلینگ‌ها — فقط وقتی بار قلاب شده */}
      {attached &&
        slingLines.map((pts, i) => (
          <Line key={i} points={pts} color={slingColor} lineWidth={1.6} />
        ))}

      {/* بار آویزان — رنگ بر اساس وضعیت تحلیل */}
      {attached && (
        <mesh position={[hookX, loadCenterY, 0]} castShadow>
          <boxGeometry args={[dims.lengthM, dims.heightM, dims.widthM]} />
          <meshStandardMaterial color={statusColor} metalness={0.25} roughness={0.55} transparent opacity={0.92} />
          <Edges color="#ffffff" />
        </mesh>
      )}

      {/* خطوط نیرو */}
      {showForces && attached && (
        <group>
          {/* وزن بار (به پایین) */}
          <ForceArrow origin={[hookX, loadCenterY + dims.heightM / 2 - 0.1, 0]} length={liftLen} color="#ef4444" dir={-1} />
          {/* نیروی بالابر (به بالا) */}
          <ForceArrow origin={[hookX, loadTopY + 0.1, 0]} length={liftLen * 0.85} color="#22c55e" dir={1} />
        </group>
      )}

      {/* برچسب‌ها */}
      {showLabels && attached && (
        <>
          <Label3D position={[hookX, loadCenterY, 0]} text={`W = ${grossT.toFixed(1)} t`} />
          <Label3D
            position={[hookX, loadTopY + 0.9, 0]}
            text={`h = ${loadTopY.toFixed(1)} m`}
            color="#111111"
            bg={statusColor}
          />
        </>
      )}
    </group>
  );
}

// ───────────────────────── بدنه اصلی صحنه ─────────────────────────
function SceneContent() {
  const selectedId = useLiftStore((s) => s.selectedCraneId);
  const inputs = useLiftStore((s) => s.inputs);
  const result = useLiftStore((s) => s.result);
  const cranePos = useLiftStore((s) => s.cranePos);
  const view = useView3D();
  const pick = useLiftStore((s) => s.pickPoint);
  const place = useLiftStore((s) => s.placePoint);
  const simActive = useSim((s) => s.active);
  const simPose = useSim((s) => s.pose);

  const customCranes = useLiftStore((s) => s.customCranes);
  const crane = getCraneById(selectedId, customCranes);

  // مرکز استقرار جرثقیل (قابل جابه‌جایی — پیش‌فرض: مرکز صحنه)
  const o: GroundPoint = cranePos ?? { x: 0, z: 0 };

  // وقتی پرچم A ثبت شده و شبیه‌سازی اجرا نمی‌شود، جرثقیل رو به نقطه برداشت می‌ایستد
  // (شعاع و زاویه چرخش «نسبت به محل جرثقیل» محاسبه می‌شود)
  const effInputs = useMemo(() => {
    if (pick && !simActive && !simPose) {
      const rx = pick.x - o.x;
      const rz = pick.z - o.z;
      return {
        ...inputs,
        radiusMode: "radius" as const,
        radiusM: Math.hypot(rx, rz),
        slewAngleDeg: slewDegFor(rx, rz),
      };
    }
    return inputs;
  }, [pick, inputs, simActive, simPose, o.x, o.z]);

  const geo = useMemo(() => (crane ? solveGeometry(crane, effInputs) : null), [crane, effInputs]);

  const pose: SimPose | null = simActive || simPose ? simPose : null;
  const grossT = inputs.loadWeightT + inputs.hookBlockWeightT + inputs.riggingWeightT;

  // رنگ بار: حین شبیه‌سازی رنگ نقطه فعال، در غیر این صورت رنگ نتیجه تحلیل
  const statusColor = pose
    ? pose.statusColor
    : result
      ? STATUS_COLORS[result.status]
      : "#a1a1aa";

  if (!crane || !geo) return null;

  const isTower = crane.type === "tower";
  const slopeRad = inputs.groundSlopeDeg * D2R;

  // هندسه قلاب — حین شبیه‌سازی از پوز زنده، وگرنه از هندسه ایستا
  const boomLen = effInputs.boomLengthM;
  const jibH = effInputs.useJib ? effInputs.jibLengthM * Math.cos(effInputs.jibAngleDeg * D2R) : 0;
  const jibV = effInputs.useJib ? effInputs.jibLengthM * Math.sin(effInputs.jibAngleDeg * D2R) : 0;
  const fbAngle = pose ? pose.boomDeg : geo.ok && !isTower ? geo.boomAngleDeg : effInputs.boomAngleDeg;
  const slewRad = pose ? -pose.slewDeg * D2R : -effInputs.slewAngleDeg * D2R;
  const hookX = pose ? pose.hookX : isTower ? geo.radiusM : crane.specs.pivotOffsetM + boomLen * Math.cos(fbAngle * D2R) + jibH;
  const hookY = pose
    ? pose.hookTopY
    : isTower
      ? (crane.specs.freestandingHookHeightM ?? 50)
      : crane.specs.pivotHeightM + boomLen * Math.sin(fbAngle * D2R) + jibV;

  // اتصال بار: حین شبیه‌سازی طبق پوز؛ با پرچم A بار روی زمین است؛ بدون پرچم آویزان از قلاب
  const attached = pose ? pose.attached : !pick || simActive;
  // بار روی زمین در کدام نقطه است؟
  const loadGround: "A" | "B" | null = pose
    ? pose.loadGround
    : pick && !simActive
      ? "A"
      : null;

  const exRadius = Math.max(geo.tipRadiusM || hookX, effInputs.boomLengthM) + 3;
  const radiusDisp = pose ? pose.radiusM : geo.radiusM;

  // مختصات جهانی بار برای خط شعاع (نسبت به محل استقرار جرثقیل)
  const loadWorldX = o.x + Math.cos(-slewRad) * hookX;
  const loadWorldZ = o.z + Math.sin(-slewRad) * hookX;

  const handleGroundClick = (x: number, z: number) => {
    const st = useLiftStore.getState();
    const vw = useView3D.getState();
    const p = { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 };
    if (vw.flagMode === "pick") {
      st.setPickPoint(p);
      // اگر B هنوز ثبت نشده، حالت بعدی = پرچم B
      const placeExisting = useLiftStore.getState().placePoint;
      vw.setFlagMode(placeExisting ? "off" : "place");
    } else if (vw.flagMode === "place") {
      st.setPlacePoint(p);
      vw.setFlagMode("off");
    } else if (vw.flagMode === "moveCrane") {
      // جابه‌جایی جرثقیل — پوز شبیه‌سازی قبلی هم پاک می‌شود
      st.setCranePos(p);
      useSim.getState().reset();
      vw.clearMode();
    } else if (vw.flagMode === "object" && vw.pendingObjectType) {
      // افزودن تجهیز محوطه — حالت فعال می‌ماند تا چند تجهیز پشت‌سرهم گذاشته شود
      st.addSceneObject(vw.pendingObjectType, x, z);
    } else {
      // کلیک ساده: لغو انتخاب تجهیز
      if (vw.selectedObjectId) vw.set({ selectedObjectId: null });
    }
  };

  return (
    <>
      <CaptureRegister />
      <SimDriver />
      <CameraRig radius={hookX} height={hookY} frozen={simActive} center={[o.x, o.z]} />
      <color attach="background" args={["#18181b"]} />
      <fog attach="fog" args={["#18181b", 100, 280]} />
      <hemisphereLight args={["#e7e5e4", "#1c1917", 0.55]} />
      <ambientLight intensity={0.3} />
      <directionalLight
        castShadow
        position={[38, 55, 26]}
        intensity={1.5}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
        shadow-camera-far={220}
      />
      <directionalLight position={[-30, 25, -20]} intensity={0.35} color="#fef3c7" />

      {/* دنیای شیب‌دار (زمین + جرثقیل + بار + تجهیزات) */}
      <group rotation={[0, 0, slopeRad]}>
        <Ground flagMode={view.flagMode} onGroundClick={handleGroundClick} />

        {/* تجهیزات محوطه (نیروگاه / پالایشگاه) */}
        <SceneObjectsLayer />

        {/* منطقه ممنوعه — حول محل استقرار جرثقیل */}
        {view.exclusion && (
          <group position={[o.x, 0, o.z]}>
            <ExclusionZone radiusM={exRadius} />
          </group>
        )}

        {/* حلقه شعاع و پرچم نقطه A (برداشت) — شعاع نسبت به جرثقیل */}
        {pick && view.radiusLine && (
          <group position={[o.x, 0, o.z]}>
            <RadiusRing radiusM={Math.hypot(pick.x - o.x, pick.z - o.z)} color="#f59e0b" />
          </group>
        )}
        {pick && (
          <FlagMarker x={pick.x} z={pick.z} label="A — برداشت" color="#f59e0b" showLabels={view.labels} />
        )}

        {/* حلقه شعاع و پرچم نقطه B (جایگذاری) */}
        {place && view.radiusLine && (
          <group position={[o.x, 0, o.z]}>
            <RadiusRing radiusM={Math.hypot(place.x - o.x, place.z - o.z)} color="#10b981" />
          </group>
        )}
        {place && (
          <FlagMarker x={place.x} z={place.z} label="B — جایگذاری" color="#10b981" showLabels={view.labels} />
        )}

        {/* بار روی زمین (قبل از برداشت یا بعد از جایگذاری) */}
        {loadGround === "A" && pick && (
          <GroundLoad
            x={pick.x}
            z={pick.z}
            groundY={inputs.pickHeightM}
            inputs={inputs}
            color={statusColor}
            showLabels={view.labels}
            grossT={grossT}
          />
        )}
        {loadGround === "B" && place && (
          <GroundLoad
            x={place.x}
            z={place.z}
            groundY={inputs.placeHeightM}
            inputs={inputs}
            color={statusColor}
            showLabels={view.labels}
            grossT={grossT}
          />
        )}

        {/* خط شعاع کاری روی زمین — از محل جرثقیل تا بار */}
        {view.radiusLine && (
          <group>
            <Line
              points={[[o.x, 0.06, o.z], [loadWorldX, 0.06, loadWorldZ]]}
              color="#f59e0b"
              lineWidth={2}
              dashed
              dashSize={0.9}
              gapSize={0.5}
            />
            {view.labels && (
              <Label3D
                position={[(o.x + loadWorldX) / 2, 0.8, (o.z + loadWorldZ) / 2]}
                text={`R = ${radiusDisp.toFixed(1)} m`}
                color="#fbbf24"
                bg="rgba(15,10,2,0.78)"
                border="rgba(245,158,11,0.45)"
              />
            )}
          </group>
        )}

        {/* جرثقیل با دوران سوپراستراکچر — روی محل استقرار انتخابی */}
        <group position={[o.x, 0, o.z]} rotation={[0, slewRad, 0]}>
          {crane.type === "mobile" && (
            <MobileCrane
              specs={crane.specs}
              boomAngleRad={fbAngle * D2R}
              boomLengthM={boomLen}
              useJib={inputs.useJib}
              jibLengthM={inputs.jibLengthM}
              jibAngleRad={inputs.jibAngleDeg * D2R}
            />
          )}
          {crane.type === "crawler" && (
            <CrawlerCrane
              specs={crane.specs}
              boomAngleRad={fbAngle * D2R}
              boomLengthM={boomLen}
              useJib={inputs.useJib}
              jibLengthM={inputs.jibLengthM}
              jibAngleRad={inputs.jibAngleDeg * D2R}
            />
          )}
          {crane.type === "tower" && (
            <TowerCrane specs={crane.specs} jibLengthM={boomLen} radiusM={hookX} />
          )}
          {/* برچسب زنده زاویه بوم و طول بوم داخل صحنه */}
          {view.labels && (
            <BoomAngleLabel
              isTower={isTower}
              boomDeg={fbAngle}
              boomLen={boomLen}
              pivotOffsetM={crane.specs.pivotOffsetM}
              pivotHeightM={isTower ? (crane.specs.freestandingHookHeightM ?? 50) : crane.specs.pivotHeightM}
              radiusM={radiusDisp}
            />
          )}
          <HookAndLoad
            inputs={inputs}
            hookX={hookX}
            hookTopY={hookY}
            statusColor={statusColor}
            showLabels={view.labels}
            showForces={view.forces}
            grossT={grossT}
            attached={attached}
          />
        </group>

        {/* مانع */}
        {inputs.obstacle.enabled && (
          <mesh position={[inputs.obstacle.xM, inputs.obstacle.heightM / 2, inputs.obstacle.zM]} castShadow>
            <boxGeometry args={[inputs.obstacle.widthM, inputs.obstacle.heightM, inputs.obstacle.widthM]} />
            <meshStandardMaterial color="#f97316" transparent opacity={0.45} roughness={0.6} />
            <Edges color="#ea580c" />
          </mesh>
        )}
      </group>

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={4}
        maxDistance={240}
        maxPolarAngle={Math.PI / 2.04}
      />
    </>
  );
}

/** صحنه کامل — فقط client-only لود شود */
export default function CraneScene() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      camera={{ fov: 45, position: [28, 18, 28], near: 0.5, far: 500 }}
      style={{ width: "100%", height: "100%" }}
    >
      <SceneContent />
    </Canvas>
  );
}
