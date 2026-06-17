import type { AssembledResult, RenderedInterval } from '../lib/taste/result'
import { drawRadarChart, GRADE_COLORS } from '../lib/taste/radarChart'
import { letterToChinese } from '../lib/taste/keys'
import type { DishEntry } from '../lib/taste/loaders'

export type ShareCardData = {
  result: AssembledResult
  questionCount: number
}

// P6.4 画布尺寸缩小:720×1280 → 540×960
const CARD_W = 540
const CARD_H = 960

// Canvas can only render text in fonts that are actually loaded into the
// document. The CSS @import for Noto Sans SC is async — if we draw the card
// before the font finishes loading, every text call silently falls through
// to a font that doesn't have the CJK glyphs we need, and the result looks
// "blank" (the squares are invisible against the cream background).
const FONT_FAMILY =
  '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", "Heiti SC", system-ui, sans-serif'

// P6.4 字体加载加 2.5s 超时,网络慢时不再永远阻塞
const FONT_LOAD_TIMEOUT_MS = 2500

/** P7.2 顶层预加载入口 — App 挂载时调一次,确保 result 阶段字体已就绪。 */
export function preloadShareCardFonts(): void {
  // 不 await;UI 渲染不该被字体阻塞
  ensureFonts().catch(() => { /* 静默,toBlob 路径兜底 */ })
}

let fontsReady: Promise<void> | null = null
function ensureFonts(): Promise<void> {
  if (fontsReady) return fontsReady
  if (typeof document === 'undefined' || !(document as { fonts?: unknown }).fonts) {
    fontsReady = Promise.resolve()
    return fontsReady
  }
  const weights = ['400', '500', '600', '700']
  const docFonts = (document as unknown as { fonts: { load(spec: string): Promise<unknown>; ready: Promise<unknown> } }).fonts
  const loadAll = Promise.all(
    weights.map(w => docFonts.load(`${w} 24px "Noto Sans SC"`)),
  ).then(() => docFonts.ready).then(() => undefined)
  const timeout = new Promise<void>(resolve => setTimeout(resolve, FONT_LOAD_TIMEOUT_MS))
  fontsReady = Promise.race([loadAll, timeout])
  return fontsReady
}

/** Rounded rectangle path */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

