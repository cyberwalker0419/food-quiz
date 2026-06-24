/**
 * 8 维雷达图绘制纯函数。
 * - 供 React 组件(RadarChart.tsx)调用
 * - 供分享卡(shareImage.ts)调用
 * - 输入:Canvas 2D context、归一化后的 8 维数据(按 letters 顺序)、画布尺寸
 * - 输出:在传入 ctx 上直接绘制
 *
 * 视觉风格对齐 国风 editorial 系统(米纸·墨·朱砂·宋体):
 * - 网格/轴线:墨色淡描
 * - 数据多边形:朱砂半透明 + 朱砂描边
 * - 轴标签:中文(墨) + grade 字母(墨灰,纯文本,无徽章)
 * - 数据点:朱砂实心 + 白描边
 */
import { DIMS, DIM_CHINESE, type Grade } from './keys';
import type { RenderedInterval } from './result';

// ─ 国风色板(对齐 styles/App.css :root) ──
const INK = '#1F1A17';
const INK_3 = '#9A8B75';
const CINNABAR = '#9E2B25';
const PAPER = '#F5EFE0';

const GRID_COLOR = 'rgba(31, 26, 23, 0.10)';
const AXIS_COLOR = 'rgba(31, 26, 23, 0.16)';
const RING_LABEL_COLOR = 'rgba(154, 139, 117, 0.6)';

/** P8.2 grade 颜色映射:与 ResultCard `.grade-A/B/C/D/E` CSS 类同色,保持视觉一致。 */
export const GRADE_COLORS: Record<Grade, string> = {
  A: '#c0392b',  // 深红
  B: '#e67e22',  // 橙
  C: '#3498db',  // 蓝
  D: '#1abc9c',  // 青
  E: '#6b5b50',  // 灰棕
};

export interface RadarDrawOptions {
  /** 中文字体栈,默认 'sans-serif' */
  fontFamily?: string;
  /** 画布内边距(像素),让轴标签不被画布边裁掉;默认 50 */
  padding?: number;
}

/**
 * 在 ctx 上绘制 8 轴雷达图。坐标系相对 (0, 0),画布尺寸 = size,雷达图本身居中。
 * 画布内边距 = opts.padding(默认 50),保证轴标签(中文 + grade 纯文本)整体落在画布内。
 * 如果要画在画布的某个位置,先 ctx.save() / ctx.translate(x, y) / ctx.restore()。
 */
export function drawRadarChart(
  ctx: CanvasRenderingContext2D,
  intervals: RenderedInterval[],
  size: number,
  opts: RadarDrawOptions = {},
): void {
  const fontFamily = opts.fontFamily ?? 'sans-serif';
  const padding = opts.padding ?? 50;
  const N = 8;
  const cx = size / 2;
  const cy = size / 2;
  // 雷达图半径 = 可用半径(画布半宽 - 内边距)
  const R = Math.max(40, (size / 2) - padding);
  // 标签字号(提前算,供 labelOffset 使用)
  const labelFontSize = Math.max(12, Math.round(size * 0.044));
  const gradeFontSize = Math.max(10, Math.round(size * 0.034));
  // 标签偏移:半径外留白,保证"grade + 中文"纵向堆叠不被裁
  // 两行文字总高 ≈ gradeFontSize + 间距(4) + labelFontSize,取一半 + margin
  const labelHalfH = (gradeFontSize + labelFontSize + 4) / 2 + 3;
  const labelOffset = Math.max(labelHalfH + 4, size * 0.11);

  // 填底色(米纸色,与页面背景一致,避免透明区域在某些导出路径下显示为黑色)
  ctx.fillStyle = PAPER;
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

  // 3. 轴标签:中文(墨) + grade 字母(墨灰,纯文本,无徽章)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < N; i++) {
    const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
    const lx = cx + (R + labelOffset) * Math.cos(angle);
    const ly = cy + (R + labelOffset) * Math.sin(angle);
    // 上行:grade 字母(墨灰,小字,无颜色徽章)
    const axisIv = intervals.find((iv) => iv.letter === DIMS[i]);
    const grade = axisIv?.grade ?? 'E';
    ctx.fillStyle = INK_3;
    ctx.font = `600 ${gradeFontSize}px ${fontFamily}`;
    ctx.fillText(grade, lx, ly - labelFontSize * 0.55);
    // 下行:中文(墨,主字)
    ctx.fillStyle = INK;
    ctx.font = `500 ${labelFontSize}px ${fontFamily}`;
    ctx.fillText(DIM_CHINESE[i]!, lx, ly + gradeFontSize * 0.45);
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
  // 朱砂半透明填充(由内向外渐变,中心淡边缘稍浓)
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  grad.addColorStop(0, 'rgba(158, 43, 37, 0.08)');
  grad.addColorStop(1, 'rgba(158, 43, 37, 0.22)');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = CINNABAR;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 5. 数据点(朱砂实心 + 白描边圈,防小尺寸下糊在多边形上)
  for (let i = 0; i < N; i++) {
    const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
    const r = R * data[i]!;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    ctx.fillStyle = CINNABAR;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
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
