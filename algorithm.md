# 算法说明 · 味觉灵魂测试

> 本文档详细描述「味觉灵魂测试」当前的算法实现。所有描述均与代码 1:1 对齐，行号引用以 `caf4a91` / `e8ffcdf` 提交后的状态为准。

## 0. 三层架构概览

应用把"做完 60 道题 → 推出最匹配的菜系"拆成三个相对独立的算法层：

```
┌─────────────────────────────────────────────────────────────────┐
│  1. 结果评估层（Result Ranking Layer）                          │
│     App.tsx:42-87                                                 │
│     输入：用户答案 → 8 维口味向量 → 22 道菜系排序              │
│     输出：主结果 + 3 个副推荐                                    │
├─────────────────────────────────────────────────────────────────┤
│  2. 动态出题层（Adaptive Selector Layer）                       │
│     adaptiveQuiz.ts:74-192 + App.tsx:155-237                     │
│     输入：当前答案轨迹 + 已出题序号 + seed                      │
│     输出：下一道题                                              │
├─────────────────────────────────────────────────────────────────┤
│  3. 题库调度层（Pool Scheduler Layer）                          │
│     App.tsx:110-153, 138-153, 96-97                              │
│     输入：mode (quick|full) + seed                               │
│     输出：本场要展示的题目序列（30 或 60 道）                    │
└─────────────────────────────────────────────────────────────────┘
```

底层数据是 8 维口味向量 `FlavorProfile`（[cuisines.ts:1-10](food-quiz/src/data/cuisines.ts)）和题库 151 道 `Question`（[questions.ts](food-quiz/src/data/questions.ts)）。

---

## 1. 结果评估层（Result Ranking）

### 1.1 八维向量

每道菜系用 8 个标量描述其"口味形状"：

| Key | 含义 | 取值范围（观测） |
| --- | --- | --- |
| `spicy` | 辣度 | 1..9 |
| `umami` | 鲜度 | 5..10 |
| `sweet` | 甜度 | 1..8 |
| `sour` | 酸度 | 2..8 |
| `crunchy` | 脆度 | 2..7 |
| `tender` | 嫩度 | 4..9 |
| `intense` | 浓烈度 | 2..9 |
| `light` | 清淡度 | 1..9 |

`intense` 与 `light` **设计上互为对照**（不强制互斥）：粤菜 `light=9, intense=2`；川菜 `intense=9, light=1`；藏菜则两者都温和（`intense=4, light=4`）。负值仅出现在 `options.flavors` 中（用户答案），表示"用户对 X 排斥"。

### 1.2 用户口味向量聚合

实现：[App.tsx:20-36](food-quiz/src/App.tsx)（结果评估用，与选题器中的 `aggregateProfile` 平行存在，行为一致但调用入口不同——这是有意分开的，见 § 1.5）。

```
profile[k] = Σ (option.flavors[k] × weight[question]) / Σ weight[question]
```

| 步骤 | 说明 |
| --- | --- |
| 1. 遍历 `answers` | 每条 (questionId, optionIndex) |
| 2. 取该题的选项 | `opt = question.options[optionIndex]` |
| 3. 加权累加 | 8 维向量逐维累加 `opt.flavors[k] × q.weight` |
| 4. 归一化 | 除以 `Σ q.weight`（缺省 `weight=1`） |

**为什么用加权平均而不是 sum？** `weight` 在题库里主要给 `final` 类题加 2x 权重，sum 会让"答了哪些 final 题"影响 profile 绝对值；用平均让所有用户的 profile 处于同一量级（≈ 选项 flavor 分数的量级，约 `-3..5`）。

### 1.3 菜系相似度：Pearson 中心化余弦

实现：[App.tsx:42-56](food-quiz/src/App.tsx)

```
similarity(user, cuisine) = Σ (a_i - ā)(b_i - b̄) / √(Σ (a_i - ā)² · Σ (b_i - b̄)²)
```

- `ā`、`b̄` 分别为 user / cuisine 的 8 维均值
- `denom < 1e-9` 时返回 0（避免 0/0，对应"绝对中性"profile）
- 输出范围 `[-1, +1]`，单调不缩放到 [0,1]

