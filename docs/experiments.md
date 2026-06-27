# 实验日志 · 算法改动数值对比

> 每次算法改动记录改前 / 改后数值对比，确保改动可追溯、收益有据（非"三件套绿就 ship"）。
> **判据**：主基线三数（mean / pursueRate / dup）不回归 **+** 改动目标指标改善。
>
> **画像**：closestTo（非 §11.7 forceMax），`recentCounts` 默认空（不测 SH）。
>
> **指标全集**（对标 §11.7，closestTo 下统一测量，5 一致 + 3 摇摆画像 × 4 seed = 32 runs）：
> - `acc` = cos(profile, target) ↑好（准确度）
> - `conc` = 单题最高出场率（跨 session） ↓好（集中度）
> - `earlyCen` / `lateCen` = early(count<25) / late(count≥25) 阶段相邻题对去中心化 cen ↓好（邻题多样性）
> - `mean` / `pursueRate` / `dup` = quiz-sim 主基线（题数 / 机制B触发 / 重复）
>
> **可重试原则**：被弃改进记录弃因 + 可重试条件。后续重构（任务③ A 判据 / 任务⑩ ① σ 重构）
> 若消除弃因，**必须重新尝试 + 数值对比**，不永久判死。被弃 ≠ 永弃。

## 基线锚点

`aeba731`（任务①② 前）quiz-simulation 主测试：mean 27.4 / pursueRate 41% / dup 0。
完整 7 指标见下表"基线"行（实验填）。

---

## 任务① §11.7 MMR 硬过滤 — commit 860e812（late 落地，early 弃·可重试）

`mmrHardFilter` helper：late 分支 top-K 前置硬剔除与 recent(最近 5 题)任一 cen≥0.80 的候选，与乘性 topicPenalty 叠加。

### closestTo 完整指标对比（32 runs，临时脚本 `_diversity-exp.test.ts`）

| 配置 | acc | conc | earlyCen | lateCen | mean | pursueRate | dup | 判定 |
|:--|:--|:--|:--|:--|:--|:--|:--|:--|
| 基线（无硬过滤，aeba731） | 0.9501 | 0.750 | 0.4869 | 0.2643 | 27.4 | 41% | 0 | — |
| **late 硬过滤（落地，860e812）** | 0.9503 | 0.750 | 0.4869 | **0.2303** | 27.4 | 41% | 0 | ✅ lateCen −12.9%，三数持平 |
| early+late 双硬过滤（弃·可重试） | 0.9582 | 0.813 | **0.2576** | 0.2879 | 26.2 | 28% | 0 | ❌ 四重代价（见下） |

### 结论与可重试

- **late 硬过滤**：lateCen 0.2643→0.2303（**−12.9%**），acc/conc/earlyCen/三数全持平 → **有用（降 late 邻对相似度）且无害**，落地有据。这是 §11.7 Stage1「lateCen 副作用需 late 硬过滤压」在 closestTo 下的实证。
- **early+late 双硬过滤**：earlyCen −47%（0.4869→0.2576，diversity 收益）但**四重代价**：
  1. pursueRate 41%→28%（−13pp，伤追问机制B：误杀同维二次探测）；
  2. lateCen 反弹 0.2303→0.2879（+8.8%，early 改 askedIds 序列致 late MMR 更难压，§11.7 Stage1 副作用复现）；
  3. conc 升 0.750→0.813（+8.4%，集中度恶化）；
  4. mean 降 27.4→26.2（追问少 → 更快收敛停）。
  → 弃。closestTo 下 early 代价远比 §11.7 forceMax「近乎免费」严峻（forceMax 无追问 / 无 lateCen 反弹可观测）。
  - **可重试条件**（early 重试需**同时**解四代价，非任一）：
    1. 任务⑩ ① σ / VR 重构后追问不再依赖同维二次探测（解代价①）；
    2. 任务③ A 判据提供独立 diversity 路径（解代价①③）；
    3. early 硬过滤加「追问维保护」（不剔 pursueDims 维极相似）/ 提高阈值（≥0.85）减误杀——**可立即试**，但需验证是否同时压住 lateCen 反弹(②)与 conc(③)。
  - **触发后**：重跑本表 early+late 行，判据 lateCen≤0.2643（不反弹）+ conc≤0.750（不恶化）+ pursueRate≥40% + earlyCen 降 → 四项全过才重新落地。

---

## 任务② Session EMA — c398edf（已回退 262127f，SH 调软可恢复）