/** Wrap text inside a max width and return lines */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const chars = Array.from(text)
  const lines: string[] = []
  let line = ''
  for (const ch of chars) {
    const test = line + ch
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = ch
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

/** P8.3 8 维档位明细:每行 "酸  重辣 ⚡极  [A] 92" 4 列右对齐。 */
function drawDimensionList(
  ctx: CanvasRenderingContext2D,
  intervals: readonly RenderedInterval[],
  x: number,
  y: number,
  w: number,
  fontFamily: string,
): void {
  const rowH = 18;
  const colChineseX = x;             // 中文列起点
  const colTierX = x + 50;           // tierLabel 列起点
  const colGradeX = x + 250;         // grade 徽章列起点
  const colValueX = x + w;           // value 列终点(右对齐)
  for (let i = 0; i < intervals.length; i++) {
    const iv = intervals[i]!;
    const ly = y + i * rowH;
    // 列 1:中文
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#2d1b14';
    ctx.font = `500 13px ${fontFamily}`;
    ctx.fillText(letterToChinese(iv.letter), colChineseX, ly);
    // 列 2:tierLabel
    ctx.fillStyle = '#6b5b50';
    ctx.font = `400 12px ${fontFamily}`;
    ctx.fillText(iv.tierLabel, colTierX, ly);
    // 列 3:grade 徽章
    const badgeW = 18;
    const badgeH = 14;
    const bx = colGradeX;
    const by = ly - badgeH / 2;
    ctx.fillStyle = GRADE_COLORS[iv.grade];
    roundRect(ctx, bx, by, badgeW, badgeH, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 11px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.fillText(iv.grade, bx + badgeW / 2, ly + 1);
    // 列 4:value 右对齐
    ctx.textAlign = 'right';
    ctx.fillStyle = '#2d1b14';
    ctx.font = `600 12px ${fontFamily}`;
    ctx.fillText(iv.value.toFixed(0), colValueX, ly);
  }
}

/** P8.3 推荐菜 3 道:每行 "🍴 菜名 · 菜系",菜名截断至 8 字。 */
function drawTopDishes(
  ctx: CanvasRenderingContext2D,
  dishes: readonly DishEntry[],
  x: number,
  y: number,
  w: number,
  fontFamily: string,
): void {
  const items = dishes.slice(0, 3);
  const rowH = 18;
  for (let i = 0; i < items.length; i++) {
    const d = items[i]!;
    const ly = y + i * rowH;
    const name = d.name.length > 8 ? d.name.slice(0, 8) + '…' : d.name;
    const text = `🍴 ${name} · ${d.cuisine}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#6b5b50';
    ctx.font = `400 12px ${fontFamily}`;
    ctx.fillText(text, x, ly);
    // 副文本(地域,放右侧)
    if (d.region) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#a89689';
      ctx.font = `400 11px ${fontFamily}`;
      ctx.fillText(d.region, x + w, ly);
    }
  }
}

/** P8.3 在 mainCopy 上方画一行 section 标题:全能味觉 / 味觉共振 / 味觉特征。 */
function pickSectionTitle(r: AssembledResult): string {
  if (r.allround) return '全能味觉';
  if (r.synergy) return '味觉共振';
  return '味觉特征';
}

/**
 * Draw the share card on the given canvas (P6.4 尺寸 540×960)。
 * 8 维图改为 Canvas 雷达图(P6.3)。P8.3 重排:加 section 标题、8 维档位明细、推荐菜。
 */
export function drawShareCard(canvas: HTMLCanvasElement, data: ShareCardData) {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context not available')

  const W = canvas.width
  const H = canvas.height
  const r = data.result

  // ─── Background gradient ──────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#fff9f3')
  bg.addColorStop(0.5, '#fff5f0')
  bg.addColorStop(1, '#ffe8e0')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Decorative blobs(按新尺寸等比缩放)
  const blob = (cx: number, cy: number, rad: number, color: string, alpha: number) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad)
    g.addColorStop(0, `${color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`)
    g.addColorStop(1, `${color}00`)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, cy, rad, 0, Math.PI * 2)
    ctx.fill()
  }
  blob(W * 0.1, H * 0.05, 210, '#ff6b6b', 0.4)
  blob(W * 0.95, H * 0.4, 240, '#f39c12', 0.3)
  blob(W * 0.1, H * 0.95, 270, '#e91e93', 0.25)

  // ─── Header ──────────────────────────────────────
  ctx.textAlign = 'center'
  ctx.fillStyle = '#a89689'
  ctx.font = `600 18px ${FONT_FAMILY}`
  ctx.fillText('你的味觉灵魂图谱', W / 2, 60)

  // 题数 chip
  const chipText = `🧠 自适应 · ${data.questionCount} 题`
  ctx.font = `500 14px ${FONT_FAMILY}`
  const chipWidth = ctx.measureText(chipText).width
  const chipX = (W - chipWidth) / 2 - 14
  const chipY = 76
  const chipW = chipWidth + 28
  const chipH = 28
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = 'rgba(255, 107, 107, 0.4)'
  ctx.lineWidth = 1
  roundRect(ctx, chipX, chipY, chipW, chipH, 14)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#e74c3c'
  ctx.fillText(chipText, W / 2, chipY + 19)

  // ─── 主标签:取 allIntervals 第一条的 tierLabel ─────────
  const top = r.allIntervals[0]
  const headerLabel = top ? top.tierLabel : '味觉独特'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#2d1b14'
  ctx.font = `700 38px ${FONT_FAMILY}`
  // P9.x v2 字号 42→38(顶端 ≈ y=110,距 chipText y=95 留 15px 缓冲)
  ctx.fillText(headerLabel, W / 2, 148)

  // P8.3 section 标题(主标签 + mainCopy 之间)
  // P9.x v2 字号 13→12,下移到 y=176(middle),文字 y=170-182
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#a89689'
  ctx.font = `500 12px ${FONT_FAMILY}`
  ctx.fillText(pickSectionTitle(r), W / 2, 176)

  // 联动文案 / 全能文案 / 区间文案首句
  let mainCopy = ''
  if (r.allround) {
    mainCopy = r.allround.copy
  } else if (r.synergy) {
    mainCopy = r.synergy.copy
  } else if (top) {
    mainCopy = top.copy
  }
  // P9.x v2 synergy/allround 副标题:y=198(middle 13px),文字 y=192-204
  if (r.synergy) {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#e74c3c'
    ctx.font = `600 13px ${FONT_FAMILY}`
    ctx.fillText(r.synergy.label, W / 2, 198)
  } else if (r.allround) {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#e74c3c'
    ctx.font = `600 13px ${FONT_FAMILY}`
    ctx.fillText(r.allround.label, W / 2, 198)
  }
  // P9.x v2 mainCopy:字号 13→12,行高 18→16,互斥 y,严格保证 y<260(雷达顶端)
  //   无副标题 → 起始 y=194(距 section title 12px),末行 y=210 → 距雷达 50px ✓
  //   有副标题 → 起始 y=222(距 synergy.label 14px),末行 y=238 → 距雷达 22px ✓
  ctx.font = `400 12px ${FONT_FAMILY}`
  ctx.fillStyle = '#6b5b50'
  const hasSubLabel = !!(r.synergy || r.allround)
  const mainCopyStartY = hasSubLabel ? 222 : 194
  const descLineH = 16
  const descLines = wrapText(ctx, mainCopy, W - 90)
  descLines.slice(0, 2).forEach((line, i) => {
    ctx.fillText(line, W / 2, mainCopyStartY + i * descLineH)
  })

  // ─── 8 维雷达图(P6.3;P8.3 缩 320→280) ─────────────────
  const radarSize = 280
  const radarY = 400
  ctx.save()
  ctx.translate((W - radarSize) / 2, radarY - radarSize / 2)
  drawRadarChart(ctx, r.allIntervals, radarSize, { fontFamily: FONT_FAMILY })
  ctx.restore()

  // P8.3 8 维档位明细小标题
  ctx.font = `500 14px ${FONT_FAMILY}`
  ctx.fillStyle = '#a89689'
  ctx.textAlign = 'center'
  ctx.fillText('8 维档位明细', W / 2, 560)

  // P8.3 8 维档位明细
  drawDimensionList(ctx, r.allIntervals, 40, 580, W - 80, FONT_FAMILY)

  // ─── 极档警告(P8.3 1 条) ──────────────────────────────────────
  if (r.extremes.length > 0) {
    const extremeTop = 740
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.font = `500 13px ${FONT_FAMILY}`
    ctx.fillStyle = '#a89689'
    ctx.fillText('极档警告', 40, extremeTop)
    const ex = r.extremes[0]!
    ctx.font = `600 13px ${FONT_FAMILY}`
    ctx.fillStyle = '#e74c3c'
    ctx.fillText(ex.label, 40, extremeTop + 20)
    ctx.font = `400 11px ${FONT_FAMILY}`
    ctx.fillStyle = '#6b5b50'
    const text = (ex.copy[0] || '').slice(0, 28)
    ctx.fillText(text, 40, extremeTop + 38)
  }

  // ─── 避雷指南(P8.3 单行,y=790) ───────────────────────────
  if (r.avoid) {
    const avoidTop = 790
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.font = `500 13px ${FONT_FAMILY}`
    ctx.fillStyle = '#a89689'
    ctx.fillText('避雷指南', 40, avoidTop)
    ctx.font = `600 13px ${FONT_FAMILY}`
    ctx.fillStyle = '#2d1b14'
    ctx.fillText(r.avoid.label, 100, avoidTop)
    ctx.font = `400 11px ${FONT_FAMILY}`
    ctx.fillStyle = '#6b5b50'
    const lines = wrapText(ctx, r.avoid.copy, W - 80)
    ctx.fillText((lines[0] || '').slice(0, 32), 40, avoidTop + 20)
  }

  // ─── P8.3 推荐菜 ──────────────────────────────────────
  if (r.topDishes.length > 0) {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `500 13px ${FONT_FAMILY}`
    ctx.fillStyle = '#a89689'
    ctx.fillText('为你推荐', W / 2, 830)
    drawTopDishes(ctx, r.topDishes, 40, 850, W - 80, FONT_FAMILY)
  }

  // ─── Footer ──────────────────────────────────────
  ctx.textAlign = 'center'
  ctx.font = `500 12px ${FONT_FAMILY}`
  ctx.fillStyle = '#a89689'
  ctx.fillText(`基于 ${data.questionCount} 道题 · 8 维向量分析`, W / 2, H - 80)
  ctx.font = `700 16px ${FONT_FAMILY}`
  ctx.fillStyle = '#e74c3c'
  ctx.fillText('🍽️ 测测你的味觉灵魂', W / 2, H - 56)
  ctx.font = `400 11px ${FONT_FAMILY}`
  ctx.fillStyle = '#a89689'
  ctx.fillText('扫码或搜索「味觉灵魂」参与测试', W / 2, H - 32)
}

/** P6.4 渲染为 JPEG 并触发下载(尺寸 540×960,jpeg 0.85)。 */
export async function downloadShareCard(data: ShareCardData, filename = '我的味觉灵魂.jpg') {
  await ensureFonts()
  const canvas = document.createElement('canvas')
  canvas.width = CARD_W
  canvas.height = CARD_H
  drawShareCard(canvas, data)

  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, 'image/jpeg', 0.85)
}

/** P6.4 渲染为 JPEG dataURL。 */
export async function getShareCardDataUrl(data: ShareCardData): Promise<string> {
  await ensureFonts()
  const canvas = document.createElement('canvas')
  canvas.width = CARD_W
  canvas.height = CARD_H
  drawShareCard(canvas, data)
  return canvas.toDataURL('image/jpeg', 0.85)
}

/** 测试用:暴露卡片尺寸常量。 */
export const SHARE_CARD_SIZE = { width: CARD_W, height: CARD_H } as const
