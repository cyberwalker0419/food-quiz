import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SHARE_CARD_SIZE, downloadShareCard, getShareCardDataUrl, preloadShareCardFonts, drawShareCard } from './shareImage';
import type { ShareCardData } from './shareImage';
import type { AssembledResult, RenderedInterval } from '../lib/taste/result';
import { DIMS } from '../lib/taste/keys';
import type { Grade } from '../lib/taste/keys';

// ---------- 造测试数据 ----------
function makeInterval(letter: any, value: number, grade: Grade): RenderedInterval {
  return {
    letter, value, tierLabel: `${letter}-tier`, grade,
    label: `${letter}-label`, copy: `${letter}-copy`,
    index: 0, key: letter.toLowerCase(),
    isHigh: value > 60, isExtreme: value >= 90,
  };
}
function makeResult(): AssembledResult {
  return {
    allIntervals: DIMS.map((l, i) => makeInterval(l, 30 + i * 8, 'B')),
    intervals: DIMS.slice(0, 3).map((l, i) => makeInterval(l, 30 + i * 8, 'B')),
    tierLabels: { S: '', T: '', K: '', L: '', I: '', X: '', C: '', N: '' },
    topDishes: [
      { name: '麻婆豆腐', cuisine: '川菜', region: '四川', vector: { sour: 0, sweet: 0, bitter: 0, spicy: 0, salty: 0, rich: 0, crunchy: 0, tender: 0 } },
      { name: '小笼包', cuisine: '江浙菜', region: '上海', vector: { sour: 0, sweet: 0, bitter: 0, spicy: 0, salty: 0, rich: 0, crunchy: 0, tender: 0 } },
      { name: '北京烤鸭', cuisine: '京菜', region: '北京', vector: { sour: 0, sweet: 0, bitter: 0, spicy: 0, salty: 0, rich: 0, crunchy: 0, tender: 0 } },
    ],
    extremes: [], synergy: null, allround: null, avoid: null,
    vector: { sour: 0, sweet: 0, bitter: 0, spicy: 0, salty: 0, rich: 0, crunchy: 0, tender: 0 },
    raw: { sour: 0, sweet: 0, bitter: 0, spicy: 0, salty: 0, rich: 0, crunchy: 0, tender: 0 },
    std: 0,
  };
}
function makeData(): ShareCardData {
  return { result: makeResult(), questionCount: 30 };
}

// ---------- Mock Canvas 2D 上下文(纯函数,不依赖 jsdom) ----------
function createMockCtx(): any {
  const noop = () => {};
  const ctx: any = {};
  for (const m of [
    'clearRect', 'fillRect', 'strokeRect', 'fill', 'stroke',
    'beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'fillText',
    'save', 'restore', 'translate', 'scale', 'rotate', 'quadraticCurveTo',
    'measureText',
  ]) ctx[m] = vi.fn(noop);
  ctx.createLinearGradient = vi.fn(() => ({ addColorStop: vi.fn() }));
  ctx.createRadialGradient = vi.fn(() => ({ addColorStop: vi.fn() }));
  ctx.measureText.mockReturnValue({ width: 50 });
  ctx.font = '';
  ctx.fillStyle = '';
  ctx.strokeStyle = '';
  ctx.lineWidth = 1;
  ctx.textAlign = '';
  ctx.textBaseline = '';
  return ctx;
}

// ---------- Mock Canvas 元素(可在 node 环境运行) ----------
class MockCanvasElement {
  width = 0;
  height = 0;
  private ctx: any;
  toBlobCalls: Array<{ type?: string; quality?: number }> = [];
  toDataURLCalls: Array<{ type?: string; quality?: number }> = [];
  constructor() { this.ctx = createMockCtx(); }
  getContext(type: string) {
    if (type === '2d') return this.ctx;
    return null;
  }
  toBlob(cb: (b: Blob | null) => void, type?: string, quality?: number) {
    this.toBlobCalls.push({ type, quality });
    cb(new Blob(['x'], { type: type || 'image/png' }));
  }
  toDataURL(type?: string, quality?: number): string {
    this.toDataURLCalls.push({ type, quality });
    return `data:${type || 'image/png'};base64,mock`;
  }
}

