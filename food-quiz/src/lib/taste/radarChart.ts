/**
 * 8 维雷达图绘制纯函数。
 * - 供 React 组件(RadarChart.tsx)调用
 * - 供分享卡(shareImage.ts)调用
 * - 输入:Canvas 2D context、归一化后的 8 维数据(按 letters 顺序)、画布尺寸
 * - 输出:在传入 ctx 上直接绘制
 */
import { DIMS, DIM_CHINESE, type Grade } from './keys';
import type { RenderedInterval } from './result';

const POLYGON_FILL_INNER = 'rgba(231, 76, 60, 0.18)';
const POLYGON_FILL_OUTER = 'rgba(231, 76, 60, 0.40)';
const GRID_COLOR = 'rgba(45, 27, 20, 0.12)';
const AXIS_COLOR = 'rgba(45, 27, 20, 0.18)';
const LABEL_COLOR = '#6b5b50';
const RING_LABEL_COLOR = 'rgba(168, 150, 137, 0.7)';

/** P8.2 grade 颜色映射:与 ResultCard `.grade-A/B/C/D/E` CSS 类同色,保持视觉一致。 */
export const GRADE_COLORS: Record<Grade, string> = {
  A: '#c0392b',  // 深红
  B: '#e67e22',  // 橙
  C: '#3498db',  // 蓝
  D: '#1abc9c',  // 青
  E: '#6b5b50',  // 灰棕
};
const GRADE_BADGE_FG = '#ffffff';
const GRADE_BADGE_W = 18;
const GRADE_BADGE_H = 16;

/** P8.2 roundRect 路径工具(从 shareImage 复制,供 grade 徽章用)。 */
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export interface RadarDrawOptions {
  /** 中文字体栈,默认 'sans-serif' */
  fontFamily?: string;
  /** 画布内边距(像素),让轴标签不被画布边裁掉;默认 40 */
  padding?: number;
}

/**
 * 在 ctx 上绘制 8 轴雷达图。坐标系相对 (0, 0),画布尺寸 = size,雷达图本身居中。
 * 画布内边距 = opts.padding(默认 40),保证"中文 + grade 徽章"标签不被裁。
 * 如果要画在画布的某个位置,先 ctx.save() / ctx.translate(x, y) / ctx.restore()。
 */
export function drawRadarChart(
  ctx: CanvasRenderingContext2D,
  intervals: RenderedInterval[],
  size: number,
  opts: RadarDrawOptions = {},
): void {
  const fontFamily = opts.fontFamily ?? 'sans-serif';
  const padding = opts.padding ?? 40;
  const N = 8;
  const cx = size / 2;
  const cy = size / 2;
  // 雷达图半径 = 可用半径(画布半宽 - 内边距),确保轴标签(中文+徽章 ≈ 28px)整体落在画布内
  const R = Math.max(60, (size / 2) - padding);
  const labelOffset = Math.max(28, padding * 0.4);

  // 填底色(避免 PNG 透明区域在某些导出路径下显示为黑色;与 shareImage 背景渐变中段色 #fff5f0 一致)
  ctx.fillStyle = '#fff5f0';
  ctx.fillRect(0, 0, size, size);

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

  // 3. 轴标签(P8.2:中文 + grade 徽章,代替原"中文 + 维度单字母")
  const labelFontSize = Math.max(11, Math.round(size * 0.044));
  const gradeFontSize = Math.max(11, Math.round(size * 0.040));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < N; i++) {
    const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
    const lx = cx + (R + labelOffset) * Math.cos(angle);
    const ly = cy + (R + labelOffset) * Math.sin(angle);
    // 上行:中文
    ctx.fillStyle = LABEL_COLOR;
    ctx.font = `500 ${labelFontSize}px ${fontFamily}`;
    ctx.fillText(DIM_CHINESE[i]!, lx, ly - GRADE_BADGE_H * 0.7);
    // 下行:grade 徽章(填 grade 色,白字,粗体)
    const grade = intervals[i]?.grade ?? 'E';
    const bx = lx - GRADE_BADGE_W / 2;
    const by = ly + GRADE_BADGE_H * 0.2;
    ctx.fillStyle = GRADE_COLORS[grade];
    roundRectPath(ctx, bx, by, GRADE_BADGE_W, GRADE_BADGE_H, 6);
    ctx.fill();
    ctx.fillStyle = GRADE_BADGE_FG;
    ctx.font = `700 ${gradeFontSize}px ${fontFamily}`;
    ctx.fillText(grade, lx, by + GRADE_BADGE_H / 2 + 1);
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

  // 5. 数据点(全部 #e74c3c,与多边形描边线同色,不再按 grade 染色)
  for (let i = 0; i < N; i++) {
    const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
    const r = R * data[i]!;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    // 白描边圈(防数据点在小尺寸下糊在多边形上)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // 6. 等级环刻度标签(20/40/60/80/100,在顶部轴右侧)
  ctx.fillStyle = RING_LABEL_COLOR;
  ctx.font = `400 ${Math.max(9, Math.round(size * 0.028))}px ${fontFamily}`;
  for (let k = 1; k <= 5; k++) {
    const r = (R * k) / 5;
    ctx.fillText(`${k * 20}`, cx + 3, cy - r + 1);
  }
}
