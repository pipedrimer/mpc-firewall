'use client';

import { useEffect, useRef, useState } from 'react';
import type { FirewallEvaluationRecord, FirewallPolicy } from '@mpc-firewall/core';
import type { ScenarioPresetView } from '@/components/TxWorkbench';
import {
  AlertOctagon,
  ArrowRight,
  ArrowUpRight,
  Box,
  Bug,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cpu,
  EyeOff,
  Landmark,
  Layers,
  Lock,
  MoveHorizontal,
  RotateCcw,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  UserCheck
} from 'lucide-react';

export interface ScenarioStoryMeta {
  index: string;
  shortLabel: string;
  humanTitle: string;
  plainSummary: string;
  assistantClaim: string;
  hiddenReality: string;
  withoutResult: string;
  withResult: string;
  dollarBadge: string;
  illustration: string;
  networkLabel: string;
}

interface InteractiveXRayStageProps {
  presets: ScenarioPresetView[];
  preset: ScenarioPresetView | null;
  storyMap: Record<string, ScenarioStoryMeta>;
  meta: ScenarioStoryMeta;
  record: FirewallEvaluationRecord | null;
  policy?: FirewallPolicy | null;
  savingPolicy?: boolean;
  onTogglePolicy?: (patch: Partial<FirewallPolicy>) => void;
  onResetPolicy?: () => void;
  isTamperedSimulation?: boolean;
  onTamperSimulation?: (injectTrap: boolean) => void;
  loading: boolean;
  scanPulseId?: number;
  lastScanDurationMs?: number | null;
  onSelectPreset: (preset: ScenarioPresetView) => void;
  onInspect: () => void;
}

interface AnatomyField {
  label: string;
  value: string;
  status: 'safe' | 'warn' | 'danger';
}

function buildAnatomyFields(record: FirewallEvaluationRecord | null, isBlocked: boolean, isEscalated: boolean): AnatomyField[] {
  if (!record) {
    return [
      { label: 'Target Network', value: 'Base (Chain 8453)', status: 'safe' },
      { label: 'Decoded Call', value: 'ERC-20 transfer()', status: 'safe' },
      { label: 'Extracted Value', value: '25.00 USDC', status: 'safe' },
      { label: 'Counterparty', value: '0x1111…1111 (Verified)', status: 'safe' }
    ];
  }

  const codes = record.decision.codes;
  const d = record.decoded;

  if (d.kind === 'bitcoin') {
    const sats = Number(d.totalOutputSats || '0').toLocaleString();
    const out0 = d.outputs[0];
    const shortScript = out0?.scriptPubKeyHex
      ? `${out0.scriptPubKeyHex.slice(0, 10)}…${out0.scriptPubKeyHex.slice(-6)}`
      : 'raw-script';
    return [
      { label: 'Target Network', value: `Bitcoin (${d.isSegwit ? 'SegWit' : 'Legacy'})`, status: 'safe' },
      { label: 'Output Count', value: `${d.outputs.length} Raw UTXO Output(s)`, status: 'safe' },
      {
        label: 'Extracted Value',
        value: `${sats} sats`,
        status: codes.includes('ERR_BTC_OUTPUT_EXCEEDS_CAP') ? 'danger' : 'safe'
      },
      {
        label: 'Output Script',
        value: `${shortScript} (Unapproved)`,
        status: codes.includes('ERR_BTC_UNAPPROVED_OUTPUT_SCRIPT') || isBlocked ? 'danger' : 'safe'
      }
    ];
  }

  // EVM Decoded Anatomy
  const chainWrong = codes.includes('ERR_CHAIN_ID_NOT_ALLOWED');
  const chainName =
    d.chainId === 8453
      ? 'Base (Chain 8453)'
      : d.chainId === 1
        ? 'Ethereum Mainnet (Chain 1)'
        : `EVM Chain ${d.chainId}`;

  const root = d.rootCall;
  const hasNested = root.nestedCalls.length > 0;
  const actionSummary = hasNested
    ? `multicall (${root.nestedCalls.length} nested calls)`
    : `${root.action} (${root.selector})`;

  let amountText = '0 ETH';
  let amountStatus: 'safe' | 'warn' | 'danger' = 'safe';

  const checkUnlimited =
    codes.includes('ERR_UNLIMITED_APPROVAL') ||
    codes.includes('ERR_NESTED_MULTICALL_VIOLATION');

  if (checkUnlimited) {
    amountText = 'UNLIMITED (2²⁵⁶ - 1)';
    amountStatus = 'danger';
  } else if (codes.includes('ERR_SET_APPROVAL_FOR_ALL_BLOCKED')) {
    amountText = '100% NFT Vault Access';
    amountStatus = 'danger';
  } else if (root.tokenAmount) {
    const usdc = Number(root.tokenAmount) / 1_000_000;
    amountText = `${usdc.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`;
    amountStatus = isEscalated ? 'warn' : isBlocked ? 'danger' : 'safe';
  } else if (d.valueWei && d.valueWei !== '0') {
    const eth = Number(d.valueWei) / 1e18;
    amountText = `${eth} ETH`;
    amountStatus = isBlocked ? 'danger' : 'safe';
  }

  const rawTarget =
    root.spenderOrOperator ||
    root.recipient ||
    d.to ||
    '0x0000';
  const shortTarget =
    rawTarget.length > 14 ? `${rawTarget.slice(0, 8)}…${rawTarget.slice(-4)}` : rawTarget;

  return [
    {
      label: 'Target Network',
      value: chainName,
      status: chainWrong ? 'danger' : 'safe'
    },
    {
      label: 'Unpacked Function',
      value: actionSummary,
      status:
        hasNested ||
        codes.includes('ERR_UNLIMITED_APPROVAL') ||
        codes.includes('ERR_SET_APPROVAL_FOR_ALL_BLOCKED') ||
        codes.includes('ERR_UNKNOWN_SELECTOR_BLOCKED')
          ? 'danger'
          : 'safe'
    },
    {
      label: 'Decoded Amount',
      value: amountText,
      status: amountStatus
    },
    {
      label: 'Destination / Spender',
      value: isBlocked && !chainWrong ? `${shortTarget} (Blocked)` : `${shortTarget} (Verified)`,
      status: isBlocked && !chainWrong ? 'danger' : 'safe'
    }
  ];
}