**为什么不是欧氏距离？** 欧氏距离在 8 维上对**小幅度偏好**的区分力差。例如用户答完 profile ≈ `{0, 0.5, 0, 0, 0, 0, 0, 0.3}`，欧氏距离会让"平坦的藏菜 / 蒙古菜"被拉近，因为它们的 profile 各维度都接近 b̄。Pearson 把"形状"而不是"绝对值"做对比，能识别"我爱清淡但其他都无所谓"和"我爱辣且爱鲜"这种方向性差异。

### 1.4 排序与副推荐

实现：[App.tsx:60-87](food-quiz/src/App.tsx)

```
rankCuisines()                → cuisines.map(similarity).sort(score desc)
calculateResults()            → ranked[0]
getSecondaryResults()         → ranked[1..3]，跳过与主结果同名者
```

**主结果** = 相似度最高的菜系。
**副结果** = 排名 2~4 中与主结果不同名者（最多 3 个）。

**已知缺陷**（无代码修复，记录于 README）：
- 藏菜 / 徽菜 / 新疆菜 / 蒙古菜 profile 较平，Pearson 中心化后接近 0 相似度，偶尔因 `Math.random()`（initial seed）推上首位。尚未加 cuisine profile 偏置项。
- Pearson 接近 0 的两个菜系**互不可比**：分数都是噪声，无法判断哪个更"对"。

### 1.5 与选题器中 `aggregateProfile` 的关系

`App.tsx:20-36` 的 `aggregate()` 和 `adaptiveQuiz.ts:45-68` 的 `aggregateProfile()` **算法完全等价**（都做加权平均），但：

| 维度 | `App.tsx::aggregate` | `adaptiveQuiz.ts::aggregateProfile` |
| --- | --- | --- |
| 入口 | 结果页（全部答案） | 选题器（增量答案） |
| 静态类型 | `FlavorProfile`（cuisines.ts） | `Profile`（adaptiveQuiz.ts） |
| 调用方 | `rankCuisines` / `calculateResults` | `pickNextQuestion::followUpScore` |

两者没有互相调用，是**重复实现**。原因：① 结果评估层和出题层是两条独立链路；② 跨文件类型共享会引入循环 import。理论上可以合并，但当前 ROI 不高。

---

## 2. 动态出题层（Adaptive Selector）

入口：[adaptiveQuiz.ts:131-192 `pickNextQuestion`](food-quiz/src/utils/adaptiveQuiz.ts) + [App.tsx:155-237 `answerQuestion`](food-quiz/src/App.tsx)

### 2.1 三段式选题策略

根据 `currentStep` 在序列中的位置，逻辑分为三段：

```
                          totalSteps
        ┌─────────────────┴─────────────────┐
   早期: [0, max(3, 0.25·totalSteps))   ← 纯随机（探索）
   中期: [max(3, 0.25·totalSteps), totalSteps-3)  ← 加权评分（深挖）
   末期: [totalSteps-3, totalSteps]      ← 强制 final 类（决胜）
```

| 段 | 触发条件 | 实现 |
| --- | --- | --- |
| **早期** | `currentStep < max(3, ⌊totalSteps × 0.25⌋)` | `remaining[floor(rand() × n)]` 纯随机 |
| **末期** | `currentStep >= totalSteps - 3` | 优先返回 `weight >= 2` 的 `final` 类题 |
| **中期** | 其他 | 评分排序 + Top-5 加权抽样 |

数值例子（精简版 30 题）：早期 = step 0..7（8 道），末期 = step 27..29（3 道），中期 = step 8..26（19 道）。完整版 60 题：早期 0..14，末期 57..59，中期 15..56。

### 2.2 评分函数

实现：[adaptiveQuiz.ts:86-121 `followUpScore`](food-quiz/src/utils/adaptiveQuiz.ts)

```
score = trigger_bonus + coverage_bonus + random_noise
       (0..16)         (0..5)         (0..10)
```

#### 2.2.1 触发器匹配（trigger，权重 8 / 3）

题库中部分题带 `tags.triggers: { spicy: 2, light: 1, ... }` 标签。语义是"当用户在某维度上 profile 强度 ≥ 阈值时，这道题应该被触发出场"。