describe('P6.4 shareImage 性能', () => {
  let mockDocument: any;
  let mockURL: any;
  let createdCanvases: MockCanvasElement[];
  let createdLinks: any[];

  beforeEach(() => {
    vi.resetModules();
    createdCanvases = [];
    createdLinks = [];
    mockURL = {
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    };
    (globalThis as any).URL = mockURL;
    (globalThis as any).Blob = class { constructor(parts: any[], _opts?: any) { return parts; } };

    mockDocument = {
      createElement: (tag: string) => {
        if (tag === 'canvas') {
          const c = new MockCanvasElement();
          createdCanvases.push(c);
          return c;
        }
        if (tag === 'a') {
          const link: any = {
            href: '', download: '', click: vi.fn(),
            _parent: null,
          };
          Object.defineProperty(link, 'parentNode', { value: null });
          createdLinks.push(link);
          return link;
        }
        return { appendChild: () => {}, removeChild: () => {}, click: vi.fn() };
      },
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
      fonts: {
        load: () => Promise.resolve(),
        ready: Promise.resolve(),
      },
    };
    (globalThis as any).document = mockDocument;
  });

  afterEach(() => {
    delete (globalThis as any).document;
    delete (globalThis as any).URL;
    delete (globalThis as any).Blob;
  });

  it('SHARE_CARD_SIZE = 540×960', () => {
    expect(SHARE_CARD_SIZE.width).toBe(540);
    expect(SHARE_CARD_SIZE.height).toBe(960);
  });

  it('540×960 比 720×1280 像素少 43%', () => {
    const old = 720 * 1280;
    const next = SHARE_CARD_SIZE.width * SHARE_CARD_SIZE.height;
    expect((old - next) / old).toBeGreaterThan(0.40);
  });

  it('downloadShareCard: canvas 540×960 + toBlob 用 image/jpeg 0.85', async () => {
    await downloadShareCard(makeData(), 'test.jpg');
    expect(createdCanvases.length).toBe(1);
    const c = createdCanvases[0]!;
    expect(c.width).toBe(540);
    expect(c.height).toBe(960);
    expect(c.toBlobCalls).toHaveLength(1);
    expect(c.toBlobCalls[0]!.type).toBe('image/jpeg');
    expect(c.toBlobCalls[0]!.quality).toBe(0.85);
  });

  it('downloadShareCard: 默认文件名以 .jpg 结尾', async () => {
    await downloadShareCard(makeData());
    expect(createdLinks.length).toBe(1);
    expect(createdLinks[0]!.download).toMatch(/\.jpg$/);
    expect(createdLinks[0]!.click).toHaveBeenCalled();
  });

  it('getShareCardDataUrl: canvas 540×960 + toDataURL 用 image/jpeg 0.85', async () => {
    const url = await getShareCardDataUrl(makeData());
    expect(url.startsWith('data:image/jpeg')).toBe(true);
    expect(createdCanvases.length).toBe(1);
    const c = createdCanvases[0]!;
    expect(c.width).toBe(540);
    expect(c.toDataURLCalls[0]!.type).toBe('image/jpeg');
    expect(c.toDataURLCalls[0]!.quality).toBe(0.85);
  });
});

describe('P7.2 顶层预加载入口', () => {
  it('preloadShareCardFonts 是 function 且不抛错', () => {
    expect(typeof preloadShareCardFonts).toBe('function');
    expect(() => preloadShareCardFonts()).not.toThrow();
  });
});

