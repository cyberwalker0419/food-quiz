import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SHARE_CARD_SIZE, downloadShareCard, getShareCardDataUrl } from './shareImage';
import type { ShareCardData } from './shareImage';
import type { AssembledResult, RenderedInterval } from '../lib/taste/result';
import { DIMS } from '../lib/taste/keys';
import type { Grade } from '../lib/taste/keys';

// ---------- 工具:造测试数据 ----------
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
    topDishes: [], extremes: [], synergy: null, allround: null, avoid: null,
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
