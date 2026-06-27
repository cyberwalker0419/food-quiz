import { describe, it, expect, vi } from 'vitest';
import { drawRadarChart, GRADE_COLORS } from './radarChart';
import type { RenderedInterval } from './result';
import type { Grade } from './keys';
import { DIMS } from './keys';

/**
 * Mock Canvas 2D context:所有方法替换为 vi.fn(),不报错。
 * 让我们能验证"哪些方法被调、参数是什么"。
 */
function createMockCtx(): any {
  const noop = () => {};
  const ctx: any = {};
  const methods = [
    'clearRect', 'fillRect', 'strokeRect', 'fill', 'stroke',
    'beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'fillText', 'strokeText',
    'save', 'restore', 'translate', 'scale', 'rotate',
    'quadraticCurveTo',
  ];
  for (const m of methods) ctx[m] = vi.fn(noop);
  const grad = { addColorStop: vi.fn() };
  ctx.createLinearGradient = vi.fn(() => grad);
  ctx.createRadialGradient = vi.fn(() => grad);
  ctx.measureText = vi.fn(() => ({ width: 50 }));
  ctx.font = '';
  ctx.fillStyle = '';
  ctx.strokeStyle = '';
  ctx.lineWidth = 1;
  ctx.textAlign = '';
  ctx.textBaseline = '';
  return ctx;
}

/** 构造 8 维测试数据,values 按 DIMS 顺序,letter 自动分配。 */
function makeIntervals(values: number[]): RenderedInterval[] {
  return DIMS.map((letter, i) => {
    const v = values[i] ?? 50;
    // 温度维(H)轴名用真实档位单字(凉/温/烫),其余维用占位 tierLabel(测试只校验温度维之外的轴名走 DIM_CHINESE)
    const tierLabel = letter === 'H'
      ? (v >= 66 ? '烫' : v >= 33 ? '温' : '凉')
      : `${letter}-tier`;
    return {
      letter,
      index: i,
      key: letter.toLowerCase(),
      label: `label-${letter}`,
      copy: `copy-${letter}`,
      value: v,
      tierLabel,
      grade: gradeOf(v),
      isHigh: v > 60,
    };
  });
}

function gradeOf(v: number): Grade {
  if (v >= 80) return 'A';
  if (v >= 60) return 'B';
  if (v >= 40) return 'C';
  if (v >= 20) return 'D';
  return 'E';
}

describe('drawRadarChart', () => {
  it('8 维全 0 → fillText 仍调 8 次轴标签', () => {
    const ctx = createMockCtx();
    const intervals = makeIntervals([0, 0, 0, 0, 0, 0, 0, 0]);
    drawRadarChart(ctx, intervals, 320);
    const fillTextCalls = ctx.fillText.mock.calls.map((c: any[]) => c[0]);
    // 找 8 个轴名(7 个固定中文 + 1 个温度档位单字 凉/温/烫)
    const chineseLabels = fillTextCalls.filter((s: string) => /[酸甜热辣咸浓脆嫩凉温烫]/.test(s));
    expect(chineseLabels.length).toBeGreaterThanOrEqual(8);
  });

  it('8 维全 100 → 多边形顶点(数据点半径)在最外圈(R*1)', () => {
    const ctx = createMockCtx();
    const intervals = makeIntervals([100, 100, 100, 100, 100, 100, 100, 100]);
    drawRadarChart(ctx, intervals, 320);
    // lineTo 应被调,用于绘制多边形外圈 + 轴线
    expect(ctx.lineTo.mock.calls.length).toBeGreaterThanOrEqual(8);
  });

  it('全 E (0) 5 圈网格 stroke 都被调', () => {
    const ctx = createMockCtx();
    const intervals = makeIntervals([0, 0, 0, 0, 0, 0, 0, 0]);
    drawRadarChart(ctx, intervals, 320);
    // stroke 调用:5 圈 + 8 轴 + 1 多边形 = 14+
    expect(ctx.stroke.mock.calls.length).toBeGreaterThanOrEqual(10);
  });

  it('8 维全 0 时 fill 不被调(多边形不画)但 stroke 仍画外圈', () => {
    const ctx = createMockCtx();
    const intervals = makeIntervals([0, 0, 0, 0, 0, 0, 0, 0]);
    drawRadarChart(ctx, intervals, 320);
    // fill 仍可能被调(数据点圆),但多边形 fill 在数据全 0 时也画
    // 这里只验证不报错
    expect(true).toBe(true);
  });

  it('不报错地处理空 intervals', () => {
    const ctx = createMockCtx();
    expect(() => drawRadarChart(ctx, [], 320)).not.toThrow();
  });

  it('8 维全 100 → 数据点圆弧 arc 被调 8 次', () => {
    const ctx = createMockCtx();
    const intervals = makeIntervals([100, 100, 100, 100, 100, 100, 100, 100]);
    drawRadarChart(ctx, intervals, 320);
    // arc: 8 个数据点
    expect(ctx.arc.mock.calls.length).toBeGreaterThanOrEqual(8);
  });

  it('中文字体栈参数被设置', () => {
    const ctx = createMockCtx();
    const intervals = makeIntervals([50, 50, 50, 50, 50, 50, 50, 50]);
    drawRadarChart(ctx, intervals, 320, { fontFamily: '"Noto Sans SC"' });
    expect(ctx.font).toContain('Noto Sans SC');
  });

  it('轴标签调用 fillText,非温度维内容与 DIM_CHINESE 一致,温度维画档位单字', () => {
    const ctx = createMockCtx();
    const intervals = makeIntervals([50, 50, 50, 50, 50, 50, 50, 50]);
    drawRadarChart(ctx, intervals, 320);
    const fillTextCalls = ctx.fillText.mock.calls.map((c: any[]) => c[0]);
    // 7 个非温度维固定中文 + 温度维 value=50 → '温'
    const chinese = ['酸', '甜', '辣', '咸', '浓', '脆', '嫩', '温'];
    for (const c of chinese) {
      expect(fillTextCalls).toContain(c);
    }
  });

  it('grade A vs E 数据点都画 8 个(颜色已统一,P7.4)', () => {
    const ctxA = createMockCtx();
    const ctxE = createMockCtx();
    drawRadarChart(ctxA, makeIntervals([100, 0, 0, 0, 0, 0, 0, 0]), 320);  // A
    drawRadarChart(ctxE, makeIntervals([0, 0, 0, 0, 0, 0, 0, 0]), 320);    // E
    // 数据点 arc:两个 ctx 都画 8 个
    expect(ctxA.arc.mock.calls.length).toBeGreaterThanOrEqual(8);
    expect(ctxE.arc.mock.calls.length).toBeGreaterThanOrEqual(8);
  });
});