| 条件 | 加分 |
| --- | --- |
| `|profile[k]| >= threshold` | +8 |
| `|profile[k]| >= 0.6 × threshold` | +3（"接近触发"弱命中） |
| 其他 | 0 |

阈值典型值 1~2。一个题可同时挂多个 trigger，**累加**（如 `{spicy: 2, umami: 2}` 全部命中可加 16 分）。

#### 2.2.2 类别覆盖奖励（coverage，权重 5 / 2）

防止中后期隧道式出题（一直出 daily 不出 adventure）。统计本场已出过的 category 频次：

| 已出同 category 次数 | 加分 |
| --- | --- |
| 0（未出过） | +5 |
| 1 | +2 |
| ≥ 2 | 0 |

这是**软约束**，不强制均衡。题库 10 个 category 中 `sensory`(5)、`texture`(3) 题量本身就少，覆盖奖励会反复把它们顶上来。

#### 2.2.3 随机噪声（noise，权重 0..10）

`score += rand() × 10`，其中 `rand` 是 seed 化的 mulberry32。**故意大于某些 trigger** —— 5 道随机叠加（每道 0..10）期望 25 分，足够覆盖单个 trigger 的 8 分。

设计意图：避免"同样 profile 永远出同样题"。同一 seed 同一答案轨迹应该产生同一序列；不同 seed 或不同答案轨迹会显著分叉。

### 2.3 Top-K 加权抽样

实现：[adaptiveQuiz.ts:175-191](food-quiz/src/utils/adaptiveQuiz.ts)

```
scored.sort(score desc)
topK  = scored[0..5]
weights = [0.34, 0.24, 0.18, 0.14, 0.10]   // 累进式分布
return weighted_sample(topK, weights, rand())
```

**为什么是 Top-5 加权而不是直接取 Top-1？** 取 Top-1 会在两个相似度接近的题之间永远选 A，体验上"似乎算法在偏袒"。Top-5 加权让 Top-1 出现概率 34%、Top-2 出现概率 24%…… 既保证"大部分时候出对的"，又保留 6% 概率给 Top-5。

权重分布是**轻微偏向高分**（不是 [0.2, 0.2, 0.2, 0.2, 0.2] 均匀）。如果想更激进偏向，权重可改 `[0.6, 0.3, 0.1, 0, 0]`（即 README § 一·4.1 中提到的方案）—— **当前没采用**，因为均匀 5 项会让 trigger 完全失效。

### 2.4 强制 final 段

实现：[adaptiveQuiz.ts:163-166](food-quiz/src/utils/adaptiveQuiz.ts)

```
if (currentStep >= totalSteps - 3) {
  return remaining.find(q => q.category === 'final' && q.weight >= 2)
}
```

末期 3 道强制从 `final` 类（"终极对决"题，`weight=2`）里取。这是**硬约束**，覆盖随机噪声。设计动机：决胜题承担"拍板"功能，触发器和分数都是噪声，必须锁住。

注意：这一段只找**第一道**匹配的 final 题。如果本场 final 类题用完（极少情况），就 fall through 到中期的评分逻辑。

### 2.5 自适应重排（Re-roll）

实现：[App.tsx:155-237 `answerQuestion`](food-quiz/src/App.tsx) + `_rerolled` 标志

每答完一题，App 会：

1. 把新答案 push 到 `answers`
2. 调用 `pickNextQuestion` 选下一题
3. **如果新选的题 ≠ 计划中下一题**，替换 `selectedQuestions[currentStep+1]`
4. 标记 `{...nextQ, _rerolled: true}` 防再次重排

这是"上一题"功能（见 [App.tsx:221-237 `goToPreviousQuestion`](food-quiz/src/App.tsx)）的代价：用户从第 N 题回退到第 N-1 题改答案后，第 N 题不会被重新自适应，因为 `_rerolled` 标记为 true。UX 上"我改完答案感觉后续没变化"是已知副作用。

---

## 3. 题库调度层（Pool Scheduler）

### 3.1 两套池

[questions.ts](food-quiz/src/data/questions.ts) 导出两个常量：

| 名称 | 大小 | 选择策略 | 模式 |
| --- | --- | --- | --- |
| `quickQuestions` | 30 | 手挑，跨 category 平衡 | 精简版（`version: 'quick'`） |
| `questions` | 121 | 全部 `version: 'full'` 题 | 完整版 |

