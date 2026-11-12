'use client';

import { useEffect, useRef, useState } from 'react';
import type { FirewallEvaluationRecord } from '@mpc-firewall/core';
import type { ScenarioPresetView } from '@/components/TxWorkbench';
import {
  AlertOctagon,
  ArrowUpRight,
  CheckCircle2,
  Landmark,
  Layers,
  Lock,
  MoveHorizontal,
  ScanLine,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';

export interface ScenarioStoryMeta {
  index: string;
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
  preset: ScenarioPresetView | null;
  meta: ScenarioStoryMeta;
  record: FirewallEvaluationRecord | null;
  loading: boolean;
  onInspect: () => void;
}

export function InteractiveXRayStage({
  preset,
  meta,
  record,
  loading,
  onInspect
}: InteractiveXRayStageProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const glareRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // X-Ray curtain position (0 = fully sealed black envelope, 100 = fully X-rayed interior)
  // Default to 72% so the visitor immediately sees the X-ray peel effect at rest
  const [xraySplit, setXraySplit] = useState<number>(72);
  const draggingRef = useRef<boolean>(false);

  // Pointer physics state stored in refs (zero React re-renders on mousemove)
  const pointerRef = useRef({ targetX: 0, targetY: 0, currentX: 0, currentY: 0 });

  const outcome = record?.decision.outcome;
  const isBlocked = outcome === 'BLOCKED' || (!outcome && preset?.badge === 'ATTACK');
  const isEscalated = outcome === 'ESCALATE_TO_DAO' || (!outcome && preset?.badge === 'DAO_ESCALATION');
  const isApproved = outcome === 'APPROVED_FOR_MPC_SIGN' || (!outcome && preset?.badge === 'SAFE');

  // Sweep X-ray beam automatically when a new inspection completes
  useEffect(() => {
    if (!record) return;
    let frame = 0;
    const start = performance.now();
    const duration = 680;
    const from = 18;
    const to = 78;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // cubic-bezier ease-out
      const eased = 1 - Math.pow(1 - t, 3);
      setXraySplit(Math.round(from + (to - from) * eased));
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [record?.id, preset?.id]);

  // 60fps 3D tilt + WebGL-style 3D wireframe prism canvas (idle motion + pointer response)
  useEffect(() => {
    let rafId = 0;
    let angle = 0;

    const render = () => {
      angle += 0.014;
      const p = pointerRef.current;
      p.currentX += (p.targetX - p.currentX) * 0.08;
      p.currentY += (p.targetY - p.currentY) * 0.08;

      if (cardRef.current) {
        const rotY = p.currentX * 5.5;
        const rotX = -p.currentY * 4.5;
        cardRef.current.style.transform = `perspective(1400px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg)`;
      }

      if (glareRef.current) {
        const gx = 50 + p.currentX * 35;
        const gy = 50 + p.currentY * 35;
        glareRef.current.style.background = `radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 65%)`;
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);

          const cx = w / 2 + p.currentX * 10;
          const cy = h / 2 + p.currentY * 8;

          // Color by security verdict
          const primaryStroke = isBlocked
            ? '#E11D48'
            : isEscalated
              ? '#D97706'
              : '#1F3CFF';
          const coreStroke = isBlocked
            ? '#F43F5E'
            : isEscalated
              ? '#F59E0B'
              : '#059669';

          // Draw subtle optical scanner rings
          ctx.save();
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.08)';
          ctx.lineWidth = 1;
          for (const r of [36, 58, 78]) {
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.stroke();
          }

          // 3D projection helper for rotating outer envelope cube & inner core
          const rotY = angle + p.currentX * 0.7;
          const rotX = 0.42 + p.currentY * 0.45;
          const project = (x: number, y: number, z: number, scale: number) => {
            // Rotate Y
            const x1 = x * Math.cos(rotY) - z * Math.sin(rotY);
            const z1 = z * Math.cos(rotY) + x * Math.sin(rotY);
            // Rotate X
            const y2 = y * Math.cos(rotX) - z1 * Math.sin(rotX);
            const z2 = z1 * Math.cos(rotX) + y * Math.sin(rotX);
            const fov = 240 / (240 + z2 * 18);
            return [cx + x1 * scale * fov, cy + y2 * scale * fov] as const;
          };

          const vertices = [
            [-1, -1, -1],
            [1, -1, -1],
            [1, 1, -1],
            [-1, 1, -1],
            [-1, -1, 1],
            [1, -1, 1],
            [1, 1, 1],
            [-1, 1, 1]
          ];
          const edges = [
            [0, 1], [1, 2], [2, 3], [3, 0],
            [4, 5], [5, 6], [6, 7], [7, 4],
            [0, 4], [1, 5], [2, 6], [3, 7]
          ];

          // Outer wireframe cube (the transaction envelope)
          ctx.strokeStyle = primaryStroke;
          ctx.lineWidth = 1.6;
          const outerPts = vertices.map(([x, y, z]) => project(x, y, z, 38));
          for (const [a, b] of edges) {
            ctx.beginPath();
            ctx.moveTo(outerPts[a][0], outerPts[a][1]);
            ctx.lineTo(outerPts[b][0], outerPts[b][1]);
            ctx.stroke();
          }

          // Inner octahedron / core (the payload inside the envelope)
          const octa = [
            [0, -1.15, 0],
            [1.15, 0, 0],
            [0, 0, 1.15],
            [-1.15, 0, 0],
            [0, 0, -1.15],
            [0, 1.15, 0]
          ];
          const octaEdges = [
            [0, 1], [0, 2], [0, 3], [0, 4],
            [5, 1], [5, 2], [5, 3], [5, 4],
            [1, 2], [2, 3], [3, 4], [4, 1]
          ];
          const pulse = 18 + Math.sin(angle * 2.4) * 2.5;
          const innerPts = octa.map(([x, y, z]) => project(x, y, z, pulse));
          ctx.strokeStyle = coreStroke;
          ctx.lineWidth = 1.8;
          for (const [a, b] of octaEdges) {
            ctx.beginPath();
            ctx.moveTo(innerPts[a][0], innerPts[a][1]);
            ctx.lineTo(innerPts[b][0], innerPts[b][1]);
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [isBlocked, isEscalated]);

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = stageRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    pointerRef.current.targetX = Math.max(-1, Math.min(1, nx));
    pointerRef.current.targetY = Math.max(-1, Math.min(1, ny));

    if (draggingRef.current) {
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setXraySplit(Math.max(8, Math.min(92, Math.round(pct))));
    }
  }

  function handlePointerLeave() {
    pointerRef.current.targetX = 0;
    pointerRef.current.targetY = 0;
    draggingRef.current = false;
  }

  const digestHex =
    record?.decoded.sighashPayloadHex ||
    '0x7a2d40fdb3a173f09524c6f82439f4edba352f082853f4db0d6c01dd7e63cf55';

  return (
    <div
      ref={stageRef}
      onPointerMove={handlePointerMove}
      onPointerUp={() => {
        draggingRef.current = false;
      }}
      onPointerLeave={handlePointerLeave}
      className="relative select-none"
    >
      <div
        ref={cardRef}
        className="relative overflow-hidden rounded-[24px] border border-[#DCE0E8] bg-white shadow-[0_32px_64px_-20px_rgba(11,15,23,0.14)] transition-shadow duration-300"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Subtle cursor-tracked specular glare */}
        <div
          ref={glareRef}
          className="pointer-events-none absolute inset-0 z-30 opacity-60 mix-blend-overlay"
        />

        {/* Top Instrument Chrome Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6E9F0] bg-[#FAFBFD] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0B0F17] font-mono text-[11px] font-semibold text-white">
              {meta.index}
            </span>
            <span className="text-sm font-semibold tracking-tight text-[#0B0F17]">
              {meta.humanTitle}
            </span>
            <span className="hidden rounded-full border border-[#DCE0E8] bg-white px-2.5 py-0.5 font-mono text-[11px] text-[#525B6C] sm:inline-block">
              {meta.networkLabel}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-[#525B6C] md:inline">
              Drag the X-Ray lens to compare
            </span>
            <div className="flex items-center gap-1.5 rounded-full border border-[#DCE0E8] bg-white px-3 py-1 text-xs font-medium text-[#0B0F17]">
              <ScanLine className="h-3.5 w-3.5 text-[#1F3CFF]" />
              <span className="tabular-nums">X-Ray Aperture: {xraySplit}%</span>
            </div>
          </div>
        </div>

        {/* Interactive Split Stage: Sealed Black Envelope vs. X-Ray Interior */}
        <div className="relative min-h-[430px] w-full overflow-hidden bg-white">
          {/* BASE LAYER (RIGHT / REVEALED BY X-RAY): What MpcFirewall Uncovers Inside */}
          <div className="grid min-h-[430px] grid-cols-1 lg:grid-cols-12">
            {/* Illustration & 3D Wireframe Prism Column */}
            <div className="relative flex flex-col justify-between border-b border-[#E6E9F0] bg-[#F7F9FC] p-6 lg:col-span-5 lg:border-b-0 lg:border-r">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1F3CFF]/10 px-3 py-1 text-xs font-semibold text-[#1F3CFF]">
                  <Layers className="h-3.5 w-3.5" />
                  MpcFirewall X-Ray View
                </span>
                <canvas
                  ref={canvasRef}
                  width={120}
                  height={120}
                  className="h-16 w-16 shrink-0"
                  aria-label="3D payload wireframe scanner"
                />
              </div>

              <div className="my-2 flex items-center justify-center overflow-hidden rounded-2xl border border-[#E2E6EE] bg-white p-2 shadow-sm">
                <img
                  src={meta.illustration}
                  alt={meta.humanTitle}
                  className="h-48 w-full object-contain"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-[#525B6C]">
                <span>Unpacked on-chain in Rust Wasm</span>
                <span className="font-mono font-semibold text-[#0B0F17]">
                  {record?.decoded.kind === 'bitcoin' ? 'BTC Raw Outputs' : 'EVM RLP + ABI'}
                </span>
              </div>
            </div>

            {/* Decoded Plain-English Truth & Verdict Column */}
            <div className="flex flex-col justify-between p-6 lg:col-span-7">
              <div className="space-y-4">
                {/* Big Clear Verdict Banner */}
                <div
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3 ${
                    isBlocked
                      ? 'border-[#E11D48]/25 bg-[#FFF1F2] text-[#9F1239]'
                      : isEscalated
                        ? 'border-[#D97706]/25 bg-[#FFFBEB] text-[#92400E]'
                        : 'border-[#059669]/25 bg-[#ECFDF5] text-[#065F46]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {isBlocked && <AlertOctagon className="h-5 w-5 shrink-0 text-[#E11D48]" />}
                    {isEscalated && <Landmark className="h-5 w-5 shrink-0 text-[#D97706]" />}
                    {isApproved && <CheckCircle2 className="h-5 w-5 shrink-0 text-[#059669]" />}
                    <span className="text-sm font-bold tracking-tight">
                      {isBlocked
                        ? 'Intercepted & Blocked Before Signing'
                        : isEscalated
                          ? 'Paused for Human Team Vote (SputnikDAO)'
                          : 'Verified Safe — Approved for Signing'}
                    </span>
                  </div>
                  <span
                    className={`rounded-full px-3 py-0.5 font-mono text-xs font-bold ${
                      isBlocked
                        ? 'bg-[#E11D48] text-white'
                        : isEscalated
                          ? 'bg-[#D97706] text-white'
                          : 'bg-[#059669] text-white'
                    }`}
                  >
                    {meta.dollarBadge}
                  </span>
                </div>

                {/* Comparison of Assistant Claim vs Actual Code */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[#E6E9F0] bg-[#FAFBFD] p-3.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[#525B6C]">
                      What Your AI Assistant Claimed
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-[#0B0F17]">
                      &ldquo;{meta.assistantClaim}&rdquo;
                    </p>
                  </div>

                  <div
                    className={`rounded-2xl border p-3.5 ${
                      isBlocked
                        ? 'border-[#FECDD3] bg-[#FFF1F2]/60'
                        : isEscalated
                          ? 'border-[#FDE68A] bg-[#FFFBEB]/60'
                          : 'border-[#A7F3D0] bg-[#ECFDF5]/60'
                    }`}
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[#525B6C]">
                      What X-Ray Found Inside the Envelope
                    </div>
                    <p className="mt-1.5 text-sm font-semibold text-[#0B0F17]">
                      {meta.hiddenReality}
                    </p>
                  </div>
                </div>

                {/* Decoded Call Layers (Plain English + Technical Proof Pill) */}
                <div className="rounded-2xl border border-[#E6E9F0] bg-[#FAFBFD] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#0B0F17]">
                      Why MpcFirewall Made This Decision
                    </span>
                    <span className="font-mono text-[11px] text-[#525B6C]">
                      {record?.teeAudit?.signatureVerified
                        ? 'NEAR AI TEE Audit: Verified'
                        : 'Deterministic Rust Guard'}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#525B6C]">
                    {record?.decision.reasons?.[0] || meta.withResult}
                  </p>
                  {record && record.decision.codes.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {record.decision.codes.map((c) => (
                        <span
                          key={c}
                          className="rounded-md border border-[#DCE0E8] bg-white px-2 py-0.5 font-mono text-[10px] font-semibold text-[#0B0F17]"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#E6E9F0] pt-3.5">
                <div className="text-xs text-[#525B6C]">
                  Wallet Impact:{' '}
                  <strong className="font-semibold text-[#0B0F17]">{meta.withResult}</strong>
                </div>

                <button
                  type="button"
                  onClick={onInspect}
                  disabled={loading}
                  className="group inline-flex items-center gap-2 rounded-full bg-[#0B0F17] px-5 py-2 text-xs font-semibold text-white transition-all hover:bg-[#1F3CFF] disabled:opacity-50"
                >
                  <span>{loading ? 'Scanning Envelope…' : 'Re-Scan Live on NEAR'}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </button>
              </div>
            </div>
          </div>

          {/* OVERLAY LAYER (LEFT OF X-RAY BEAM): The Sealed Black Envelope (What v1.signer Sees Alone) */}
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-10 overflow-hidden bg-[#0B0F17] text-white"
            style={{ width: `${100 - xraySplit}%` }}
          >
            <div className="flex h-full min-w-[680px] flex-col justify-between p-7">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80">
                  <Lock className="h-3.5 w-3.5 text-[#F43F5E]" />
                  Without MpcFirewall: Sealed Black Envelope
                </span>
                <span className="font-mono text-xs text-white/50">
                  v1.signer Blind-Sign View
                </span>
              </div>

              <div className="my-auto max-w-md space-y-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-white/50">
                  All NEAR Chain Signatures Sees Today:
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/5 p-4 font-mono text-xs leading-relaxed text-[#FBBF24] break-all">
                  {digestHex}
                </div>
                <p className="text-sm leading-relaxed text-white/75">
                  A scrambled 32-byte fingerprint. Existing NEAR Function Call Keys only check that
                  your AI assistant holds a valid keycard — they <strong className="text-white">cannot open this envelope</strong> to see the{' '}
                  {isBlocked ? 'wallet-draining trap' : 'transfer'} inside.
                </p>
              </div>

              <div className="flex items-center justify-between border-t border-white/10 pt-4 text-xs">
                <span className="text-white/60">Unprotected Result:</span>
                <span className="font-semibold text-[#FB7185]">{meta.withoutResult}</span>
              </div>
            </div>
          </div>

          {/* DRAGGABLE X-RAY BEAM HANDLE */}
          <div
            role="slider"
            tabIndex={0}
            aria-label="X-Ray comparison slider"
            aria-valuemin={8}
            aria-valuemax={92}
            aria-valuenow={100 - xraySplit}
            onPointerDown={(e) => {
              e.stopPropagation();
              draggingRef.current = true;
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') setXraySplit((v) => Math.min(92, v + 6));
              if (e.key === 'ArrowRight') setXraySplit((v) => Math.max(8, v - 6));
            }}
            style={{ left: `${100 - xraySplit}%` }}
            className="absolute inset-y-0 z-20 -ml-5 flex w-10 cursor-ew-resize items-center justify-center focus:outline-none"
          >
            {/* Glowing vertical laser line */}
            <div className="h-full w-[2px] bg-[#1F3CFF] shadow-[0_0_18px_2px_rgba(31,60,255,0.75)]" />
            {/* Physical pill handle */}
            <div className="absolute flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-[#1F3CFF] text-white shadow-[0_8px_24px_rgba(31,60,255,0.45)] transition-transform hover:scale-110 active:scale-95">
              <MoveHorizontal className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