export function InteractiveXRayStage({
  presets,
  preset,
  storyMap,
  meta,
  record,
  policy,
  savingPolicy = false,
  onTogglePolicy,
  onResetPolicy,
  isTamperedSimulation = false,
  onTamperSimulation,
  loading,
  scanPulseId = 0,
  onSelectPreset,
  onInspect
}: InteractiveXRayStageProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const splitViewportRef = useRef<HTMLDivElement | null>(null);
  const tiltChassisRef = useRef<HTMLDivElement | null>(null);
  const floatingBadgeRef = useRef<HTMLDivElement | null>(null);
  const glareRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [xrayAperturePct, setXrayAperturePct] = useState<number>(78);
  const apertureRef = useRef<number>(78);
  useEffect(() => {
    apertureRef.current = xrayAperturePct;
  }, [xrayAperturePct]);

  // Interactive Human CFO Co-Sign state for Scenario 06 (DAO Escalation)
  const [daoApprovedByHuman, setDaoApprovedByHuman] = useState(false);
  useEffect(() => {
    setDaoApprovedByHuman(false);
  }, [preset?.id, record?.id, scanPulseId]);

  const draggingSliderRef = useRef<boolean>(false);
  const orbitingCanvasRef = useRef<{ active: boolean; lastX: number; lastY: number }>({
    active: false,
    lastX: 0,
    lastY: 0
  });

  const physicsRef = useRef({
    targetX: 0,
    targetY: 0,
    currentX: 0,
    currentY: 0,
    orbitYaw: 0.55,
    orbitPitch: 0.38
  });

  const outcome = record?.decision.outcome;
  const isBlocked = outcome === 'BLOCKED' || (!outcome && preset?.badge === 'ATTACK');
  const isEscalated =
    (outcome === 'ESCALATE_TO_DAO' || (!outcome && preset?.badge === 'DAO_ESCALATION')) &&
    !daoApprovedByHuman;
  const isApproved =
    outcome === 'APPROVED_FOR_MPC_SIGN' ||
    daoApprovedByHuman ||
    (!outcome && preset?.badge === 'SAFE');

  const anatomyFields = buildAnatomyFields(record, isBlocked, isEscalated);

  // Smooth X-Ray sweep when switching scenarios OR clicking "Scan Selected Errand"
  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const duration = 700;
    const from = 0;
    const to = 82;

    physicsRef.current.orbitYaw += 0.85;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = Math.round(from + (to - from) * eased);
      apertureRef.current = val;
      setXrayAperturePct(val);
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [preset?.id, scanPulseId]);

  // 60fps True 3D Chassis Tilt + Interactive 3D Exploded-View Hologram Canvas
  useEffect(() => {
    let rafId = 0;
    let time = 0;

    const render = () => {
      time += 0.016;
      const p = physicsRef.current;

      const targetTiltX = draggingSliderRef.current ? 0 : p.targetX;
      const targetTiltY = draggingSliderRef.current ? 0 : p.targetY;

      p.currentX += (targetTiltX - p.currentX) * 0.1;
      p.currentY += (targetTiltY - p.currentY) * 0.1;

      if (!orbitingCanvasRef.current.active) {
        p.orbitYaw += 0.009;
      }

      if (tiltChassisRef.current) {
        const rotY = p.currentX * 6.0;
        const rotX = -p.currentY * 4.8;
        tiltChassisRef.current.style.transform = `rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg)`;
      }

      if (floatingBadgeRef.current) {
        const shiftX = p.currentX * 8;
        const shiftY = p.currentY * 6;
        floatingBadgeRef.current.style.transform = `translate3d(${shiftX.toFixed(1)}px, ${shiftY.toFixed(1)}px, 28px)`;
      }

      if (glareRef.current) {
        const gx = 50 + p.currentX * 38;
        const gy = 50 + p.currentY * 38;
        glareRef.current.style.background = `radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,0.48) 0%, rgba(255,255,255,0) 62%)`;
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
        const rectWidth = canvas.clientWidth || 320;
        const rectHeight = canvas.clientHeight || 190;
        if (canvas.width !== Math.round(rectWidth * dpr) || canvas.height !== Math.round(rectHeight * dpr)) {
          canvas.width = Math.round(rectWidth * dpr);
          canvas.height = Math.round(rectHeight * dpr);
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.scale(dpr, dpr);
          const w = rectWidth;
          const h = rectHeight;
          ctx.clearRect(0, 0, w, h);

          const cx = w / 2 + p.currentX * 10;
          const cy = h / 2 + p.currentY * 6;

          const openRatio = Math.max(0, Math.min(1, apertureRef.current / 100));

          const primaryColor = isBlocked
            ? '#E11D48'
            : isEscalated
              ? '#D97706'
              : '#1F3CFF';
          const coreColor = isBlocked
            ? '#F43F5E'
            : isEscalated
              ? '#F59E0B'
              : '#059669';

          for (const r of [38, 60, 82]) {
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.strokeStyle = isBlocked
              ? 'rgba(225, 29, 72, 0.12)'
              : isEscalated
                ? 'rgba(217, 119, 6, 0.12)'
                : 'rgba(31, 60, 255, 0.12)';
            ctx.lineWidth = 1;
            ctx.stroke();
          }

          const yaw = p.orbitYaw + p.currentX * 0.55;
          const pitch = p.orbitPitch + p.currentY * 0.45;

          const project3D = (x: number, y: number, z: number, scale: number) => {
            const x1 = x * Math.cos(yaw) - z * Math.sin(yaw);
            const z1 = z * Math.cos(yaw) + x * Math.sin(yaw);
            const y2 = y * Math.cos(pitch) - z1 * Math.sin(pitch);
            const z2 = z1 * Math.cos(pitch) + y * Math.sin(pitch);
            const fov = 280 / (280 + z2 * 24);
            return {
              x: cx + x1 * scale * fov,
              y: cy + y2 * scale * fov,
              z: z2
            };
          };

          const explodeOffset = openRatio * 0.65;
          const faceDefs = [
            {
              normal: [0, 0, 1],
              verts: [
                [-1, -1, 1],
                [1, -1, 1],
                [1, 1, 1],
                [-1, 1, 1]
              ]
            },
            {
              normal: [0, 0, -1],
              verts: [
                [-1, -1, -1],
                [1, -1, -1],
                [1, 1, -1],
                [-1, 1, -1]
              ]
            },
            {
              normal: [1, 0, 0],
              verts: [
                [1, -1, -1],
                [1, 1, -1],
                [1, 1, 1],
                [1, -1, 1]
              ]
            },
            {
              normal: [-1, 0, 0],
              verts: [
                [-1, -1, -1],
                [-1, 1, -1],
                [-1, 1, 1],
                [-1, -1, 1]
              ]
            },
            {
              normal: [0, 1, 0],
              verts: [
                [-1, 1, -1],
                [1, 1, -1],
                [1, 1, 1],
                [-1, 1, 1]
              ]
            },
            {
              normal: [0, -1, 0],
              verts: [
                [-1, -1, -1],
                [1, -1, -1],
                [1, -1, 1],
                [-1, -1, 1]
              ]
            }
          ];

          const projectedFaces = faceDefs
            .map((f) => {
              const [nx, ny, nz] = f.normal;
              const pts = f.verts.map(([vx, vy, vz]) =>
                project3D(
                  vx + nx * explodeOffset,
                  vy + ny * explodeOffset,
                  vz + nz * explodeOffset,
                  30
                )
              );
              const avgZ = pts.reduce((acc, pt) => acc + pt.z, 0) / pts.length;
              return { pts, avgZ };
            })
            .sort((a, b) => b.avgZ - a.avgZ);

          for (const face of projectedFaces) {
            ctx.beginPath();
            ctx.moveTo(face.pts[0].x, face.pts[0].y);
            for (let i = 1; i < face.pts.length; i++) {
              ctx.lineTo(face.pts[i].x, face.pts[i].y);
            }
            ctx.closePath();
            const darkAlpha = (1 - openRatio) * 0.55 + 0.06;
            ctx.fillStyle =
              openRatio < 0.35
                ? `rgba(11, 15, 23, ${darkAlpha.toFixed(2)})`
                : isBlocked
                  ? 'rgba(225, 29, 72, 0.06)'
                  : isEscalated
                    ? 'rgba(217, 119, 6, 0.06)'
                    : 'rgba(31, 60, 255, 0.06)';
            ctx.fill();
            ctx.strokeStyle = primaryColor;
            ctx.lineWidth = 1.4;
            ctx.stroke();
          }

          const coreScale = 13 + openRatio * 13 + Math.sin(time * 3) * 2;
          const octaVerts = [
            [0, -1.25, 0],
            [1.25, 0, 0],
            [0, 0, 1.25],
            [-1.25, 0, 0],
            [0, 0, -1.25],
            [0, 1.25, 0]
          ];
          const octaEdges = [
            [0, 1], [0, 2], [0, 3], [0, 4],
            [5, 1], [5, 2], [5, 3], [5, 4],
            [1, 2], [2, 3], [3, 4], [4, 1]
          ];
          const innerPts = octaVerts.map(([x, y, z]) => project3D(x, y, z, coreScale));

          const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 42);
          grad.addColorStop(
            0,
            isBlocked
              ? 'rgba(244, 63, 94, 0.45)'
              : isEscalated
                ? 'rgba(245, 158, 11, 0.45)'
                : 'rgba(16, 185, 129, 0.45)'
          );
          grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(cx, cy, 42, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = coreColor;
          ctx.lineWidth = 2.1;
          for (const [a, b] of octaEdges) {
            ctx.beginPath();
            ctx.moveTo(innerPts[a].x, innerPts[a].y);
            ctx.lineTo(innerPts[b].x, innerPts[b].y);
            ctx.stroke();
          }

          for (const pt of innerPts) {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = coreColor;
            ctx.fill();
          }

          ctx.font = '600 10px monospace';
          ctx.fillStyle = '#0B0F17';
          ctx.fillText(
            openRatio > 0.25
              ? `UNPACKED SHELLS: ${Math.round(openRatio * 100)}%`
              : 'SEALED 32B ENVELOPE',
            10,
            16
          );
          ctx.fillStyle = coreColor;
          ctx.fillText(
            isBlocked
              ? 'CORE: TRAP DETECTED'
              : isEscalated
                ? 'CORE: DAO VOTE'
                : 'CORE: VERIFIED SAFE',
            10,
            h - 8
          );

          ctx.restore();
        }
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [isBlocked, isEscalated]);

  function updateApertureFromClientX(clientX: number) {
    const viewport = splitViewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    if (rect.width <= 0) return;
    const rawPct = ((clientX - rect.left) / rect.width) * 100;
    const clampedLeft = Math.max(0, Math.min(100, rawPct));
    const snappedLeft = clampedLeft < 1.5 ? 0 : clampedLeft > 98.5 ? 100 : clampedLeft;
    const nextAperture = Math.round(100 - snappedLeft);
    apertureRef.current = nextAperture;
    setXrayAperturePct(nextAperture);
  }

  function handleStagePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    // Only apply 3D mouse tilt on mouse/pen to keep touchscreens completely steady
    if (e.pointerType === 'touch') return;
    const el = stageRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    physicsRef.current.targetX = Math.max(-1, Math.min(1, nx));
    physicsRef.current.targetY = Math.max(-1, Math.min(1, ny));

    if (draggingSliderRef.current) {
      updateApertureFromClientX(e.clientX);
    }
  }

  function handleStagePointerLeave() {
    physicsRef.current.targetX = 0;
    physicsRef.current.targetY = 0;
  }

  const activeIdx = presets.findIndex((p) => p.id === preset?.id);
  function handleStepScenario(delta: number) {
    if (!presets.length) return;
    const cur = activeIdx >= 0 ? activeIdx : 0;
    const nextIdx = (cur + delta + presets.length) % presets.length;
    onSelectPreset(presets[nextIdx]);
  }

  const handleLeftPct = 100 - xrayAperturePct;
  const autoCapUsdc = policy ? Math.round(Number(policy.autoApproveTokenUnits) / 1_000_000) : 100;

  const digestHex =
    record?.decoded.sighashPayloadHex ||
    '0x7a2d40fdb3a173f09524c6f82439f4edba352f082853f4db0d6c01dd7e63cf55';

  return (
    <div
      ref={stageRef}
      onPointerMove={handleStagePointerMove}
      onPointerUp={() => {
        draggingSliderRef.current = false;
        orbitingCanvasRef.current.active = false;
      }}
      onPointerLeave={handleStagePointerLeave}
      className="relative select-none"
      style={{ perspective: '1400px' }}
    >
      {/* Ambient Color Halo Behind 3D Stage */}
      <div
        className={`pointer-events-none absolute -inset-3 -z-10 rounded-[32px] opacity-70 blur-2xl transition-colors duration-500 ${
          isBlocked
            ? 'bg-gradient-to-tr from-[#E11D48]/25 via-[#1F3CFF]/15 to-[#F43F5E]/25'
            : isEscalated
              ? 'bg-gradient-to-tr from-[#D97706]/25 via-[#1F3CFF]/15 to-[#F59E0B]/25'
              : 'bg-gradient-to-tr from-[#059669]/25 via-[#1F3CFF]/20 to-[#38BDF8]/25'
        }`}
      />

      {/* =====================================================================
          3D TILTING CHASSIS (NO overflow-hidden here so preserve-3d works!)
         ===================================================================== */}
      <div
        ref={tiltChassisRef}
        className="relative transition-shadow duration-300"
        style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
      >
        {/* Floating 3D Parallax Badge */}
        <div
          ref={floatingBadgeRef}
          className="pointer-events-none absolute -top-3.5 right-6 z-40 hidden sm:flex"
          style={{ transform: 'translate3d(0px, 0px, 28px)' }}
        >
          <div
            className={`inline-flex items-center gap-2 rounded-full border-2 border-white px-3.5 py-1 text-xs font-extrabold text-white shadow-[0_10px_25px_rgba(11,15,23,0.28)] ${
              isBlocked
                ? 'bg-[#E11D48]'
                : isEscalated
                  ? 'bg-[#D97706]'
                  : 'bg-[#059669]'
            }`}
          >
            <Box className="h-3.5 w-3.5" />
            <span>
              {isTamperedSimulation
                ? 'PROMPT-INJECTION DETECTED'
                : daoApprovedByHuman
                  ? 'CFO CO-SIGNED • APPROVED'
                  : `3D X-Ray • ${meta.dollarBadge}`}
            </span>
          </div>
        </div>

        {/* Inner Clipped Card Surface */}
        <div
          className={`relative overflow-hidden rounded-[26px] border-2 bg-white shadow-[0_32px_64px_-20px_rgba(11,15,23,0.18)] transition-colors duration-300 ${
            isBlocked
              ? 'border-[#FDA4AF]'
              : isEscalated
                ? 'border-[#FCD34D]'
                : 'border-[#93C5FD]'
          }`}
        >
          {/* Specular Glare Overlay */}
          <div
            ref={glareRef}
            className="pointer-events-none absolute inset-0 z-30 opacity-45 mix-blend-overlay"
          />

          {/* =================================================================
              TOP INSTRUMENT BAR: ACTIVE SCENARIO + 0%–100% APERTURE CONTROLS
             ================================================================= */}
          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 border-b border-[#DCE2EE] bg-gradient-to-r from-[#0B0F17] via-[#111827] to-[#1E293B] px-3.5 sm:px-5 py-2.5 sm:py-3 text-white">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <span
                className={`flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full font-mono text-[10px] sm:text-[11px] font-bold text-white ${
                  isBlocked
                    ? 'bg-[#E11D48]'
                    : isEscalated
                      ? 'bg-[#D97706]'
                      : 'bg-[#059669]'
                }`}
              >
                {meta.index}
              </span>
              <span className="truncate text-xs sm:text-sm font-bold tracking-tight text-white">
                {isTamperedSimulation
                  ? 'The $25 Server Bill (Poisoned with Hidden Trap!)'
                  : meta.humanTitle}
              </span>
              <span className="hidden rounded-full border border-white/15 bg-white/10 px-2 py-0.5 font-mono text-[10px] text-white/80 md:inline-block">
                {meta.networkLabel}
              </span>
            </div>

            {/* Quick-Snap 0% / Split / 100% Buttons + Live Percentage */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="flex items-center rounded-full border border-white/15 bg-white/5 p-0.5 text-[10px] sm:text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    apertureRef.current = 0;
                    setXrayAperturePct(0);
                  }}
                  className={`rounded-full px-2 sm:px-2.5 py-0.5 font-mono transition-colors ${
                    xrayAperturePct === 0
                      ? 'bg-[#E11D48] font-bold text-white'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  0%
                </button>
                <button
                  type="button"
                  onClick={() => {
                    apertureRef.current = 78;
                    setXrayAperturePct(78);
                  }}
                  className={`rounded-full px-2 sm:px-2.5 py-0.5 font-mono transition-colors ${
                    xrayAperturePct > 0 && xrayAperturePct < 100
                      ? 'bg-[#1F3CFF] font-bold text-white'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  Split
                </button>
                <button
                  type="button"
                  onClick={() => {
                    apertureRef.current = 100;
                    setXrayAperturePct(100);
                  }}
                  className={`rounded-full px-2 sm:px-2.5 py-0.5 font-mono transition-colors ${
                    xrayAperturePct === 100
                      ? 'bg-[#059669] font-bold text-white'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  100%
                </button>
              </div>

              <div className="flex items-center gap-1 rounded-full border border-[#60A5FA]/40 bg-[#1F3CFF]/30 px-2.5 sm:px-3 py-0.5 sm:py-1 text-[11px] sm:text-xs font-semibold text-white">
                <ScanLine className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-[#60A5FA]" />
                <span className="font-mono tabular-nums">{xrayAperturePct}%</span>
              </div>
            </div>
          </div>

          {/* =================================================================
              EMBEDDED 7-SCENARIO QUICK SWITCHER DOCK
             ================================================================= */}
          <div className="flex items-center justify-between gap-2 border-b border-[#DCE2EE] bg-[#F1F5F9] px-3.5 py-2">
            <button
              type="button"
              onClick={() => handleStepScenario(-1)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#DCE2EE] bg-white text-[#0B0F17] hover:border-[#1F3CFF] hover:text-[#1F3CFF]"
              title="Previous scenario"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex flex-1 items-center gap-1.5 overflow-x-auto py-0.5">
              {presets.map((item) => {
                const itemMeta = storyMap[item.id] || meta;
                const active = item.id === preset?.id;
                const safe = item.badge === 'SAFE';
                const dao = item.badge === 'DAO_ESCALATION';

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectPreset(item)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-all ${
                      active
                        ? 'border-[#1F3CFF] bg-[#1F3CFF] text-white shadow-[0_4px_12px_rgba(31,60,255,0.35)]'
                        : 'border-[#DCE2EE] bg-white text-[#4A5568] hover:border-[#0B0F17]/40 hover:text-[#0B0F17]'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        active
                          ? 'bg-white'
                          : safe
                            ? 'bg-[#059669]'
                            : dao
                              ? 'bg-[#D97706]'
                              : 'bg-[#E11D48]'
                      }`}
                    />
                    <span className="font-mono text-[10px] opacity-85">{itemMeta.index}</span>
                    <span>{itemMeta.shortLabel}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => handleStepScenario(1)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#DCE2EE] bg-white text-[#0B0F17] hover:border-[#1F3CFF] hover:text-[#1F3CFF]"
              title="Next scenario"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* =================================================================
              4-STAGE LIVE NEAR ARCHITECTURE PIPELINE TRACE
             ================================================================= */}
          <div className="grid grid-cols-2 gap-1.5 border-b border-[#DCE2EE] bg-white px-4 py-2 text-[11px] sm:grid-cols-4">
            <div className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#0B0F17] font-mono text-[9px] font-bold text-white">
                1
              </span>
              <div className="truncate">
                <span className="font-bold text-[#0B0F17]">AI Assistant</span>
                <span className="ml-1 text-[10px] text-[#4A5568]">Sends Raw Tx</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 rounded-lg border border-[#C7D2FE] bg-[#EEF2FF]/60 px-2.5 py-1">
              <Cpu className="h-3.5 w-3.5 shrink-0 text-[#1F3CFF]" />
              <div className="truncate">
                <span className="font-bold text-[#1F3CFF]">NEAR AI TEE</span>
                <span className="ml-1 text-[10px] text-[#374151]">
                  {record?.teeAudit?.riskLevel === 'CRITICAL' ? 'Mismatch!' : 'Sig Verified'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 rounded-lg border border-[#C7D2FE] bg-[#EEF2FF]/60 px-2.5 py-1">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#1F3CFF]" />
              <div className="truncate">
                <span className="font-bold text-[#0B0F17]">mpc-firewall</span>
                <span className="ml-1 text-[10px] text-[#4A5568]">Unpacks RLP</span>
              </div>
            </div>

            <div
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-bold ${
                isBlocked
                  ? 'border-[#FECDD3] bg-[#FFF1F2] text-[#E11D48]'
                  : isEscalated
                    ? 'border-[#FDE68A] bg-[#FFFBEB] text-[#D97706]'
                    : 'border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]'
              }`}
            >
              {isBlocked && <ShieldAlert className="h-3.5 w-3.5 shrink-0" />}
              {isEscalated && <Landmark className="h-3.5 w-3.5 shrink-0" />}
              {isApproved && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
              <span className="truncate">
                {isBlocked
                  ? 'v1.signer: Severed ($0)'
                  : isEscalated
                    ? 'SputnikDAO Vote'
                    : 'v1.signer: Signed ✓'}
              </span>
            </div>
          </div>

          {/* =================================================================
              INTERACTIVE SPLIT VIEWPORT: 0% TO 100% EDGE-TO-EDGE CURTAIN
             ================================================================= */}
          <div
            ref={splitViewportRef}
            onPointerDown={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest('button') || target.closest('canvas') || target.closest('[role="slider"]')) return;
              if (e.pointerType !== 'touch') {
                e.currentTarget.setPointerCapture(e.pointerId);
                draggingSliderRef.current = true;
                updateApertureFromClientX(e.clientX);
              }
            }}
            onPointerMove={(e) => {
              if (draggingSliderRef.current) {
                updateApertureFromClientX(e.clientX);
              }
            }}
            onPointerUp={(e) => {
              if (draggingSliderRef.current) {
                draggingSliderRef.current = false;
                try {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                } catch {
                  // Ignore
                }
              }
            }}
            onPointerCancel={() => {
              draggingSliderRef.current = false;
            }}
            style={{ touchAction: 'pan-y' }}
            className="relative min-h-[480px] w-full overflow-hidden bg-white select-none"
          >
            {/* ===============================================================
                BASE LAYER (REVEALED BY X-RAY): Interactive 3D Hologram + Anatomy
               =============================================================== */}
            <div className="xray-grid grid min-h-[480px] grid-cols-1 lg:grid-cols-12">
              {/* Left 5 Cols: Interactive 3D Exploded-View Hologram + Illustration */}
              <div className="relative flex flex-col justify-between border-b border-[#DCE2EE] bg-gradient-to-b from-[#EEF2FF]/80 via-[#F8FAFC] to-white p-3.5 sm:p-5 lg:col-span-5 lg:border-b-0 lg:border-r">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C7D2FE] bg-white px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-bold text-[#1F3CFF] shadow-2xs">
                    <Layers className="h-3.5 w-3.5" />
                    MpcFirewall 3D X-Ray
                  </span>
                  <span className="font-mono text-[10px] font-semibold text-[#4A5568]">
                    Touch or drag cube to orbit
                  </span>
                </div>

                {/* Centerpiece Interactive 3D Exploding Envelope Canvas */}
                <div className="my-2 overflow-hidden rounded-2xl border border-[#C7D2FE] bg-white/95 shadow-[0_10px_28px_-12px_rgba(31,60,255,0.2)]">
                  <canvas
                    ref={canvasRef}
                    style={{ touchAction: 'none' }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                      orbitingCanvasRef.current = {
                        active: true,
                        lastX: e.clientX,
                        lastY: e.clientY
                      };
                    }}
                    onPointerMove={(e) => {
                      if (!orbitingCanvasRef.current.active) return;
                      e.stopPropagation();
                      const dx = e.clientX - orbitingCanvasRef.current.lastX;
                      const dy = e.clientY - orbitingCanvasRef.current.lastY;
                      orbitingCanvasRef.current.lastX = e.clientX;
                      orbitingCanvasRef.current.lastY = e.clientY;
                      physicsRef.current.orbitYaw += dx * 0.012;
                      physicsRef.current.orbitPitch = Math.max(
                        -1.1,
                        Math.min(1.1, physicsRef.current.orbitPitch + dy * 0.012)
                      );
                    }}
                    onPointerUp={(e) => {
                      e.stopPropagation();
                      orbitingCanvasRef.current.active = false;
                      try {
                        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
                      } catch {
                        // Ignore
                      }
                    }}
                    onPointerCancel={(e) => {
                      e.stopPropagation();
                      orbitingCanvasRef.current.active = false;
                    }}
                    className="h-[185px] w-full cursor-grab active:cursor-grabbing touch-none select-none"
                    aria-label="Interactive 3D exploding transaction cube"
                  />
                </div>

                {/* Scenario Editorial Artwork + Tamper Prompt-Injection Simulator */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3 rounded-xl border border-[#DCE2EE] bg-white p-2 shadow-2xs">
                    <img
                      src={isTamperedSimulation ? '/illustrations/nesting-dolls.jpg' : meta.illustration}
                      alt={meta.humanTitle}
                      className="h-12 w-16 shrink-0 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] object-contain p-1"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-xs font-extrabold text-[#0B0F17]">
                        {isTamperedSimulation ? 'Poisoned $25 Bill (Trap Injected)' : meta.humanTitle}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] font-semibold text-[#1F3CFF]">
                        {record?.decoded.kind === 'bitcoin' ? 'BTC Raw Outputs' : 'EVM RLP + ABI Tree'}
                      </div>
                    </div>
                  </div>

                  {/* Feature 5: One-Click Prompt Injection / Tamper Button on Safe Scenario */}
                  {onTamperSimulation && (preset?.id === 'safe-base-usdc' || isTamperedSimulation) && (
                    <button
                      type="button"
                      onClick={() => onTamperSimulation(!isTamperedSimulation)}
                      disabled={loading}
                      className={`flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-extrabold transition-all ${
                        isTamperedSimulation
                          ? 'border-[#059669] bg-[#ECFDF5] text-[#059669] hover:bg-[#059669] hover:text-white'
                          : 'border-[#FDA4AF] bg-[#FFF1F2] text-[#E11D48] hover:bg-[#E11D48] hover:text-white'
                      }`}
                    >
                      {isTamperedSimulation ? (
                        <>
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>Restore Clean $25 Server Bill Bytes</span>
                        </>
                      ) : (
                        <>
                          <Bug className="h-3.5 w-3.5" />
                          <span>Simulate Prompt Injection (Poison This $25 Bill)</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Right 7 Cols: Plain-English Truth, 4-Pill X-Ray Anatomy & Verdict */}
              <div className="flex flex-col justify-between bg-white/95 p-5 lg:col-span-7">
                <div className="space-y-3">
                  {/* High-Contrast Verdict Banner */}
                  <div
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 px-4 py-2.5 shadow-2xs ${
                      isBlocked
                        ? 'border-[#FDA4AF] bg-gradient-to-r from-[#FFF1F2] to-[#FFE4E6] text-[#9F1239]'
                        : isEscalated
                          ? 'border-[#FCD34D] bg-gradient-to-r from-[#FFFBEB] to-[#FEF3C7] text-[#92400E]'
                          : 'border-[#6EE7B7] bg-gradient-to-r from-[#ECFDF5] to-[#D1FAE5] text-[#065F46]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isBlocked && <AlertOctagon className="h-5 w-5 shrink-0 text-[#E11D48]" />}
                      {isEscalated && <Landmark className="h-5 w-5 shrink-0 text-[#D97706]" />}
                      {isApproved && <CheckCircle2 className="h-5 w-5 shrink-0 text-[#059669]" />}
                      <span className="text-sm font-extrabold tracking-tight">
                        {isBlocked
                          ? 'Intercepted & Blocked Before Signing'
                          : isEscalated
                            ? 'Paused for Human Team Vote (SputnikDAO)'
                            : daoApprovedByHuman
                              ? 'Human CFO Co-Signed (2/2) — Dispatched to v1.signer'
                              : 'Verified Safe — Approved for Signing'}
                      </span>
                    </div>
                    <span
                      className={`rounded-full px-3 py-0.5 font-mono text-xs font-bold shadow-2xs ${
                        isBlocked
                          ? 'bg-[#E11D48] text-white'
                          : isEscalated
                            ? 'bg-[#D97706] text-white'
                            : 'bg-[#059669] text-white'
                      }`}
                    >
                      {isTamperedSimulation
                        ? 'Unlimited Drain Prevented'
                        : daoApprovedByHuman
                          ? '$250 Co-Signed ✓'
                          : meta.dollarBadge}
                    </span>
                  </div>

                  {/* Comparison of Assistant Claim vs Actual Code */}
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <div className="rounded-xl border border-[#C7D2FE] bg-[#EEF2FF]/65 p-3">
                      <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#1F3CFF]">
                        What AI Assistant Claimed
                      </div>
                      <p className="mt-1 text-xs font-semibold text-[#0B0F17]">
                        &ldquo;{meta.assistantClaim}&rdquo;
                      </p>
                    </div>

                    <div
                      className={`rounded-xl border p-3 ${
                        isBlocked
                          ? 'border-[#FECDD3] bg-[#FFF1F2]'
                          : isEscalated
                            ? 'border-[#FDE68A] bg-[#FFFBEB]'
                            : 'border-[#A7F3D0] bg-[#ECFDF5]'
                      }`}
                    >
                      <div
                        className={`font-mono text-[10px] font-bold uppercase tracking-wider ${
                          isBlocked
                            ? 'text-[#E11D48]'
                            : isEscalated
                              ? 'text-[#D97706]'
                              : 'text-[#059669]'
                        }`}
                      >
                        What X-Ray Found Inside
                      </div>
                      <p className="mt-1 text-xs font-bold text-[#0B0F17]">
                        {isTamperedSimulation
                          ? 'Poisoned multicall hiding an infinite MaxUint256 approval!'
                          : meta.hiddenReality}
                      </p>
                    </div>
                  </div>

                  {/* Feature 1: 4-Pill "X-Ray Anatomy" Unpacked Byte Breakdown */}
                  <div className="rounded-2xl border border-[#DCE2EE] bg-[#F8FAFC] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-mono text-[10px] font-extrabold uppercase tracking-wider text-[#0B0F17]">
                        Unpacked Transaction Anatomy (On-Chain Byte Inspection)
                      </span>
                      <span className="font-mono text-[10px] font-semibold text-[#1F3CFF]">
                        {record?.teeAudit?.mode === 'near-ai-live' && record?.teeAudit?.signatureVerified
                          ? 'NEAR AI TEE ✓'
                          : record?.teeAudit?.signatureVerified
                            ? 'Local Enclave Sig'
                            : 'Rust Wasm AST'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {anatomyFields.map((field) => (
                        <div
                          key={field.label}
                          className={`rounded-xl border px-3 py-2 ${
                            field.status === 'danger'
                              ? 'border-[#FECDD3] bg-[#FFF1F2]'
                              : field.status === 'warn'
                                ? 'border-[#FDE68A] bg-[#FFFBEB]'
                                : 'border-[#DCE2EE] bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold text-[#4A5568]">
                              {field.label}
                            </span>
                            <span
                              className={`font-mono text-[10px] font-extrabold ${
                                field.status === 'danger'
                                  ? 'text-[#E11D48]'
                                  : field.status === 'warn'
                                    ? 'text-[#D97706]'
                                    : 'text-[#059669]'
                              }`}
                            >
                              {field.status === 'danger'
                                ? 'TRAP'
                                : field.status === 'warn'
                                  ? 'VOTE'
                                  : 'OK ✓'}
                            </span>
                          </div>
                          <div className="mt-0.5 truncate font-mono text-xs font-bold text-[#0B0F17]">
                            {field.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Feature 4: Interactive Human CFO Co-Sign Card when Escalated to SputnikDAO */}
                  {(isEscalated || daoApprovedByHuman) && (
                    <div
                      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 transition-all ${
                        daoApprovedByHuman
                          ? 'border-[#6EE7B7] bg-[#ECFDF5]'
                          : 'border-[#FCD34D] bg-[#FFFBEB]'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#0B0F17]">
                          <UserCheck className="h-4 w-4 text-[#D97706]" />
                          <span>
                            {daoApprovedByHuman
                              ? 'SputnikDAO Proposal #42 Approved (2/2 Council Quorum)'
                              : `SputnikDAO / Trezu Proposal #42 (Exceeds $${autoCapUsdc} Auto-Cap)`}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#4A5568]">
                          {daoApprovedByHuman
                            ? 'Human CFO co-signed! MpcFirewall has now dispatched the 32-byte digest to v1.signer-prod.testnet.'
                            : 'AI assistant initiated 1/2 approval. Waiting for human CFO co-signature to release 250.00 USDC.'}
                        </p>
                      </div>

                      {!daoApprovedByHuman ? (
                        <button
                          type="button"
                          onClick={() => setDaoApprovedByHuman(true)}
                          className="cursor-pointer rounded-full bg-[#D97706] px-4 py-1.5 text-xs font-extrabold text-white shadow-sm hover:bg-[#059669]"
                        >
                          Co-Sign as Human CFO (Approve 2/2) &rarr;
                        </button>
                      ) : (
                        <span className="rounded-full bg-[#059669] px-3 py-1 font-mono text-[11px] font-bold text-white">
                          Dispatched to v1.signer ✓
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E8F0] pt-3">
                  <div className="text-xs text-[#4A5568]">
                    Protected Outcome:{' '}
                    <strong className="font-bold text-[#0B0F17]">
                      {isTamperedSimulation
                        ? '$0.00 lost — poisoned $25 bill blocked before reaching v1.signer'
                        : daoApprovedByHuman
                          ? '$250.00 USDC co-signed by human CFO & signed by v1.signer'
                          : meta.withResult}
                    </strong>
                  </div>

                  <button
                    type="button"
                    onClick={onInspect}
                    disabled={loading}
                    className="group inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#1F3CFF] px-4 py-2 text-xs font-bold text-white shadow-[0_8px_20px_-6px_rgba(31,60,255,0.5)] transition-all hover:bg-[#0B0F17] disabled:opacity-50"
                  >
                    <span>{loading ? 'Scanning Envelope…' : 'Re-Scan Live on NEAR'}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* ===============================================================
                OVERLAY LAYER (CLIPPED BY X-RAY BEAM): Sealed Black Envelope
               =============================================================== */}
            <div
              className="obsidian-grid pointer-events-none absolute inset-0 z-10 bg-[#0B0F17] text-white"
              style={{
                clipPath: `inset(0 ${xrayAperturePct}% 0 0)`
              }}
            >
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'radial-gradient(circle at 25% 35%, rgba(244, 63, 94, 0.24) 0%, rgba(31, 60, 255, 0.1) 45%, transparent 75%)'
                }}
              />

              <div className="relative grid h-full min-h-[480px] grid-cols-1 lg:grid-cols-12">
                {/* Left 5 Cols: Blindfolded Notary & Sealed Envelope Illustration */}
                <div className="flex flex-col justify-between border-b border-white/10 bg-white/[0.02] p-5 lg:col-span-5 lg:border-b-0 lg:border-r">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F43F5E]/40 bg-[#F43F5E]/15 px-3 py-1 text-xs font-bold text-[#FDA4AF]">
                      <EyeOff className="h-3.5 w-3.5 text-[#F43F5E]" />
                      Without MpcFirewall: Blind View
                    </span>
                  </div>

                  <div className="my-3 flex items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white p-2.5 shadow-lg">
                    <img
                      src="/illustrations/blind-envelope.jpg"
                      alt="Sealed black envelope stamped blindfolded"
                      className="h-48 w-full object-contain"
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs">
                    <span className="text-white/60">v1.signer Visibility</span>
                    <span className="font-mono font-bold text-[#FB7185]">32-Byte Hash Only</span>
                  </div>
                </div>

                {/* Right 7 Cols: Scrambled Fingerprint & Blind-Sign Consequence */}
                <div className="flex flex-col justify-between p-6 lg:col-span-7">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#F43F5E]/40 bg-[#F43F5E]/15 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Lock className="h-5 w-5 text-[#FB7185]" />
                        <span className="text-sm font-bold text-white">
                          Sealed 32-Byte Envelope — Contents Invisible to v1.signer
                        </span>
                      </div>
                      <span className="rounded-full bg-[#E11D48] px-3 py-0.5 font-mono text-xs font-bold text-white">
                        BLIND SIGNING
                      </span>
                    </div>

                    <div className="rounded-2xl border border-white/15 bg-black/40 p-4">
                      <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-white/50">
                        All NEAR Chain Signatures (v1.signer) Sees Today:
                      </div>
                      <div className="mt-1.5 font-mono text-xs font-semibold leading-relaxed text-[#FBBF24] break-all">
                        {digestHex}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
                        <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-white/50">
                          Assistant Claims
                        </div>
                        <p className="mt-1 text-sm font-medium text-white/90">
                          &ldquo;{meta.assistantClaim}&rdquo;
                        </p>
                      </div>

                      <div className="rounded-2xl border border-[#F43F5E]/30 bg-[#F43F5E]/10 p-3.5">
                        <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#FDA4AF]">
                          What v1.signer Can See Inside
                        </div>
                        <p className="mt-1 font-mono text-sm font-bold text-[#FB7185]">
                          ??? [ENCRYPTED / OPAQUE BYTES]
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#F43F5E]/40 bg-[#F43F5E]/20 px-4 py-3 text-xs">
                    <span className="font-medium text-white/85">
                      Unprotected Result on NEAR Today:
                    </span>
                    <strong className="font-mono text-xs font-extrabold text-[#FDA4AF]">
                      {meta.withoutResult}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* ===============================================================
                DRAGGABLE X-RAY LASER HANDLE (Touch-friendly on mobile & desktop)
               =============================================================== */}
            <div
              role="slider"
              tabIndex={0}
              aria-label="X-Ray comparison slider"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={xrayAperturePct}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                draggingSliderRef.current = true;
                updateApertureFromClientX(e.clientX);
              }}
              onPointerMove={(e) => {
                if (draggingSliderRef.current) {
                  e.preventDefault();
                  e.stopPropagation();
                  updateApertureFromClientX(e.clientX);
                }
              }}
              onPointerUp={(e) => {
                draggingSliderRef.current = false;
                try {
                  (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
                } catch {
                  // Ignore
                }
              }}
              onPointerCancel={() => {
                draggingSliderRef.current = false;
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') {
                  const next = Math.min(100, xrayAperturePct + 10);
                  apertureRef.current = next;
                  setXrayAperturePct(next);
                }
                if (e.key === 'ArrowRight') {
                  const next = Math.max(0, xrayAperturePct - 10);
                  apertureRef.current = next;
                  setXrayAperturePct(next);
                }
              }}
              style={{
                left: `clamp(20px, ${handleLeftPct}%, calc(100% - 20px))`,
                transform: 'translateX(-50%)',
                touchAction: 'none'
              }}
              className="absolute inset-y-0 z-20 flex w-14 cursor-ew-resize items-center justify-center focus:outline-none touch-none select-none"
            >
              <div
                className={`h-full w-[3px] transition-colors ${
                  isBlocked
                    ? 'bg-[#E11D48] shadow-[0_0_20px_3px_rgba(225,29,72,0.85)]'
                    : isEscalated
                      ? 'bg-[#D97706] shadow-[0_0_20px_3px_rgba(217,119,6,0.85)]'
                      : 'bg-[#1F3CFF] shadow-[0_0_20px_3px_rgba(31,60,255,0.85)]'
                }`}
              />
              <div
                className={`pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border-2 border-white text-white shadow-[0_10px_28px_rgba(11,15,23,0.55)] transition-transform hover:scale-110 active:scale-95 touch-none ${
                  isBlocked
                    ? 'bg-[#E11D48]'
                    : isEscalated
                      ? 'bg-[#D97706]'
                      : 'bg-[#1F3CFF]'
                }`}
              >
                <MoveHorizontal className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* =================================================================
              BOTTOM APERTURE SCRUBBER + LIVE POLICY SANDBOX BAR (FEATURE 2)
             ================================================================= */}
          <div className="divide-y divide-[#DCE2EE] border-t border-[#DCE2EE] bg-[#F8FAFC]">
            {/* Row 1: X-Ray Curtain Scrubber */}
            <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4 px-3 sm:px-5 py-2.5 sm:py-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  apertureRef.current = 0;
                  setXrayAperturePct(0);
                }}
                className="font-mono text-[10px] sm:text-[11px] font-bold text-[#E11D48] hover:underline shrink-0"
              >
                &larr; 0% Blind
              </button>

              <div className="flex flex-1 items-center gap-2 max-w-xs sm:max-w-sm">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={handleLeftPct}
                  onChange={(e) => {
                    const next = 100 - Number(e.target.value);
                    apertureRef.current = next;
                    setXrayAperturePct(next);
                  }}
                  aria-label="Pull X-Ray curtain from 0% to 100%"
                  className="h-2.5 sm:h-2 w-full cursor-ew-resize appearance-none rounded-lg bg-gradient-to-r from-[#1F3CFF] via-[#059669] to-[#0B0F17] accent-[#1F3CFF] touch-none"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  apertureRef.current = 100;
                  setXrayAperturePct(100);
                }}
                className="font-mono text-[10px] sm:text-[11px] font-bold text-[#1F3CFF] hover:underline shrink-0"
              >
                100% X-Ray &rarr;
              </button>
            </div>

            {/* Row 2: Feature 2 — Live Policy Rule Controls to Prove Engine Is Not Hardcoded */}
            {policy && onTogglePolicy && (
              <div className="flex flex-wrap items-center justify-between gap-2 bg-[#EEF2FF]/60 px-5 py-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-[#1F3CFF] px-2 py-0.5 font-mono text-[10px] font-bold text-white">
                    LIVE POLICY SANDBOX
                  </span>
                  <span className="text-[11px] font-medium text-[#374151]">
                    Flip any rule below to watch this transaction re-evaluate live:
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Toggle Auto-Approve Cap between $100 and $300 (flips Scenario 06 between Amber DAO Vote & Green Auto-Sign!) */}
                  <button
                    type="button"
                    disabled={savingPolicy}
                    onClick={() =>
                      onTogglePolicy({
                        autoApproveTokenUnits:
                          autoCapUsdc >= 300 ? '100000000' : '300000000'
                      })
                    }
                    className={`cursor-pointer rounded-full border px-3 py-1 font-mono text-[11px] font-bold transition-all ${
                      autoCapUsdc >= 300
                        ? 'border-[#059669] bg-[#059669] text-white'
                        : 'border-[#DCE2EE] bg-white text-[#0B0F17] hover:border-[#1F3CFF]'
                    }`}
                  >
                    Auto-Sign Cap: ${autoCapUsdc} USDC {autoCapUsdc >= 300 ? '(Raised → $250 Auto-Signs!)' : '(Click for $300)'}
                  </button>

                  {/* Toggle Blank-Check Guard */}
                  <button
                    type="button"
                    disabled={savingPolicy}
                    onClick={() =>
                      onTogglePolicy({
                        allowUnlimitedApprovals: !policy.allowUnlimitedApprovals
                      })
                    }
                    className={`cursor-pointer rounded-full border px-3 py-1 font-mono text-[11px] font-bold transition-all ${
                      !policy.allowUnlimitedApprovals
                        ? 'border-[#C7D2FE] bg-white text-[#1F3CFF] hover:border-[#1F3CFF]'
                        : 'border-[#E11D48] bg-[#E11D48] text-white'
                    }`}
                  >
                    Blank-Check Guard: {!policy.allowUnlimitedApprovals ? 'ON ✓' : 'OFF (UNSAFE!)'}
                  </button>

                  {onResetPolicy && (autoCapUsdc !== 100 || policy.allowUnlimitedApprovals) && (
                    <button
                      type="button"
                      onClick={onResetPolicy}
                      className="cursor-pointer font-mono text-[11px] font-bold text-[#1F3CFF] underline"
                    >
                      Restore Defaults
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