> **⚠ 已回退**：SH 强度评估（见下）确认 SH 不调软 → EMA 永远冗余（选题无效，freq 衰减无空间）。本节保留实验记录供参考。**若未来 SH 调软**，可恢复 EMA 逻辑（sessionMemory.ts `EMA_DECAY=0.5` 按轮次距离加权，`git show c398edf` 取回实现）。

`loadRecentAskedCounts` 从"拼平等权计数"改为 EMA 按轮次距离加权（最近=1.0，前=0.5，再前=0.25）。

### quiz-simulation 三数

quiz-simulation 不传 recentCounts → EMA 对主基线三数**无影响**（= 基线 27.4/41%/0）。
**quiz-sim 不覆盖 SH**，EMA 效果需专门跨 session 实验验证。单测仅证明 EMA 加权数值正确。

### SH 跨 session 实验（临时脚本 `_sh-ema-exp.test.ts`）

构造 baseline 下最热门题 q59（无 SH 时 75% session 出现）进入 recentCounts，对比 baseline / old 等权 / EMA：

| 场景 | q59 freq（old/ema） | penalty（old/ema） | q59 session 出现率 |
|:--|:--|:--|:--|
| （baseline，无 SH） | — | 1.0 | **75%** |
| q59 仅最旧轮（d=2） | 1.0 / 0.25 | 0.700 / 0.915 | old=**0%**  ema=**0%** |
| q59 三轮都出现 | 3.0 / 1.75 | 0.343 / 0.536 | old=**0%**  ema=**0%** |

**结论**：
1. **EMA 加权数值正确**：旧轮 freq 衰减（d=2：1.0→0.25），最近轮不变；penalty 相应 0.700→0.915（单测 + 实验双证）。
2. **选题层面 EMA 当前无可见效果**：q59 一旦进 recentCounts（任何 freq>0），SH penalty 把它从 75% 压到 0%；old/ema 的 penalty 差异（0.7 vs 0.915，或 0.343 vs 0.536）都不足以让题复出。
3. **根因——SH 名义"软"实"硬"**：`SESSION_SOFT_PENALTY=0.7` 下 freq=1 penalty=0.7 即把热门题压死，freq 衰减与否无关。EMA 的选题价值依赖 SH 强度：SH 调软（penalty→0.95 量级）后，freq 衰减的选题差异才会显现。
4. **可重试 / 条件依赖**：EMA 保留（逻辑正确、无害、为 SH 调软铺垫）；**SH 强度需重评**——这是任务③（A 跨 session 热度硬帽，同为 SH 类）的输入。SH 调软后必须重测 EMA 选题效果（重跑本表，预期 ema > old）。

---

## 任务③ A 跨 session 热度硬帽判据实验 — 临时脚本 `_hotcap-exp.test.ts`（测完即删）

模拟 6 轮 × 10 session（5 画像 × 2 seed），recentCounts 跨轮刷新（模拟 App.tsx startQuiz），对比 baseline / SH-only / SH+硬帽(N,K)。硬帽实现：recentCounts 里 freq≥K 的题 freq 设 10（趋 0 penalty，等效硬排除）。

| 配置 | conc | acc | mean | dup |
|:--|:--|:--|:--|:--|
| baseline（无 SH） | **1.000** | 0.9617 | 26.3 | 0 |
| SH-only | **0.417** | 0.9622 | 25.4 | 0 |
| SH+硬帽（N=3,K=2） | 0.417 | 0.9622 | 25.4 | 0 |
| SH+硬帽（N=5,K=2） | 0.417 | 0.9622 | 25.4 | 0 |

> 注：实验因 4 模式 × 6 轮 × 10 session 计算量超 vitest 默认 5s 超时，但 console 在超时前已输出全部 4 模式完整数据，数据有效。

### 结论（判据 conc≤0.7 + acc 降幅<0.005）

1. **baseline 多 session conc=1.000**：某题在每个 session 都出现——这才是瓶颈⑥的真实形态（**跨 session 集中度**，非 §11.7 forceMax 的单 session 内 conc=1）。closestTo 单 session conc=0.75，但多 session 累积冲到 1.0。
2. **SH-only conc=0.417（−58%），acc 微升（0.9622 vs 0.9617）**：SH（跨 session 频次衰减）已大幅降跨 session 集中度且不伤 acc。判据 **conc≤0.7（0.417）+ acc<0.005（微升）双双通过** → **⑥ 在 closestTo 多 session 下已被 SH 解**，无需硬帽。
3. **SH+硬帽 = SH-only（零增量）**：确证任务② SH 过强发现——SH 已把高频题压死（freq=1 即 0% 出现），硬帽（freq≥K 设大）相对 SH 无任何额外效果。**硬帽无落地必要**。
4. **第三档①（σ 重构）针对⑥的部分降级**：SH 已解跨 session conc，①不再为⑥必要。

