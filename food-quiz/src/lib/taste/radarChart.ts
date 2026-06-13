/**
 * 8 维雷达图绘制纯函数。
 * - 供 React 组件(RadarChart.tsx)调用
 * - 供分享卡(shareImage.ts)调用
 * - 输入:Canvas 2D context、归一化后的 8 维数据(按 letters 顺序)、画布尺寸
 * - 输出:在传入 ctx 上直接绘制
 */
import { DIMS, DIM_CHINESE } from './keys';
import type { Grade } from './keys';
import type { RenderedInterval } from './result';

const GRADE_COLORS: Record<Grade, [string, string]> = {
  A: ['#e74c3c', '#c0392b'],
  B: ['#f39c12', '#e67e22'],
  C: ['#5dade2', '#3498db'],
  D: ['#48c9b0', '#1abc9c'],
  E: ['#a89689', '#6b5b50'],
};

const POLYGON_FILL_INNER = 'rgba(231, 76, 60, 0.18)';
const POLYGON_FILL_OUTER = 'rgba(231, 76, 60, 0.40)';
const GRID_COLOR = 'rgba(45, 27, 20, 0.12)';
const AXIS_COLOR = 'rgba(45, 27, 20, 0.18)';
const LABEL_COLOR = '#6b5b50';
const RING_LABEL_COLOR = 'rgba(168, 150, 137, 0.7)';

export interface RadarDrawOptions {
  /** 中文字体栈,默认 'sans-serif' */
  fontFamily?: string;
}

/**
 * 在 ctx 上绘制 8 轴雷达图。坐标系相对 (0, 0),中心在 (size/2, size/2)。
 * 如果要画在画布的某个位置,先 ctx.save() / ctx.translate(x, y) / ctx.restore()。
 */
export function drawRadarChart(
  ctx: CanvasRenderingContext2D,
  intervals: RenderedInterval[],
  size: number,
  opts: RadarDrawOptions = {},
): void {
  const fontFamily = opts.fontFamily ?? 'sans-serif';
  const N = 8;
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.38;
  const labelOffset = size * 0.10;

  // 清空
  ctx.clearRect(0, 0, size, size);

  // 1. 5 圈同心八边形网格
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  for (let k = 1; k <= 5; k++) {
    const r = (R * k) / 5;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  // 2. 8 条轴线
  ctx.strokeStyle = AXIS_COLOR;
  for (let i = 0; i < N; i++) {
    const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + R * Math.cos(angle), cy + R * Math.sin(angle));
    ctx.stroke();
  }

  // 3. 轴标签(中文,与 DIMS 顺序严格一致)
  ctx.fillStyle = LABEL_COLOR;
  ctx.font = `500 ${Math.max(11, Math.round(size * 0.044))}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < N; i++) {
    const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
    const lx = cx + (R + labelOffset) * Math.cos(angle);
    const ly = cy + (R + labelOffset) * Math.sin(angle);
    ctx.fillText(DIM_CHINESE[i]!, lx, ly);
  }

  // 4. 数据多边形
  // 按 letter → DIMS 索引映射,固定轴顺序
  const data: number[] = new Array(N).fill(0);
  for (const iv of intervals) {
    const idx = DIMS.indexOf(iv.letter);
    if (idx >= 0) data[idx] = Math.max(0, Math.min(1, iv.value / 100));
  }
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
    const r = R * data[i]!;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  grad.addColorStop(0, POLYGON_FILL_INNER);
  grad.addColorStop(1, POLYGON_FILL_OUTER);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#e74c3c';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 5. 数据点 + grade 染色
  for (let i = 0; i < N; i++) {
    const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
    const r = R * data[i]!;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    const letter = DIMS[i]!;
    const iv = intervals.find((x) => x.letter === letter);
    if (!iv) continue;
    const [c1, c2] = GRADE_COLORS[iv.grade];
    const dot = ctx.createRadialGradient(x, y, 0, x, y, 6);
    dot.addColorStop(0, c1);
    dot.addColorStop(1, c2);
    ctx.fillStyle = dot;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 6. 等级环刻度标签(20/40/60/80/100,在顶部轴右侧)
  ctx.fillStyle = RING_LABEL_COLOR;
  ctx.font = `400 ${Math.max(9, Math.round(size * 0.028))}px ${fontFamily}`;
  for (let k = 1; k <= 5; k++) {
    const r = (R * k) / 5;
    ctx.fillText(`${k * 20}`, cx + 3, cy - r + 1);
  }
}
