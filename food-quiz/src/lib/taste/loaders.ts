import type { DimensionVector } from './types';
import { letterToChinese } from './keys';

// Vite glob 批量加载所有文案(用 eager 模式同步拿到)
// loaders.ts 位于 src/lib/taste/，到 src/content/ 需两层 ../
const allJson = import.meta.glob<{ default: unknown }>('../../content/**/*.json', { eager: true });

// ===== 类型定义 =====

export interface IntervalEntry {
  index: number;
  key: string;
  label: string;
  copy: string;
}

export interface ExtremeEntry {
  dim: string;
  letter: string;
  label: string;
  threshold: number;
  copy: string[];
}

export interface SynergyEntry {
  pair?: [string, string];
  letters?: [string, string];
  label: string;
  copy: string[] | string;
  template?: string;
}

export interface AllroundIndex {
  module: 'allround';
  id: '_index';
  ids: string[];
}

export interface AllroundEntry {
  id: string;
  label: string;
  copy: string[];
}

export interface AvoidIndex {
  module: 'avoid';
  id: '_index';
  ids: string[];
}

export interface AvoidEntry {
  letter: string;
  dim: string;
  label: string;
  threshold: number;
  copy: string[];
}

export interface DishEntry {
  name: string;
  cuisine: string;
  region: string;
  vector: DimensionVector;
  /** 是否日常/知名菜（true=推荐/题库/随机菜可用；false=冷门地方菜，仅入库） */
  popular?: boolean;
}

// ===== 工具 =====

/**
 * 从 allJson 拿到指定 suffix 路径对应的 default。
 * 容错:无匹配 / 取不到 → null。
 */
function get(suffix: string): unknown {
  const key = Object.keys(allJson).find((k) => k.endsWith(suffix));
  if (!key) return null;
  const mod = allJson[key];
  return mod?.default ?? null;
}

// ===== loaders(master plan P3 §三 表格) =====

/**
 * 256 条区间文案:按 index(0..255)→ IntervalEntry | null。
 * - 缺文件 / 形状坏 → null(渲染端走兜底)。
 */
export function loadInterval(index: number): IntervalEntry | null {
  if (!Number.isInteger(index) || index < 0 || index > 255) return null;
  const path = `/intervals/${String(index).padStart(3, '0')}.json`;
  const raw = get(path);
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as IntervalEntry;
  if (typeof e.copy !== 'string' || typeof e.label !== 'string' || typeof e.key !== 'string') return null;
  return e;
}

/** 8 维极档:按 dim 字母小写 → ExtremeEntry | null */
export function loadExtreme(letter: string): ExtremeEntry | null {
  const raw = get(`/extreme/${letter}.json`);
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as ExtremeEntry;
  if (!Array.isArray(e.copy) || typeof e.label !== 'string') return null;
  return e;
}

/**
 * 联动文案:按 (a, b) 字母对字典序 → SynergyEntry。
 * - 命中具体文件 → 用该文件的 copy
 * - 未命中 → 走 _fallback.json 模板(替换 {a} {b} 为中文名)
 * - 仍未命中 → 硬编码兜底
 *
 * 字母防御:`letterToChinese` 抛错时回退到字母本身,不向调用方冒泡。
 */
function safeChinese(letter: string): string {
  try {
    return letterToChinese(letter as never);
  } catch {
    return letter.toUpperCase();
  }
}

export function loadSynergy(a: string, b: string): SynergyEntry {
  const key = [a, b].sort().join('-').toLowerCase();
  const raw = get(`/synergies/${key}.json`);
  if (raw && typeof raw === 'object' && Array.isArray((raw as SynergyEntry).copy)) {
    return raw as SynergyEntry;
  }
  const fb = get('/synergies/_fallback.json');
  if (fb && typeof fb === 'object') {
    return fb as SynergyEntry;
  }
  return {
    label: '强强联合',
    copy: [
      `你最强的两个维度正在组队:${safeChinese(a)} 与 ${safeChinese(b)}`,
    ],
  };
}

/**
 * 全能文案:从 _index.json 随机抽一条。
 * - 缺文件 → null(不触发全能分支)。
 */
export function loadAllround(): AllroundEntry | null {
  const idx = get('/allround/_index.json') as AllroundIndex | null;
  if (!idx || !Array.isArray(idx.ids) || idx.ids.length === 0) return null;
  const id = idx.ids[Math.floor(Math.random() * idx.ids.length)]!;
  const raw = get(`/allround/${id}.json`);
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as AllroundEntry;
  if (!Array.isArray(e.copy) || typeof e.label !== 'string') return null;
  return e;
}

/** 避雷文案:按 dim 字母小写 → AvoidEntry | null */
export function loadAvoid(letter: string): AvoidEntry | null {
  const raw = get(`/avoid/${letter}.json`);
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as AvoidEntry;
  if (!Array.isArray(e.copy) || typeof e.label !== 'string') return null;
  return e;
}

/**
 * 菜品数据:仅 Phase 5 落盘后才有;缺失返回 null。
 * 注:本 PR 范围内 dishes.json 不存在,loadDishes() 永远返回 null。
 */
export function loadDishes(): DishEntry[] | null {
  const raw = get('/dishes.json');
  if (!Array.isArray(raw)) return null;
  return raw as DishEntry[];
}
