import type { AssembledResult } from '../lib/taste/result'

export type ShareCardData = {
  result: AssembledResult
  questionCount: number
}

// Canvas can only render text in fonts that are actually loaded into the
// document. The CSS @import for Noto Sans SC is async — if we draw the card
// before the font finishes loading, every text call silently falls through
// to a font that doesn't have the CJK glyphs we need, and the result looks
// "blank" (the squares are invisible against the cream background).
const FONT_FAMILY =
  '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", "Heiti SC", system-ui, sans-serif'

let fontsReady: Promise<void> | null = null
function ensureFonts(): Promise<void> {
  if (fontsReady) return fontsReady
  if (typeof document === 'undefined' || !(document as { fonts?: unknown }).fonts) {
    fontsReady = Promise.resolve()
    return fontsReady
  }
  const weights = ['400', '500', '600', '700']
  const docFonts = (document as unknown as { fonts: { load(spec: string): Promise<unknown>; ready: Promise<unknown> } }).fonts
  fontsReady = Promise.all(
    weights.map(w => docFonts.load(`${w} 24px "Noto Sans SC"`)),
  ).then(() => docFonts.ready).then(() => undefined)
  return fontsReady
}

// 视觉层 5 等级配色(A/B/C/D/E,每档 20 分)
const GRADE_COLORS: Record<'A' | 'B' | 'C' | 'D' | 'E', [string, string]> = {
  A: ['#e74c3c', '#c0392b'],   // 顶档 红
  B: ['#f39c12', '#e67e22'],   // 高 橙
  C: ['#5dade2', '#3498db'],   // 中 蓝
  D: ['#48c9b0', '#1abc9c'],   // 低 青
  E: ['#a89689', '#6b5b50'],   // 底档 灰
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

/**
 * Draw the share card on the given canvas (720x1280 mobile aspect).
 * Consumes the new AssembledResult shape from P3 (8 中文味觉维 + 区间/极档/联动 文案)。
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

  // Decorative blobs
  const blob = (cx: number, cy: number, rad: number, color: string, alpha: number) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad)
    g.addColorStop(0, `${color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`)
    g.addColorStop(1, `${color}00`)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, cy, rad, 0, Math.PI * 2)
    ctx.fill()
  }
  blob(W * 0.1, H * 0.05, 280, '#ff6b6b', 0.4)
  blob(W * 0.95, H * 0.4, 320, '#f39c12', 0.3)
  blob(W * 0.1, H * 0.95, 360, '#e91e93', 0.25)

  // ─── Header ──────────────────────────────────────
  ctx.textAlign = 'center'
  ctx.fillStyle = '#a89689'
  ctx.font = `600 22px ${FONT_FAMILY}`
  ctx.fillText('你的味觉灵魂图谱', W / 2, 80)

  // 题数 chip
  const chipText = `🧠 自适应 · ${data.questionCount} 题`
  ctx.font = `500 18px ${FONT_FAMILY}`
  const chipWidth = ctx.measureText(chipText).width
  const chipX = (W - chipWidth) / 2 - 18
  const chipY = 100
  const chipW = chipWidth + 36
  const chipH = 36
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = 'rgba(255, 107, 107, 0.4)'
  ctx.lineWidth = 1
  roundRect(ctx, chipX, chipY, chipW, chipH, 18)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#e74c3c'
  ctx.fillText(chipText, W / 2, chipY + 24)

  // ─── 主标签:取 allIntervals 第一条的 tierLabel ─────────
  const top = r.allIntervals[0]
  const headerLabel = top ? top.tierLabel : '味觉独特'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#2d1b14'
  ctx.font = `700 56px ${FONT_FAMILY}`
  ctx.fillText(headerLabel, W / 2, 240)

  // 联动文案 / 全能文案 / 区间文案首句
  let mainCopy = ''
  if (r.allround) {
    mainCopy = r.allround.copy
  } else if (r.synergy) {
    mainCopy = r.synergy.copy
  } else if (top) {
    mainCopy = top.copy
  }
  ctx.font = `400 22px ${FONT_FAMILY}`
  ctx.fillStyle = '#6b5b50'
  const descLines = wrapText(ctx, mainCopy, W - 120)
  descLines.slice(0, 2).forEach((line, i) => {
    ctx.fillText(line, W / 2, 290 + i * 30)
  })

  // ─── 8 维 bar 列表 ──────────────────────────────────────
  const barTop = 380
  ctx.font = `500 20px ${FONT_FAMILY}`
  ctx.fillStyle = '#a89689'
  ctx.textAlign = 'left'
  ctx.fillText('8 维味觉图谱', 60, barTop)

  // 默认显示前 3 高强度(allIntervals 已按强度降序)
  const top3 = r.allIntervals.slice(0, 3)
  top3.forEach((iv, i) => {
    const y = barTop + 30 + i * 56
    ctx.font = `600 22px ${FONT_FAMILY}`
    ctx.fillStyle = '#2d1b14'
    ctx.fillText(`${iv.tierLabel}  ${iv.grade}`, 60, y + 8)
    ctx.font = `700 22px ${FONT_FAMILY}`
    ctx.fillStyle = '#2d1b14'
    ctx.textAlign = 'right'
    ctx.fillText(String(Math.round(iv.value)), W - 60, y + 8)
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(45, 27, 20, 0.06)'
    roundRect(ctx, 60, y + 18, W - 120, 8, 4)
    ctx.fill()
    const colors = GRADE_COLORS[iv.grade]
    const ratio = Math.max(0, Math.min(1, iv.value / 100))
    const barGrad = ctx.createLinearGradient(60, y + 18, 60 + (W - 120) * ratio, y + 18)
    barGrad.addColorStop(0, colors[0])
    barGrad.addColorStop(1, colors[1])
    ctx.fillStyle = barGrad
    roundRect(ctx, 60, y + 18, (W - 120) * ratio, 8, 4)
    ctx.fill()
  })

  // ─── 极档警告 ──────────────────────────────────────
  const extremeTop = 600
  if (r.extremes.length > 0) {
    ctx.font = `500 20px ${FONT_FAMILY}`
    ctx.fillStyle = '#a89689'
    ctx.fillText('极档警告', 60, extremeTop)
    r.extremes.slice(0, 3).forEach((ex, i) => {
      const y = extremeTop + 32 + i * 38
      ctx.font = `600 20px ${FONT_FAMILY}`
      ctx.fillStyle = '#e74c3c'
      ctx.fillText(ex.label, 60, y)
      ctx.font = `400 18px ${FONT_FAMILY}`
      ctx.fillStyle = '#6b5b50'
      const text = ex.copy[0] || ''
      ctx.fillText(text.length > 22 ? text.slice(0, 22) + '…' : text, 60, y + 22)
    })
  }

  // ─── 避雷指南 ──────────────────────────────────────
  if (r.avoid) {
    const avoidTop = 800
    ctx.font = `500 20px ${FONT_FAMILY}`
    ctx.fillStyle = '#a89689'
    ctx.fillText('避雷指南', 60, avoidTop)
    ctx.font = `600 22px ${FONT_FAMILY}`
    ctx.fillStyle = '#2d1b14'
    ctx.fillText(r.avoid.label, 60, avoidTop + 32)
    ctx.font = `400 18px ${FONT_FAMILY}`
    ctx.fillStyle = '#6b5b50'
    const lines = wrapText(ctx, r.avoid.copy, W - 120)
    lines.slice(0, 2).forEach((line, i) => {
      ctx.fillText(line, 60, avoidTop + 60 + i * 24)
    })
  }

  // ─── 推荐菜(Phase 5 才有) ──────────────────────────────────────
  if (r.topDishes.length > 0) {
    const dishTop = 940
    ctx.font = `500 20px ${FONT_FAMILY}`
    ctx.fillStyle = '#a89689'
    ctx.fillText('今天吃这些', 60, dishTop)
    const items = r.topDishes.slice(0, 5)
    const cellW = (W - 120) / 5
    items.forEach((dish, i) => {
      const x = 60 + i * cellW
      const cy = dishTop + 30
      ctx.fillStyle = '#fff9f3'
      roundRect(ctx, x + 6, cy, cellW - 12, 80, 16)
      ctx.fill()
      ctx.font = `500 16px ${FONT_FAMILY}`
      ctx.fillStyle = '#6b5b50'
      const text = dish.name.length > 4 ? dish.name.slice(0, 4) : dish.name
      ctx.textAlign = 'center'
      ctx.fillText(text, x + cellW / 2, cy + 48)
    })
    ctx.textAlign = 'left'
  }

  // ─── Footer ──────────────────────────────────────
  ctx.textAlign = 'center'
  ctx.font = `500 18px ${FONT_FAMILY}`
  ctx.fillStyle = '#a89689'
  ctx.fillText(`基于 ${data.questionCount} 道题 · 8 维向量分析`, W / 2, H - 110)
  ctx.font = `700 22px ${FONT_FAMILY}`
  ctx.fillStyle = '#e74c3c'
  ctx.fillText('🍽️ 测测你的味觉灵魂', W / 2, H - 70)
  ctx.font = `400 16px ${FONT_FAMILY}`
  ctx.fillStyle = '#a89689'
  ctx.fillText('扫码或搜索「味觉灵魂」参与测试', W / 2, H - 40)
}

/** Render to PNG and trigger download. */
export async function downloadShareCard(data: ShareCardData, filename = '我的味觉灵魂.png') {
  await ensureFonts()
  const canvas = document.createElement('canvas')
  canvas.width = 720
  canvas.height = 1280
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
  }, 'image/png', 1.0)
}

/** Render to base64 data URL. */
export async function getShareCardDataUrl(data: ShareCardData): Promise<string> {
  await ensureFonts()
  const canvas = document.createElement('canvas')
  canvas.width = 720
  canvas.height = 1280
  drawShareCard(canvas, data)
  return canvas.toDataURL('image/png', 1.0)
}
