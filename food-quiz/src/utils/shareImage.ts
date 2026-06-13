import type { AssembledResult } from '../lib/taste/result'
import { drawRadarChart } from '../lib/taste/radarChart'

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

/**
 * Draw the share card on the given canvas (P6.4 尺寸 540×960)。
 * 8 维图改为 Canvas 雷达图(P6.3)。
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
  ctx.font = `700 42px ${FONT_FAMILY}`
  ctx.fillText(headerLabel, W / 2, 180)

  // 联动文案 / 全能文案 / 区间文案首句
  let mainCopy = ''
  if (r.allround) {
    mainCopy = r.allround.copy
  } else if (r.synergy) {
    mainCopy = r.synergy.copy
  } else if (top) {
    mainCopy = top.copy
  }
  ctx.font = `400 16px ${FONT_FAMILY}`
  ctx.fillStyle = '#6b5b50'
  const descLines = wrapText(ctx, mainCopy, W - 90)
  descLines.slice(0, 2).forEach((line, i) => {
    ctx.fillText(line, W / 2, 215 + i * 22)
  })

  // ─── 8 维雷达图(P6.3) ──────────────────────────────────────
  const radarSize = 320
  const radarY = 260
  ctx.save()
  ctx.translate((W - radarSize) / 2, radarY)
  drawRadarChart(ctx, r.allIntervals, radarSize, { fontFamily: FONT_FAMILY })
  ctx.restore()

  // 8 维档位标题(雷达图下方)
  ctx.font = `500 14px ${FONT_FAMILY}`
  ctx.fillStyle = '#a89689'
  ctx.textAlign = 'center'
  ctx.fillText('8 维味觉图谱', W / 2, radarY + radarSize + 24)

  // ─── 极档警告 ──────────────────────────────────────
  if (r.extremes.length > 0) {
    const extremeTop = radarY + radarSize + 70
    ctx.textAlign = 'left'
    ctx.font = `500 14px ${FONT_FAMILY}`
    ctx.fillStyle = '#a89689'
    ctx.fillText('极档警告', 40, extremeTop)
    r.extremes.slice(0, 2).forEach((ex, i) => {
      const y = extremeTop + 22 + i * 30
      ctx.font = `600 14px ${FONT_FAMILY}`
      ctx.fillStyle = '#e74c3c'
      ctx.fillText(ex.label, 40, y)
      ctx.font = `400 12px ${FONT_FAMILY}`
      ctx.fillStyle = '#6b5b50'
      const text = ex.copy[0] || ''
      ctx.fillText(text.length > 22 ? text.slice(0, 22) + '…' : text, 40, y + 16)
    })
  }

  // ─── 避雷指南 ──────────────────────────────────────
  if (r.avoid) {
    const avoidTop = H - 230
    ctx.textAlign = 'left'
    ctx.font = `500 14px ${FONT_FAMILY}`
    ctx.fillStyle = '#a89689'
    ctx.fillText('避雷指南', 40, avoidTop)
    ctx.font = `600 16px ${FONT_FAMILY}`
    ctx.fillStyle = '#2d1b14'
    ctx.fillText(r.avoid.label, 40, avoidTop + 24)
    ctx.font = `400 12px ${FONT_FAMILY}`
    ctx.fillStyle = '#6b5b50'
    const lines = wrapText(ctx, r.avoid.copy, W - 80)
    lines.slice(0, 2).forEach((line, i) => {
      ctx.fillText(line, 40, avoidTop + 46 + i * 18)
    })
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
