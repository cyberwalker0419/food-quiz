import type { Cuisine, FlavorProfile } from '../data/cuisines'

export type ShareCardData = {
  result: Cuisine
  quizMode: 'quick' | 'full'
  profile: FlavorProfile
  secondaryResults: Cuisine[]
  personalityTraits: string[]
  /** Top 3 flavor dimensions normalized to 0..1 */
  topFlavors: { key: string; label: string; value: number }[]
  questionCount: number
}

// Canvas can only render text in fonts that are actually loaded into the
// document. The CSS @import for Noto Sans SC is async — if we draw the card
// before the font finishes loading, every text call silently falls through
// to a font that doesn't have the CJK glyphs we need, and the result looks
// "blank" (the squares are invisible against the cream background).
//
// We force-load the weights we use, wait for them, and then draw.
const FONT_FAMILY =
  '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", "Heiti SC", system-ui, sans-serif'

let fontsReady: Promise<void> | null = null
function ensureFonts(): Promise<void> {
  if (fontsReady) return fontsReady
  if (typeof document === 'undefined' || !(document as any).fonts) {
    fontsReady = Promise.resolve()
    return fontsReady
  }
  // Force the browser to fetch each weight we draw with — `document.fonts.ready`
  // alone resolves once the *currently used* fonts settle, but Canvas-only
  // usage doesn't count as "in use", so the weights we never set on the DOM
  // would otherwise load lazily and miss the first draw.
  const weights = ['400', '500', '600', '700']
  fontsReady = Promise.all(
    weights.map(w => (document as any).fonts.load(`${w} 24px "Noto Sans SC"`)),
  ).then(() => (document as any).fonts.ready).then(() => undefined)
  return fontsReady
}

const FLAVOR_COLORS: Record<string, [string, string]> = {
  spicy: ['#ff6b6b', '#e74c3c'],
  umami: ['#f39c12', '#e67e22'],
  sweet: ['#ff69b4', '#e91e93'],
  sour: ['#2ecc71', '#27ae60'],
  crunchy: ['#9b59b6', '#8e44ad'],
  tender: ['#5dade2', '#3498db'],
  intense: ['#e74c3c', '#c0392b'],
  light: ['#48c9b0', '#1abc9c'],
}

/**
 * Rounded rectangle path (for card backgrounds and chips).
 */
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

/**
 * Wraps text inside a max width and returns lines as an array.
 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const chars = Array.from(text) // handle full-width characters correctly
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
 * Draw the share card on the given canvas. Designed for 720x1280 (mobile
 * aspect) which is widely shareable on WeChat / Twitter / Instagram.
 */