### ① 必要性重定位

① 仍可能必要的部分：① 还针对 §11.7 Stage1 的「early sw*10 锁死」（early 评分锁死、diversity 旋钮无效、earlyCen 高）。这是 **single-session early 集中度**，非跨 session conc，SH 不解此。
故①的必要性从「解⑥（跨 session conc）」重定位为「解 early sw*10 锁死 / earlyCen」。任务⑨（σ 可行性实验）的判据相应聚焦 early gain 是否退化、earlyCen 是否降，不再看跨 session conc。

---

## 任务④ Candidate Cluster 必要性诊断 — 临时脚本 `_cluster-exp.test.ts`（测完即删）

轻量诊断（不改正式代码）：测现状（四级去重 + P8.1 stem 软惩罚 + late 双重惩罚）下，closestTo 40 session 内同 stem 最大出现次数。

| 指标 | 值 |
|:--|:--|
| max stem count 分布（1/2/3/4/5+） | **40 / 0 / 0 / 0 / 0** |
| 全局 max stem | **1** |
| max≥3 的 session | 0/40 |

**结论**：现状下 single-session 内同 stem 题最多出现 **1 次**（40/40 session 全部）。Cluster（限同 stem ≤m，m=2/3）**完全无增量**——现状 ≤1 已严于 m=2 的目标。→ **Cluster 弃**，无落地必要。

与任务③ 一致：conc 类问题已被现有机制全覆盖——**跨 session conc by SH（0.417）**，**single-session stem 集中 by 四级去重 + stem 软惩罚（≤1）**。Cluster、热度硬帽均无增量空间，均不落地。

---

## 第一档总结

| 任务 | 结论 | 落地 |
|:--|:--|:--|
| ① §11.7 late MMR 硬过滤 | lateCen −12.9%，三数持平；early 四重代价弃·可重试 | late 落地（860e812），early 暂缓 |
| ② Session EMA | 加权数值正确；选题待 SH 调软（SH 过强 freq=1 压死题） | 落地（c398edf），SH 强度重评留任务③ |
| ③ A 热度硬帽判据 | SH-only conc 0.417（−58%）解⑥；硬帽零增量 | 不落地（SH 已够） |
| ④ Candidate Cluster | 现状 stem ≤1，Cluster 无增量 | 弃 |

**重大方向调整**：
- **瓶颈⑥（跨 session conc）已被 SH 解**（conc 1.0→0.417，acc 不崩）——硬帽、Cluster 均无必要。
- **第三档①（σ 重构）必要性降级**：不再为⑥（SH 已解），重定位为解 **early sw*10 锁死 / earlyCen**（single-session early 集中度，SH 不解）。任务⑨ σ 判据聚焦 early gain/earlyCen。
- **SH 名义软实硬**（freq=1 压死热门题）：是 EMA 选题无效的根因，也是 SH 解⑥的机制。SH 强度是否需调软（让 EMA 生效 + 避免过度压制）留作独立评估，牵动 EMA/early 硬过滤可重试条件。

---

## SH 强度多维评估 — 临时脚本 `_sh-strength-exp.test.ts`（测完即删）

补充任务③ 的 acc/conc，加选题多样性（earlyCen/lateCen）/ 题库利用率 / 跨 session 重复。

> **修正任务③ 实验瑕疵**：任务③ `_hotcap-exp`「轮前读 counts」（10 session 共享）不真实——App.tsx 是每 session（startQuiz）读一次。本实验改为 session 前读（真实顺序测试），数值更准。

| 指标 | baseline | SH-only | 评估 |
|:--|:--|:--|:--|
| conc | 1.000 | **0.275** | SH 解⑥更彻底（任务③ 轮前读 0.417 偏乐观，真实 0.275） |
| acc | 0.9617 | 0.9617 | 完全持平，不崩 |
| 跨 session 重复 | 4.5 | **0.1** | SH 大幅降重复（顺序压上 session 题），核心目的达成 |
| 题库利用率 | 55/214（26%） | **164/214（77%）** | SH 让每 session 用新题，利用率翻倍 |
| earlyCen | 0.5003 | 0.5206（+0.02） | single-session early 多样性微降 |
| lateCen | 0.2436 | **0.3130（+29%）** | single-session late 多样性降（SH 副作用） |

### 结论