describe('P8.3 分享图文案补全', () => {
  let canvas: MockCanvasElement;
  let ctx: any;
  beforeEach(() => {
    canvas = new MockCanvasElement();
    canvas.width = 540;
    canvas.height = 960;
    ctx = canvas.getContext('2d');
  });

  it('drawShareCard 8 维档位明细含 8 个中文 + 8 个 grade 徽章 + 8 个 value', () => {
    drawShareCard(canvas as unknown as HTMLCanvasElement, makeData());
    const texts = ctx.fillText.mock.calls.map((c: any[]) => c[0]);
    const chinese = ['酸', '甜', '苦', '辣', '咸', '浓', '脆', '嫩'];
    for (const c of chinese) expect(texts).toContain(c);
    // grade='B' 各 8 次(8 维档位明细) + 雷达图 grade 徽章
    const bCount = texts.filter((s: string) => s === 'B').length;
    expect(bCount).toBeGreaterThanOrEqual(8);
    // value 数字 30..86 出现
    for (const v of [30, 38, 46, 54, 62, 70, 78, 86]) {
      expect(texts).toContain(String(v));
    }
  });

  it('drawShareCard 推荐菜 3 道以"🍴 菜名"形式出现', () => {
    drawShareCard(canvas as unknown as HTMLCanvasElement, makeData());
    const texts = ctx.fillText.mock.calls.map((c: any[]) => c[0]);
    const joined = texts.join('|');
    expect(joined).toContain('🍴 麻婆豆腐');
    expect(joined).toContain('🍴 小笼包');
    expect(joined).toContain('🍴 北京烤鸭');
    expect(texts).toContain('为你推荐');
  });

  it('drawShareCard 联动文案触发时 section 标题为"味觉共振"', () => {
    const data = makeData();
    data.result.synergy = {
      label: '辣味共鸣',
      copy: '辣与 X 联动',
      a: 'L', b: 'X', source: 'lx.json',
    };
    drawShareCard(canvas as unknown as HTMLCanvasElement, data);
    const texts = ctx.fillText.mock.calls.map((c: any[]) => c[0]);
    expect(texts).toContain('味觉共振');
    expect(texts).toContain('辣味共鸣');
  });

  it('drawShareCard 全能文案触发时 section 标题为"全能味觉"', () => {
    const data = makeData();
    data.result.allround = { label: '百味皆可', copy: '什么都能吃' };
    drawShareCard(canvas as unknown as HTMLCanvasElement, data);
    const texts = ctx.fillText.mock.calls.map((c: any[]) => c[0]);
    expect(texts).toContain('全能味觉');
  });

  it('drawShareCard 雷达图缩到 280(原 320)节省空间给 8 维明细', () => {
    drawShareCard(canvas as unknown as HTMLCanvasElement, makeData());
    const texts = ctx.fillText.mock.calls.map((c: any[]) => c[0]);
    expect(texts).toContain('8 维档位明细');
    expect(texts).toContain('🍽️ 测测你的味觉灵魂');
  });

  it('P9.x synergy.label 与 mainCopy y 坐标互斥 + mainCopy 不侵入雷达图区域', () => {
    // 替换 fillText mock 以记录 y 参数(默认 vi.fn(noop) 不记录)
    const textCalls: Array<{ text: string; y: number }> = [];
    ctx.fillText = vi.fn((text: string, _x: number, y: number) => {
      textCalls.push({ text, y });
    });

    const data = makeData();
    data.result.synergy = {
      label: '辣味共鸣',
      copy: '辣与 X 联动,你就是那个极端',
      a: 'L', b: 'X', source: 'lx.json',
    };
    drawShareCard(canvas as unknown as HTMLCanvasElement, data);

    const synCall = textCalls.find(c => c.text === '辣味共鸣');
    const mainCall = textCalls.find(c => c.text.includes('辣与'));
    expect(synCall).toBeDefined();
    expect(mainCall).toBeDefined();
    // P9.x v2: synergy.label y=198, mainCopy 起始 y=222(互斥),差 24
    expect(Math.abs(synCall!.y - mainCall!.y)).toBeGreaterThanOrEqual(20);
    // P9.x v2: mainCopy 第二行 y=222+16=238,雷达图区域顶端 y=260,留 22px
    // (radarChart 标签 "酸" 在 y≈cy-134=400-134=266,给 28px 间距)
    expect(mainCall!.y).toBeLessThan(250);
  });
});