export function drawShareCard(canvas: HTMLCanvasElement, data: ShareCardData) {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context not available')

  const W = canvas.width
  const H = canvas.height

  // ─── Background gradient ──────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#fff9f3')
  bg.addColorStop(0.5, '#fff5f0')
  bg.addColorStop(1, '#ffe8e0')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Decorative top blobs
  const blob = (cx: number, cy: number, r: number, color: string, alpha: number) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    g.addColorStop(0, `${color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`)
    g.addColorStop(1, `${color}00`)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
  }
  blob(W * 0.1, H * 0.05, 280, '#ff6b6b', 0.4)
  blob(W * 0.95, H * 0.4, 320, '#f39c12', 0.3)
  blob(W * 0.1, H * 0.95, 360, '#e91e93', 0.25)

  // ─── Header ──────────────────────────────────────
  ctx.textAlign = 'center'
  ctx.fillStyle = '#a89689'
  ctx.font = `600 22px ${FONT_FAMILY}`
  ctx.fillText('你的味觉灵魂是', W / 2, 80)

  // Mode chip
  const modeText = data.quizMode === 'quick' ? '⚡ 精简版' : '🔥 完整版'
  ctx.font = `500 18px ${FONT_FAMILY}`
  const modeWidth = ctx.measureText(modeText).width
  const chipX = (W - modeWidth) / 2 - 18
  const chipY = 100
  const chipW = modeWidth + 36
  const chipH = 36
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = 'rgba(255, 107, 107, 0.4)'
  ctx.lineWidth = 1
  roundRect(ctx, chipX, chipY, chipW, chipH, 18)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#e74c3c'
  ctx.fillText(modeText, W / 2, chipY + 24)

  // ─── Emoji bubble ──────────────────────────────────────
  const bubbleY = 200
  const bubbleR = 110
  const grad = ctx.createLinearGradient(W / 2 - bubbleR, bubbleY - bubbleR, W / 2 + bubbleR, bubbleY + bubbleR)
  if (data.result.category === 'china') {
    grad.addColorStop(0, '#ff6b6b')
    grad.addColorStop(1, '#ffa07a')
  }
  ctx.fillStyle = grad
  ctx.shadowColor = 'rgba(255, 107, 107, 0.4)'
  ctx.shadowBlur = 30
  ctx.beginPath()
  ctx.arc(W / 2, bubbleY, bubbleR, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.font = `${bubbleR * 1.1}px serif`
  ctx.textBaseline = 'middle'
  ctx.fillText(data.result.emoji, W / 2, bubbleY)

  // ─── Cuisine name ──────────────────────────────────────
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#2d1b14'
  ctx.font = `700 60px ${FONT_FAMILY}`
  ctx.fillText(data.result.name, W / 2, 380)

  // Description
  ctx.font = `400 24px ${FONT_FAMILY}`
  ctx.fillStyle = '#6b5b50'
  const descLines = wrapText(ctx, data.result.description, W - 120)
  descLines.forEach((line, i) => {
    ctx.fillText(line, W / 2, 425 + i * 32)
  })

  // ─── Flavor bars (top 3) ──────────────────────────────────────
  const barTop = 510
  ctx.font = `500 20px ${FONT_FAMILY}`
  ctx.fillStyle = '#a89689'
  ctx.textAlign = 'left'
  ctx.fillText('味觉画像 · 三大特点', 60, barTop)

  data.topFlavors.slice(0, 3).forEach((flav, i) => {
    const y = barTop + 30 + i * 56
    // Label
    ctx.font = `600 22px ${FONT_FAMILY}`
    ctx.fillStyle = '#2d1b14'
    ctx.fillText(flav.label, 60, y + 8)
    // Value
    ctx.font = `700 22px ${FONT_FAMILY}`
    ctx.fillStyle = '#2d1b14'
    ctx.textAlign = 'right'
    ctx.fillText(String(Math.round(flav.value)), W - 60, y + 8)
    // Bar track
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(45, 27, 20, 0.06)'
    roundRect(ctx, 60, y + 18, W - 120, 8, 4)
    ctx.fill()
    // Bar fill
    const colors = FLAVOR_COLORS[flav.key] || ['#999', '#bbb']
    const barGrad = ctx.createLinearGradient(60, y + 18, 60 + (W - 120) * Math.max(0, Math.min(1, flav.value / 10)), y + 18)
    barGrad.addColorStop(0, colors[0])
    barGrad.addColorStop(1, colors[1])
    ctx.fillStyle = barGrad
    roundRect(ctx, 60, y + 18, (W - 120) * Math.max(0, Math.min(1, flav.value / 10)), 8, 4)
    ctx.fill()
  })

  // ─── Personality tags ──────────────────────────────────────
  const tagTop = 730
  ctx.font = `500 20px ${FONT_FAMILY}`
  ctx.fillStyle = '#a89689'
  ctx.textAlign = 'left'
  ctx.fillText('性格标签', 60, tagTop)

  const tagY = tagTop + 28
  let tagX = 60
  data.personalityTraits.slice(0, 4).forEach((trait) => {
    ctx.font = `500 22px ${FONT_FAMILY}`
    const tw = ctx.measureText(trait).width
    const tagW = tw + 36
    if (tagX + tagW > W - 60) {
      // wrap to next line
      return
    }
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = 'rgba(45, 27, 20, 0.1)'
    ctx.lineWidth = 1
    roundRect(ctx, tagX, tagY, tagW, 40, 20)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#6b5b50'
    ctx.fillText(trait, tagX + 18, tagY + 27)
    tagX += tagW + 12
  })

  // ─── Representative dishes ──────────────────────────────────────
  const dishTop = 830
  ctx.font = `500 20px ${FONT_FAMILY}`
  ctx.fillStyle = '#a89689'
  ctx.fillText('代表菜品', 60, dishTop)

  const dishItems = data.result.representativeDishes.slice(0, 5)
  const dishCellW = (W - 120) / 5
  dishItems.forEach((dish, i) => {
    const x = 60 + i * dishCellW
    const cy = dishTop + 50
    ctx.fillStyle = '#fff9f3'
    roundRect(ctx, x + 6, cy, dishCellW - 12, 80, 16)
    ctx.fill()
    ctx.font = `500 18px ${FONT_FAMILY}`
    ctx.fillStyle = '#6b5b50'
    const dishText = dish.length > 4 ? dish.slice(0, 4) : dish
    ctx.textAlign = 'center'
    ctx.fillText(dishText, x + dishCellW / 2, cy + 48)
  })
  ctx.textAlign = 'left'

  // ─── Secondary cuisines hint ──────────────────────────────────────
  if (data.secondaryResults.length > 0) {
    const secTop = 970
    ctx.font = `500 20px ${FONT_FAMILY}`
    ctx.fillStyle = '#a89689'
    ctx.fillText('你可能也喜欢', 60, secTop)
    let sx = 60
    const sy = secTop + 28
    data.secondaryResults.slice(0, 3).forEach((c) => {
      const label = `${c.emoji} ${c.name}`
      ctx.font = `500 20px ${FONT_FAMILY}`
      const tw = ctx.measureText(label).width
      const tagW = tw + 32
      if (sx + tagW > W - 60) return
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = 'rgba(45, 27, 20, 0.08)'
      ctx.lineWidth = 1
      roundRect(ctx, sx, sy, tagW, 40, 20)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#6b5b50'
      ctx.fillText(label, sx + 16, sy + 27)
      sx += tagW + 10
    })
  }

  // ─── Footer / branding ──────────────────────────────────────
  ctx.textAlign = 'center'
  ctx.font = `500 18px ${FONT_FAMILY}`
  ctx.fillStyle = '#a89689'
  ctx.fillText(`基于 ${data.questionCount} 道题深度分析`, W / 2, H - 110)
  ctx.font = `700 22px ${FONT_FAMILY}`
  ctx.fillStyle = '#e74c3c'
  ctx.fillText('🍽️ 测测你的味觉灵魂', W / 2, H - 70)
  ctx.font = `400 16px ${FONT_FAMILY}`
  ctx.fillStyle = '#a89689'
  ctx.fillText('扫码或搜索「味觉灵魂」参与测试', W / 2, H - 40)
}

/**
 * Render the share card to a PNG data URL and trigger a download.
 * Async — waits for fonts before drawing so CJK glyphs render correctly.
 */
export async function downloadShareCard(data: ShareCardData, filename = '我的味觉灵魂.png') {
  await ensureFonts()
  const canvas = document.createElement('canvas')
  canvas.width = 720
  canvas.height = 1280
  drawShareCard(canvas, data)

  // Convert to blob and trigger download
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

/**
 * Render the share card to a base64 PNG data URL (for sharing/embedding).
 * Async — waits for fonts before drawing.
 */
export async function getShareCardDataUrl(data: ShareCardData): Promise<string> {
  await ensureFonts()
  const canvas = document.createElement('canvas')
  canvas.width = 720
  canvas.height = 1280
  drawShareCard(canvas, data)
  return canvas.toDataURL('image/png', 1.0)
}
