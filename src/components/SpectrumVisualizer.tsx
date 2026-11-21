import React, {useEffect, useRef} from 'react';
import {PlaybackStatus} from '../types/radio';

interface SpectrumVisualizerProps {
  status: PlaybackStatus;
  disabled?: boolean;
  bitrate: number;
}

const BAR_COUNT = 20;

export const SpectrumVisualizer: React.FC<SpectrumVisualizerProps> = ({
  status,
  disabled = false,
  bitrate,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const heights = new Float32Array(BAR_COUNT).fill(0.08);
    const peaks = new Float32Array(BAR_COUNT).fill(0.08);
    const peakHold = new Uint8Array(BAR_COUNT).fill(0);

    let rafId: number | null = null;
    let lastDraw = 0;
    let phase = 0;

    const drawFrame = (now: number) => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const isPlaying = status === 'playing';
      const isConnecting = status === 'connecting';

      const barGap = 2;
      const barWidth = Math.floor((width - barGap * (BAR_COUNT - 1)) / BAR_COUNT);
      const startX = Math.floor((width - (barWidth * BAR_COUNT + barGap * (BAR_COUNT - 1))) / 2);

      // Throttle to ~20fps for ultra-low battery & CPU usage
      if (now - lastDraw >= 48) {
        lastDraw = now;
        phase += isPlaying ? 0.24 : 0.12;
        const energyScale = Math.min(1, 0.55 + (bitrate || 64) / 220);

        for (let i = 0; i < BAR_COUNT; i++) {
          let target = 0.06;
          if (isPlaying && !disabled && !prefersReducedMotion) {
            const wave1 = Math.sin(phase + i * 0.48) * 0.35 + 0.4;
            const wave2 = Math.cos(phase * 1.65 - i * 0.31) * 0.25 + 0.25;
            const rollOff = 1 - (i / BAR_COUNT) * 0.38;
            target = Math.min(0.96, Math.max(0.12, (wave1 * 0.65 + wave2 * 0.45) * rollOff * energyScale));
          } else if (isPlaying && (disabled || prefersReducedMotion)) {
            target = 0.22 + ((i % 4) * 0.1);
          } else if (isConnecting && !disabled && !prefersReducedMotion) {
            const pulseIdx = Math.floor(phase * 2) % BAR_COUNT;
            target = i === pulseIdx ? 0.55 : 0.1;
          }

          heights[i] = heights[i] * 0.58 + target * 0.42;

          if (heights[i] >= peaks[i]) {
            peaks[i] = heights[i];
            peakHold[i] = 10;
          } else if (peakHold[i] > 0) {
            peakHold[i]--;
          } else {
            peaks[i] = Math.max(0.06, peaks[i] - 0.045);
          }
        }
      }

      for (let i = 0; i < BAR_COUNT; i++) {
        const x = startX + i * (barWidth + barGap);
        const h = Math.max(2, Math.round(heights[i] * (height - 4)));
        const y = height - h;

        // Classic segmented Winamp spectrum look (celeste base -> emerald -> amber peak)
        const segHeight = 3;
        const segGap = 1;
        for (let sy = height - segHeight; sy >= y; sy -= segHeight + segGap) {
          const ratio = 1 - sy / height;
          if (ratio > 0.78) {
            ctx.fillStyle = '#f59e0b';
          } else if (ratio > 0.45) {
            ctx.fillStyle = '#38bdf8';
          } else {
            ctx.fillStyle = '#0ea5e9';
          }
          ctx.fillRect(x, sy, barWidth, segHeight);
        }

        // Peak cap
        if (isPlaying || isConnecting) {
          const peakY = Math.max(1, height - Math.round(peaks[i] * (height - 4)) - 2);
          ctx.fillStyle = '#e2e8f0';
          ctx.fillRect(x, peakY, barWidth, 2);
        }
      }

      if ((isPlaying || isConnecting) && !disabled && !prefersReducedMotion && !document.hidden) {
        rafId = window.requestAnimationFrame(drawFrame);
      }
    };

    const handleVisibility = () => {
      if (document.hidden && rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      } else if (!document.hidden && (status === 'playing' || status === 'connecting') && !disabled && !prefersReducedMotion) {
        rafId = window.requestAnimationFrame(drawFrame);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    rafId = window.requestAnimationFrame(drawFrame);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, [bitrate, disabled, status]);

  return (
    <canvas
      ref={canvasRef}
      width={180}
      height={44}
      aria-hidden="true"
      className="w-[140px] sm:w-[172px] h-[40px] sm:h-[44px] rounded bg-black/50 border border-white/10 shrink-0"
    />
  );
};
