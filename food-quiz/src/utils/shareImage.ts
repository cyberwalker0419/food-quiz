import type { AssembledResult, RenderedInterval } from '../lib/taste/result'
import { drawRadarChart, GRADE_COLORS } from '../lib/taste/radarChart'
import { letterToChinese } from '../lib/taste/keys'
import type { DishEntry } from '../lib/taste/loaders'

export type ShareCardData = {
  result: AssembledResult
  questionCount: number
}

// P6.4 画布尺寸:720×1280 → 540×960
const CARD_W = 540
const CARD_H = 960

// ── 国风色板(对齐 styles/App.css :root,米纸·墨·朱砂) ──
const PAPER = '#F5EFE0'
const INK = '#1F1A17'
const INK_2 = '#5A4D40'
const INK_3 = '#9A8B75'
const CINNABAR = '#9E2B25'
const SEAL = '#B23A30'
const LINE = '#C9BFA8'

// ── 字体(思源宋体为主,毛笔体点缀;宋体未就绪会画空白方块,故预载) ──
const FONT_SERIF = '"Noto Serif SC", "Songti SC", "STSong", serif'
const FONT_BRUSH = '"Ma Shan Zheng", "Noto Serif SC", cursive'

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
  // 宋体(主体)+ 毛笔体(标语)+ 黑体(雷达轴数值兜底)全部预载
  const loadAll = Promise.all([
    ...weights.map((w) => docFonts.load(`${w} 24px "Noto Sans SC"`)),
    ...weights.map((w) => docFonts.load(`${w} 24px "Noto Serif SC"`)),
    docFonts.load('400 24px "Ma Shan Zheng"'),
  ]).then(() => docFonts.ready).then(() => undefined)
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, FONT_LOAD_TIMEOUT_MS))
  fontsReady = Promise.race([loadAll, timeout])
  return fontsReady
}

// ── 绘制 helpers ──

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

/** 米纸 radial 纹理一笔(底色已先铺 paper,三层叠加出温润纸感)。 */
function paintRadial(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  cx: number,
  cy: number,
  r: number,
  innerColor: string,
) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
  g.addColorStop(0, innerColor)
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}

/** 细线分隔(横贯,左右留边;+0.5 半像素对齐 1px 描边)。 */
function drawDivider(ctx: CanvasRenderingContext2D, W: number, y: number, inset = 40) {
  ctx.strokeStyle = LINE
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(inset, y + 0.5)
  ctx.lineTo(W - inset, y + 0.5)
  ctx.stroke()
}