实际 `version: 'quick'` 19 题 + `version: 'full'` 132 题 = 151 题；`quickQuestions` 是手挑的 30 道子集。

### 3.2 序列构建

实现：[App.tsx:110-136 `buildSequence`](food-quiz/src/App.tsx) + [App.tsx:138-153 `startQuiz`](food-quiz/src/App.tsx)

```
1. 新 seed（基于 Math.random()，见 README § 已知限制）
2. 第一题：从 'daily' 桶纯随机，seed 化 mulberry32
3. 第 2..N 题：调 pickNextQuestion（profile 为空）
```

`buildSequence` 在 `startQuiz` 中调用一次，**不随用户答题更新**（除了 § 2.5 的单步重排）。这意味着题库调度层是"前向一次性"的：30/60 道题骨架在开始时已确定。

### 3.3 与 § 2 的耦合点

```
buildSequence  调  pickNextQuestion(seed, answers=[])     ← 用空答案
answerQuestion 调  pickNextQuestion(seed, answers=真实)   ← 用真实答案
```

两者**共用** `pickNextQuestion`，区别仅在 `answers` 是否为空。空答案场景下 `profile = {0,0,...,0}`，所有 trigger 不命中（`|0| < threshold`），coverage 加成起主导，noise 决定具体题。这也是为什么早期（early phase）直接返回 `remaining[rand × n]` 而不是评分：空答案时评分函数退化成"完全靠 noise"，与早期纯随机等价。

### 3.4 seed 的真实作用

实现：[adaptiveQuiz.ts:18-39 `mulberry32` / `rng`](food-quiz/src/utils/adaptiveQuiz.ts) + [App.tsx:116](food-quiz/src/App.tsx)

| 路径 | seed 作用 |
| --- | --- |
| `pickNextQuestion` 的 `noise` 项 | ✅ 决定 Top-K 抽样、最终选题 |
| `pickNextQuestion` 的 `coverage` 项 | 不涉及随机 |
| `pickNextQuestion` 的 `trigger` 项 | 不涉及随机 |
| `App.tsx:104, 140, 324` 的 `Math.random()` | ❌ 不受 seed 控制 |
| `adaptiveQuiz.ts:36` 的 fallback seed | ❌ fallback 时用 `Date.now() ^ Math.random()` |

**结论**：seed 控制"同样答案序列会不会产生同样题目序列"，但**不控制**初始 seed 值本身、计算屏文案、PRNG fallback 路径。这 4 处 `Math.random()` 残留是 README § 已知限制 #1。

---

## 4. 端到端示例

完整跑一遍"精简版 30 题，user 选清淡粤菜风格"：

### 阶段 1: startQuiz

```
seed = 42              // Math.random() 一次性（未受控）
pool = quickQuestions  // 30 道
buildSequence(pool, 30):
  step 0: 从 'daily' 桶纯随机（mulberry32(42)）→ 题 12
  step 1: pickNextQuestion(seed=42, answers=[]) → 早期纯随机 → 题 7
  step 2: 同上 → 题 23
  ... 早期 8 道完成（step 0..7）
  step 8: 进入中期，pickNextQuestion 调 followUpScore
  step 27: 进入末期，强制 final 类
  step 29: 返回 30 道题
```

### 阶段 2: 用户答完第 1 道（假设选 "清蒸鱼"）

```
answers = [{ questionId: 12, optionIndex: 1 }]
profile = aggregate → { umami: 4, tender: 3, light: 3, intense: -1, ... }
answerQuestion:
  1. newAnswers = [...answers, {12, 1}]
  2. pickNextQuestion(pool, newAnswers, usedIds, {step: 1, total: 30, seed: 42})
  3. followUpScore for each remaining:
     - 题 5 triggers.umami=2, |profile.umami|=4 ≥ 2 → +8
     - 题 5 coverage['daily']=1 → +2
     - 题 5 noise ≈ 0.3 × 10 = 3
     - 总分 ≈ 13
  4. Top-5 排序后加权抽样 → 题 5（海鲜偏好题）
  5. _rerolled 标记 → true
  6. setCurrentQuestionIndex(1)
```