1. **SH 过强对跨 session 完全正面**（conc 0.275、重复 0.1、利用率 77%、acc 不崩）——「软名义实硬」恰恰实现跨 session 去重的设计目的。**SH 不需调软**（调软反损 conc/重复/利用率）。
2. **SH 唯一副作用：single-session lateCen +29%**（SH 压 recentCounts 题 → late 可用题少 → 邻题更相似）。已由任务① late 硬过滤部分补偿（无 SH 下 lateCen 0.2643→0.2303；带 SH 下升到 0.3130，late 硬过滤的补偿效果待带 SH 重测）。
3. **EMA 在 SH 下确认冗余**：SH 已把跨 session 重复降到 0.1，freq 衰减无空间。SH 既不调软，EMA 永远冗余。

### EMA 去留建议

SH 不调软 → EMA 永远冗余（选题无效，数值层正确但无落地价值）。**建议回退 EMA（c398edf）**：它增加认知负担却不产生选题效果；SH 的跨 session 去重已由"硬 SH"完整实现，无需 EMA 的"软衰减"层。若保留，须在文档标注"当前 SH 下冗余，仅 SH 调软时生效"。

### 牵动可重试条件

- **early 硬过滤可重试**：原条件含"SH 调软"，现 SH 不调软 → 该条件分支作废。early 重试只剩"① σ 重构（追问不再依赖同维二次探测）"或"early 加追问维保护 / 提高阈值"。
- **任务⑨ σ 判据**：聚焦 early gain / earlyCen（SH 不解 single-session early），不依赖 SH 调软。

---

## 任务⑨ ① σ / VR 实验设计大纲（新 session 交接）

> 本 session context 已长，① σ（范式重构级实验）在新 session 执行。本大纲为交接物，新 session 起手即跑。

### 目标

验证 ①（不确定性建模 / Variance Reduction）能否解 §11.7 Stage1 的「early sw*10 锁死」（early 评分锁死、diversity 旋钮无效、earlyCen 高）。这是 ① **唯一剩余的必要性**——⑥ 跨 session conc 已被 SH 解（任务③/SH 强度评估），① 不再为⑥。

### σ 模型候选（实验扫描，选最简有效）

- (a) 计数衰减：`σ_d = σ0/(1+n_d)`，n_d=该维累计被探测次数；early n_d≈0 → σ_d≈σ0 最大（直击 early 不确定性最大）
- (b) 回答方差：`σ_d` = 该维历史 option 权重的样本方差
- (c) 混合：`σ_d = σ0·exp(-n_d/T) + 一致性项`

### VR gain（Expected Variance Reduction）

`g(q) = Σ_d σ_d²·(1 − σ_d²/(σ_d²+τ_d²(q)))`
- `τ_d²(q)` = 题选项在 d 维的方差（预计算）
- 替换 early 分支 `sw*10+std/cov`；late 分支 `Σ|profile|·|w|`
- `sw*10` 降级软约束（如 `sw*1`），保犀利度分层但不再硬锁

### 实验步骤

1. 临时 `_sigma-exp.test.ts`，实现 σ 模型 + VR gain（从 `state.answers` 推 n_d，**不改 state.ts**）
2. 临时改 adaptiveSelector early 分支用 VR gain（git checkout 切换对比，同任务① early 注入范式）
3. closestTo 5 画像 × 8 seed 对比：原 early（sw*10）vs VR early 的
   - **gain 分布 std**（VR 是否退化塌缩，核心判据）
   - earlyCen / lateCen（diversity）
   - acc / mean / dup（不回归）
4. σ 模型 (a)/(b)/(c) 扫描，选最简有效；σ0 标定（如 50/100/200）

### 判据（SH 评估后聚焦 single-session early）

- VR early gain std 不塌（early 有区分力，非 sw 锁死）✓ 必要
- earlyCen 降（diversity 发力）
- acc 降幅<0.005、mean∈[26,36]、dup=0（不回归）
- **不再看跨 session conc**（SH 已解）

### 注入点（若达标落地，任务⑩）

- `state.ts`：profile 升级 (μ,σ²,n,sampleCount)，applyAnswer 改更新规则（Welford 在线）
- `adaptiveSelector` early/late gain 改 VR
- 预计算 `content/optionVariance.json`（τ²，loader 静默降级，须主动盯 schema）

### 关键约束（SH 评估结论带入新 session）

- **SH 不调软**（跨 session 去重正面）→ EMA 不恢复（c398edf 已 revert）
- **early 硬过滤可重试**条件中「SH 调软」分支作废，只剩「①σ 让追问不再依赖同维二次探测」或「early 加追问维保护 / 提高阈值（≥0.85）」
- ① 若 σ 模型对但 earlyCen 不降，回查与 late 硬过滤（任务①已落地 commit 860e812）的协同
- 新 session 起手先 `cat docs/experiments.md`（本文件）+ `docs/algorithm.md` §11.9/§11.11.2