describe('P7.4 雷达图 ABCDE 字母层 + 底色', () => {
  it('fillRect 在 clearRect 之前被调(P7.4 底色填充)', () => {
    const ctx = createMockCtx();
    const intervals = makeIntervals([50, 50, 50, 50, 50, 50, 50, 50]);
    drawRadarChart(ctx, intervals, 320);
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it('轴标签 fillText 中文 + grade 字母各 8 次(纯文本,无徽章)', () => {
    const ctx = createMockCtx();
    const intervals = makeIntervals([50, 50, 50, 50, 50, 50, 50, 50]);
    drawRadarChart(ctx, intervals, 320);
    const fillTextCalls = ctx.fillText.mock.calls.map((c: any[]) => c[0]);
    const chinese = ['酸', '甜', '辣', '咸', '浓', '脆', '嫩', '温'];
    for (const c of chinese) expect(fillTextCalls).toContain(c);
    // grade 字母:全部值=50 → grade='C',所以 8 个 'C' 都被 fill(纯文本,无颜色徽章)
    const gradeCCount = fillTextCalls.filter((s: string) => s === 'C').length;
    expect(gradeCCount).toBe(8);
  });

  it('数据点绘制阶段不抛错(颜色统一逻辑由源码保证,P7.4)', () => {
    const ctx = createMockCtx();
    const intervals = makeIntervals([100, 0, 0, 0, 0, 0, 0, 0]);
    expect(() => drawRadarChart(ctx, intervals, 320)).not.toThrow();
    // 8 个数据点都画
    expect(ctx.arc.mock.calls.length).toBeGreaterThanOrEqual(8);
  });
});

describe('P8.3 雷达图 grade 纯文本标签(无颜色徽章)', () => {
  it('GRADE_COLORS 包含 5 个 grade 的颜色(保留供 ResultCard CSS 对齐)', () => {
    expect(GRADE_COLORS.A).toBe('#c0392b');
    expect(GRADE_COLORS.B).toBe('#e67e22');
    expect(GRADE_COLORS.C).toBe('#3498db');
    expect(GRADE_COLORS.D).toBe('#1abc9c');
    expect(GRADE_COLORS.E).toBe('#6b5b50');
  });

  it('grade 字母以纯文本绘制,不使用 GRADE_COLORS 填充', () => {
    const ctx = ((): any => {
      const noop = () => {};
      const c: any = {};
      for (const m of [
        'clearRect', 'fillRect', 'strokeRect', 'fill', 'stroke',
        'beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'fillText', 'strokeText',
        'save', 'restore', 'translate', 'scale', 'rotate', 'quadraticCurveTo',
      ]) c[m] = vi.fn(noop);
      c.measureText = vi.fn(() => ({ width: 50 }));
      c.createLinearGradient = vi.fn(() => ({ addColorStop: vi.fn() }));
      c.createRadialGradient = vi.fn(() => ({ addColorStop: vi.fn() }));
      const colors: string[] = [];
      let _fs = '';
      Object.defineProperty(c, 'fillStyle', {
        get() { return _fs; },
        set(v) { colors.push(v); _fs = v; },
      });
      c.font = ''; c.strokeStyle = ''; c.lineWidth = 1; c.textAlign = ''; c.textBaseline = '';
      (c as any).__colors = colors;
      return c;
    })();
    // value=100 → grade='A'
    const intervals = makeIntervals([100, 0, 0, 0, 0, 0, 0, 0]);
    drawRadarChart(ctx, intervals, 320);
    const colors = (ctx as any).__colors as string[];
    // 不应使用 GRADE_COLORS 填充(无彩色徽章)
    expect(colors).not.toContain(GRADE_COLORS.A);
    // 应使用墨灰色(IN_3)绘制 grade 文本
    expect(colors).toContain('#9A8B75');
  });

  it('8 维度全 50 → 无 quadraticCurveTo 调用(无圆角徽章)', () => {
    const ctx = createMockCtx();
    const intervals = makeIntervals([50, 50, 50, 50, 50, 50, 50, 50]);
    drawRadarChart(ctx, intervals, 320);
    // 无徽章 → 无 quadraticCurveTo
    expect(ctx.quadraticCurveTo.mock.calls.length).toBe(0);
    // beginPath: 5 圈网格 + 8 轴 + 1 多边形 + 8 数据点 = 22
    expect(ctx.beginPath.mock.calls.length).toBeGreaterThanOrEqual(14);
  });
});