### 阶段 3: 答完所有 30 题

```
answers.length === 30
→ setPhase('calculating')
→ 1.5s 后调 calculateResults
   1. profile = aggregate(selectedQuestions, answers)  // 8 维加权平均
   2. ranked = cuisines.map(similarity).sort(desc)
   3. mainResult = ranked[0]   // 假设 = 粤菜（相似度 0.85）
   4. secondary = ranked[1..3] // 假设 = 浙菜、闽菜、潮汕菜
→ setPhase('result')
```

### 阶段 4: 结果页

```
- 8 维 profile bars（result.profile）
- 性格标签
- 代表菜品（5 道）
- 副推荐 3 个
- 分享卡（downloadShareCard）
```

---

## 5. 算法复杂度

| 操作 | 时间复杂度 | 空间复杂度 |
| --- | --- | --- |
| `aggregate` | O(N) N=已答题数 | O(1) |
| `aggregateProfile` | O(N) | O(1) |
| `similarity` | O(8) 常数 | O(1) |
| `rankCuisines` | O(22 × 8 + 22 log 22) ≈ O(22) | O(22) |
| `pickNextQuestion` | O(M) M=池大小（filter + map + sort） | O(M) |
| `buildSequence` | O(L × M) L=目标题数 | O(M) |
| `answerQuestion` | O(M) | O(M) |
| **完整跑 60 题** | O(60 × 132) ≈ **8,000 次操作** | O(132) |

实测：60 题完整版，笔记本电脑 < 100ms 完成全部计算，包括 1.5s `calculating` phase 等待动画。

---

## 6. 已知算法缺陷

| # | 位置 | 缺陷 | 触发条件 | 当前缓解 |
| --- | --- | --- | --- | --- |
| 1 | [App.tsx:42-56](food-quiz/src/App.tsx) | 相似度 0 的平坦 cuisine（藏菜 / 蒙古菜）排名无意义 | 8 维 profile 接近 0 | 无 |
| 2 | [adaptiveQuiz.ts:74-80](food-quiz/src/utils/adaptiveQuiz.ts) | `dominantFlavors` 函数**未被调用** | 死代码 | 0.5 阈值基于假设，未验证 |
| 3 | [App.tsx:171-187](food-quiz/src/App.tsx) | 上一题后再答，触发器不再重排 | 用户回退改答案 | `_rerolled` 标记 |
| 4 | [App.tsx:104, 140, 324](food-quiz/src/App.tsx) + [adaptiveQuiz.ts:36](food-quiz/src/utils/adaptiveQuiz.ts) | 4 处 `Math.random()` 不受 seed 控制 | 初始 seed、计算屏文案、PRNG fallback | 选题流程已用 mulberry32 |
| 5 | 题库分布 | `sensory`(5) / `texture`(3) 题量远少于 `daily`(37) | coverage 加成反复把稀疏类别顶上来 | 无 |
| 6 | Pearson 中心化 | 两人 profile 各维度差都 < 1e-3 时 `magA=0` | 极端情况 | 返回 0 |
| 7 | Top-5 抽样 | 答案空间大时 Top-5 区分度不高 | 大量相似题聚集 | 无 |

---

## 7. 改进方向

按 ROI 排序：

### 7.1 高 ROI
- **合并 `aggregate` / `aggregateProfile`**：移到 `utils/aggregate.ts` 共享，消除重复实现
- **加 cuisine 偏置项**：对平坦 profile cuisine 加最小相似度阈值，避免无意义排名
- **替换 4 处 `Math.random()`**：让 seed 完全控制所有随机源

### 7.2 中 ROI
- **持久化 `selectedQuestions` swap 历史**：让"上一题"功能能完整撤销自适应重排
- **题库扩充到 200+**：缓解 sensory/texture 稀疏
- **反向题扩到 5~8 道**：识别"用户对 X 强烈排斥"

### 7.3 低 ROI
- **替换 Pearson 为 NN-based embedding**：8 维小空间，深度学习没有优势
- **引入 Bayesian 更新**：增量答案的 profile 应该有不确定性带，当前是点估计
- **A/B 评测框架**：当前没有"算法变体对比"的脚手架