/** 朱砂方印 + 白字(右上角视觉锚点)。 */
function drawSeal(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, char: string, font: string) {
  ctx.save()
  ctx.fillStyle = SEAL
  roundRect(ctx, x, y, size, size, 5)
  ctx.fill()
  ctx.fillStyle = PAPER
  ctx.font = `700 ${Math.round(size * 0.56)}px ${font}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(char, x + size / 2, y + size / 2 + size * 0.04)
  ctx.restore()
}

/** 八维档位明细:每行 "中文 / tierLabel / [grade] / value",右对齐数值。 */
function drawDimensionList(
  ctx: CanvasRenderingContext2D,
  intervals: readonly RenderedInterval[],
  x: number,
  y: number,
  w: number,
  fontFamily: string,
): void {
  const rowH = 18
  const colChineseX = x // 中文列起点
  const colTierX = x + 50 // tierLabel 列起点
  const colGradeX = x + 250 // grade 徽章列起点
  const colValueX = x + w // value 列终点(右对齐)
  for (let i = 0; i < intervals.length; i++) {
    const iv = intervals[i]!
    const ly = y + i * rowH
    // 列 1:中文(墨)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = INK
    ctx.font = `500 13px ${fontFamily}`
    ctx.fillText(letterToChinese(iv.letter), colChineseX, ly)
    // 列 2:tierLabel(墨灰)
    ctx.fillStyle = INK_2
    ctx.font = `400 12px ${fontFamily}`
    ctx.fillText(iv.tierLabel, colTierX, ly)
    // 列 3:grade 徽章(GRADE_COLORS 档位色,白字)
    const badgeW = 18
    const badgeH = 14
    const bx = colGradeX
    const by = ly - badgeH / 2
    ctx.fillStyle = GRADE_COLORS[iv.grade]
    roundRect(ctx, bx, by, badgeW, badgeH, 4)
    ctx.fill()
    ctx.fillStyle = PAPER
    ctx.font = `700 11px ${fontFamily}`
    ctx.textAlign = 'center'
    ctx.fillText(iv.grade, bx + badgeW / 2, ly + 1)
    // 列 4:value 右对齐(墨)
    ctx.textAlign = 'right'
    ctx.fillStyle = INK
    ctx.font = `600 12px ${fontFamily}`
    ctx.fillText(iv.value.toFixed(0), colValueX, ly)
  }
}

/** 推荐菜 3 道:菜名(墨)·菜系(朱砂)左对齐,地区(墨灰)右对齐;菜名截断 8 字。 */
function drawTopDishes(
  ctx: CanvasRenderingContext2D,
  dishes: readonly DishEntry[],
  x: number,
  y: number,
  w: number,
  fontFamily: string,
): void {
  const items = dishes.slice(0, 3)
  const rowH = 18
  for (let i = 0; i < items.length; i++) {
    const d = items[i]!
    const ly = y + i * rowH
    const name = d.name.length > 8 ? d.name.slice(0, 8) + '…' : d.name
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    // 菜名(墨)
    ctx.fillStyle = INK
    ctx.font = `500 13px ${fontFamily}`
    ctx.fillText(name, x, ly)
    const nameW = ctx.measureText(name).width
    // 菜系(朱砂,紧跟菜名)
    ctx.fillStyle = CINNABAR
    ctx.font = `400 11px ${fontFamily}`
    ctx.fillText(` · ${d.cuisine}`, x + nameW, ly)
    // 地区(墨灰,右对齐)
    if (d.region) {
      ctx.textAlign = 'right'
      ctx.fillStyle = INK_3
      ctx.font = `400 11px ${fontFamily}`
      ctx.fillText(d.region, x + w, ly)
    }
  }
}

/** mainCopy 上方 section 标题:全能味觉 / 味觉共振 / 味觉特征。 */
function pickSectionTitle(r: AssembledResult): string {
  if (r.allround) return '全能味觉'
  if (r.synergy) return '味觉共振'
  return '味觉特征'
}

/**
 * 绘制国风分享卡(540×960,米纸·墨·朱砂·宋体·印章)。
 * 信息层级与 ResultCard.tsx §9 一致;Canvas 视觉无法单测,靠逐色值对齐 :root。
 */
export function drawShareCard(canvas: HTMLCanvasElement, data: ShareCardData) {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context not available')

  const W = canvas.width
  const H = canvas.height
  const r = data.result

  // ── 米纸底 + 三层 radial 纹理(复刻 body 背景:金/朱砂/白) ──
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, W, H)
  paintRadial(ctx, W, H, W * 0.2, H * 0.1, 420, 'rgba(166,124,46,0.06)')
  paintRadial(ctx, W, H, W * 0.8, H * 0.9, 460, 'rgba(158,43,37,0.05)')
  paintRadial(ctx, W, H, W * 0.5, H * 0.5, 520, 'rgba(255,255,255,0.35)')

  // ── 顶部小标题 + 右上印章 ──
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = INK_3
  ctx.font = `500 15px ${FONT_SERIF}`
  ctx.fillText('你的味觉灵魂图谱', W / 2, 52)
  drawSeal(ctx, W - 82, 28, 48, '鉴', FONT_BRUSH)

  // 细线分隔
  drawDivider(ctx, W, 92)

  // ── 主标签(top.tierLabel,大宋体) ──
  const top = r.allIntervals[0]
  const headerLabel = top ? top.tierLabel : '味觉独特'
  ctx.fillStyle = INK
  ctx.font = `700 42px ${FONT_SERIF}`
  ctx.fillText(headerLabel, W / 2, 150)

  // section 标题(主标签 + mainCopy 之间)
  ctx.textBaseline = 'middle'
  ctx.fillStyle = INK_3
  ctx.font = `500 12px ${FONT_SERIF}`
  ctx.fillText(pickSectionTitle(r), W / 2, 178)

  // synergy / allround 副标签(朱砂)
  if (r.synergy || r.allround) {
    ctx.fillStyle = CINNABAR
    ctx.font = `600 13px ${FONT_SERIF}`
    ctx.fillText((r.synergy || r.allround)!.label, W / 2, 200)
  }

  // mainCopy(墨灰,最多 2 行)
  let mainCopy = ''
  if (r.allround) mainCopy = r.allround.copy
  else if (r.synergy) mainCopy = r.synergy.copy
  else if (top) mainCopy = top.copy
  const hasSubLabel = !!(r.synergy || r.allround)
  const mainCopyStartY = hasSubLabel ? 224 : 196
  ctx.fillStyle = INK_2
  ctx.font = `400 12px ${FONT_SERIF}`
  const descLines = wrapText(ctx, mainCopy, W - 96)
  descLines.slice(0, 2).forEach((line, i) => {
    ctx.fillText(line, W / 2, mainCopyStartY + i * 16)
  })

  // ── 八维雷达图(中心 y=400) ──
  const radarSize = 280
  const radarY = 400
  ctx.save()
  ctx.translate((W - radarSize) / 2, radarY - radarSize / 2)
  drawRadarChart(ctx, r.allIntervals, radarSize, { fontFamily: FONT_SERIF })
  ctx.restore()

  // ── 八维档位明细 ──
  drawDivider(ctx, W, 548)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = INK_3
  ctx.font = `500 13px ${FONT_SERIF}`
  ctx.fillText('八维档位', W / 2, 566)
  drawDimensionList(ctx, r.allIntervals, 40, 584, W - 80, FONT_SERIF)

  // ── 极档警告(朱砂) ──
  if (r.extremes.length > 0) {
    const exY = 740
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = INK_3
    ctx.font = `500 13px ${FONT_SERIF}`
    ctx.fillText('极档警告', 40, exY)
    const ex = r.extremes[0]!
    ctx.fillStyle = CINNABAR
    ctx.font = `600 13px ${FONT_SERIF}`
    ctx.fillText(ex.label, 130, exY)
    ctx.fillStyle = INK_2
    ctx.font = `400 11px ${FONT_SERIF}`
    ctx.fillText((ex.copy[0] || '').slice(0, 24), 40, exY + 20)
  }

  // ── 避雷指南 ──
  if (r.avoid) {
    const avY = 788
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = INK_3
    ctx.font = `500 13px ${FONT_SERIF}`
    ctx.fillText('避雷指南', 40, avY)
    ctx.fillStyle = INK
    ctx.font = `600 13px ${FONT_SERIF}`
    ctx.fillText(r.avoid.label, 130, avY)
    ctx.fillStyle = INK_2
    ctx.font = `400 11px ${FONT_SERIF}`
    const lines = wrapText(ctx, r.avoid.copy, W - 80)
    ctx.fillText((lines[0] || '').slice(0, 30), 40, avY + 20)
  }

  // ── 推荐菜 ──
  if (r.topDishes.length > 0) {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = INK_3
    ctx.font = `500 13px ${FONT_SERIF}`
    ctx.fillText('为你推荐', W / 2, 832)
    drawTopDishes(ctx, r.topDishes, 40, 852, W - 80, FONT_SERIF)
  }

  // ── footer(双线 + 毛笔标语) ──
  drawDivider(ctx, W, H - 110)
  ctx.strokeStyle = LINE
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(40, H - 104.5)
  ctx.lineTo(W - 40, H - 104.5)
  ctx.stroke()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = INK_3
  ctx.font = `400 11px ${FONT_SERIF}`
  ctx.fillText(`基于 ${data.questionCount} 道 · 八维味觉分析`, W / 2, H - 78)
  ctx.fillStyle = CINNABAR
  ctx.font = `400 17px ${FONT_BRUSH}`
  ctx.fillText('测 测 你 的 味 觉 灵 魂', W / 2, H - 50)
  ctx.fillStyle = INK_3
  ctx.font = `400 10px ${FONT_SERIF}`
  ctx.fillText('扫码或搜索「味觉灵魂」参与测试', W / 2, H - 28)
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
