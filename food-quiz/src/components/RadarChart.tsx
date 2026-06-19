import { useRef, useEffect } from 'react';
import type { RenderedInterval } from '../lib/taste/result';
import { drawRadarChart } from '../lib/taste/radarChart';

interface Props {
  intervals: RenderedInterval[];
  size?: number;
  fontFamily?: string;
}

/**
 * P6.3 8 维雷达图组件。
 * - Canvas 2D,HiDPI 自适应
 * - intervals 变化时重绘
 */
export function RadarChart({ intervals, size = 320, fontFamily }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    drawRadarChart(ctx, intervals, size, { fontFamily, padding: 44 });
  }, [intervals, size, fontFamily]);

  return <canvas ref={ref} className="radar-chart" data-testid="radar-chart" />;
}
