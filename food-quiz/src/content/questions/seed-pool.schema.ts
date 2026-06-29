import type { TasteDimension } from '../../lib/taste/types';

const DIMS: readonly TasteDimension[] = [
  'sour', 'sweet', 'temperature', 'spicy', 'salty', 'rich', 'crunchy', 'tender',
] as const;

export interface SeedPool {
  version: number;
  slots: Record<TasteDimension, string[]>;
}

/** 校验 seed pool:8 维各 ≥3 题、id 真实(在题库)、无重复。失败抛 Error(加载期硬失败)。 */
export function validateSeedPool(
  data: unknown,
  validIds: ReadonlySet<string>,
): asserts data is SeedPool {
  if (typeof data !== 'object' || data === null) throw new Error('SeedPool must be an object');
  const p = data as SeedPool;
  if (typeof p.version !== 'number') throw new Error('SeedPool.version must be a number');
  if (typeof p.slots !== 'object' || p.slots === null) throw new Error('SeedPool.slots must be an object');
  const seen = new Set<string>();
  for (const d of DIMS) {
    const arr = (p.slots as Record<string, unknown>)[d];
    if (!Array.isArray(arr)) throw new Error(`slots.${d} must be an array`);
    if (arr.length < 3) throw new Error(`slots.${d} must have >=3 entries (got ${arr.length})`);
    for (const id of arr) {
      if (typeof id !== 'string') throw new Error(`slots.${d} has non-string id`);
      if (!validIds.has(id)) throw new Error(`seed-pool unknown id (not in questionBank): ${id}`);
      if (seen.has(id)) throw new Error(`seed-pool duplicate id: ${id}`);
      seen.add(id);
    }
  }
}
