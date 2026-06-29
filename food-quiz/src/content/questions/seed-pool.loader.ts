import poolJson from './seed-pool.json';
import { questionBank } from './questions.loader';
import { validateSeedPool, type SeedPool } from './seed-pool.schema';

// 加载期硬校验:id 必须在题库、8 维各 ≥3、无重复。坏形状直接抛错(开发期早失败)。
const validIds = new Set(questionBank.questions.map((q) => q.id));
validateSeedPool(poolJson, validIds);

export const seedPool: SeedPool = poolJson as SeedPool;
