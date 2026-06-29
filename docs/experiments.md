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

## 任务⑨ ① σ / VR 实验 — 严重负增量（conc 0.469→1.0），① 弃·可重试

> **σ 闸门核心担心**（§11.10.4「① 退化为换皮 sw*10」）**实证：比换皮更糟——VR 比 sw*10 更锁死**。
> 临时脚本 `_sigma-exp.test.ts`（静态诊断 + 动态对比，测完即删，三件套绿）。

### 目标

验证 ①（不确定性建模 / VR）能否解 §11.7 Stage1 的「early sw*10 锁死」（early 评分锁死、diversity 旋钮无效、earlyCen 高）。这是 ① **唯一剩余的必要性**——⑥ 跨 session conc 已被 SH 解（任务③/SH 强度评估），① 不再为⑥。

### 阶段 1：静态诊断（count=0 候选评分分布，214 题）

σ 闸门核心：early profile≈0 时 VR gain≈Στ²（§11.11.2），区分力来自题固有 τ²（选项在某维分散度）。诊断 Στ² 是否比 sw*10 更均（解 early 锁死）还是更集中（负增量）。

| 信号 | mean | std | top1率 | N_eff(/214) | Gini | 解读 |
|:--|:--|:--|:--|:--|:--|:--|
| sw*10 | 2.26 | 1.48 | 0.008 | 149.8 | 0.323 | count=0 只 smooth=4.0/sharp=1.0 两档，并列 |
| **Στ²** | 1328 | 1235 | 0.022 | **114.8** | **0.494** | **比 sw*10 更集中**（N_eff 低、Gini 高） |

- **Pearson(sw\*10, Στ²) = 0.652**（中等正相关，非完全换皮）；top-20 重叠 8/20（非同批霸榜）。
- **Στ² top-15 全 smooth 场景题**（q43 追剧 Στ²=6232、q41 加班、q64 大冷天…），sw*10 top-15 是 q7-q52 段。
- **VR gain 静态已暗示负增量**：Στ² 比 sw*10 更集中 → VR 驱动会让 early conc 升非降。

### 阶段 2：动态对比（closestTo 32 runs = 5 一致 + 3 摇摆 × 4 seed，acc 用 normalize 对齐基线）

注入方式：pickNextQuestion 加临时 `earlyScorer?` 参数（default=原逻辑，quiz-simulation 断言不变），VR scorer = `sw·1(软约束) + vrN·wVr + (stdN+covN)·wDiv`（sw\*10 降级 sw\*1）。σ 模型 (a) 计数衰减 `σ_d²=σ0²/(1+n_d)`，σ0=200（σ²=40000≫τ²~2000，VR≈Στ²）。测完 git checkout 回退参数。

| 配置 | acc | conc | earlyCen | lateCen | mean | pursue | dup |
|:--|:--|:--|:--|:--|:--|:--|:--|
| baseline（原 sw*10+div，本脚本） | 0.9503 | 0.469 | 0.5123 | 0.4278 | 25.4 | 9% | 0 |
| **VR-A**（wVr=3,wDiv=1.5,VR 主导） | 0.9572 | **1.000** | 0.3904 | 0.3903 | 26.3 | 25% | 0 |
| **VR-D**（wVr=0.5,wDiv=4,div 主导） | 0.9428 | **1.000** | 0.2182 | 0.4324 | 25.4 | 19% | 0 |
| 基线对照（aeba731 `_diversity-exp`） | 0.9501 | 0.750 | 0.4869 | 0.2643 | 27.4 | 41% | 0 |

> acc 对齐（0.9503 vs 0.9501，证明模拟核心一致）；conc/lateCen/mean/pursue 差异来自画像/seed 细节（本脚本与 aeba731 脚本的 seed/摇摆画像组成略不同）。**VR vs baseline 相对对比（同脚本同 seed）有效**。

### 判据复核

| 判据 | 结果 | 说明 |
|:--|:--|:--|
| conc（核心） | ❌ **VR conc=1.000（+113%）** | 某题 32/32 session 全命中，集中度灾难 |
| earlyCen 降 | △ 形式降（−23.8%/−57.4%） | 但是 conc=1.0 的**副产物**（锁死同批高 τ² 题，邻对 cen 稳定），非 diversity 发力 |
| acc 降幅<0.005 | ◐ VR-A +0.0069 微升；VR-D −0.0075 略超 | |
| mean∈[26,36] | ◐ VR-A 26.3；VR-D 25.4 边缘 | |
| dup=0 | ✅ | |

### 结论与根因

1. **① 对 early 严重负增量（conc +113%→1.0）**——σ 闸门未通过。VR 不解 early 锁死，反而恶化。
2. **根因——VR 的「强区分力」恰恰是它锁死的原因**：
   - sw*10 在 count=0 只 smooth=4.0/sharp=1.0 两档，**所有 smooth 题并列** → seeded jitter（jitterBase 0-3）打散排名 → conc 低（0.469）。
   - VR gain（Στ²）是**确定性**题固有属性，q43 Στ²=6232 独占鳌头 → 每 session 都选 → **conc=1.0**。区分力越强、top-1 越独占。
3. **σ 闸门担心实证更糟**：§11.10.4 担心「VR 退化为换皮 sw*10」——实际 VR 比 sw 更锁死（conc 0.469→1.0），因为 sw 的「弱区分（并列）+ seeded jitter」反而是降 conc 的机制，VR 的强区分破坏了它。
4. **earlyCen 形式降是假象**：VR-D earlyCen −57% 看似好，但伴随 conc=1.0 + acc −0.0075——锁死同批题让邻对 cen 稳定，不是多样性。

**① 最终处置：弃。** ① 对 early（唯一剩余必要性）负增量；对 late（SH 已解跨 session conc）无必要。第三档①不上。

### 可重试条件（被弃≠永弃）

① 的 early 路径**无合理可重试变体**——任何让 VR 不锁死的改动都让它退化为 sw*10 现状：
- VR gain 加 seeded 抖动（让 top-1 不独占）→ 本质是把 VR 改回 sw*10「弱信号+jitter」范式，失去 VR 意义。
- 限制 VR 区分力（归一化截断）→ 同理退化。
- σ 模型让 early VR gain **降低**区分力（反直觉）→ 无理论依据。

若未来重提①，须先论证「VR 的强区分力如何不导致 top-1 独占」——目前无解。**真正解 early 锁死的方向是「弱信号 + seeded 打散」（现状）或「硬过滤 + 追问维保护」（§11.7，任务① early 可重试条件），非换更强评分信号。**

### 注入点（未达落地，备查）

① 弃，以下注入点**不实施**，仅记录供未来重评：
- `state.ts`：profile 升级 (μ,σ²,n,sampleCount)，applyAnswer 改 Welford 在线更新
- `adaptiveSelector` early/late gain 改 VR
- 预计算 `content/optionVariance.json`（τ²，loader 静默降级须盯 schema）

### 关键约束（SH 评估结论，带入后续）

- **SH 不调软**（跨 session 去重正面）→ EMA 不恢复（c398edf 已 revert）
- **early 硬过滤可重试**条件中「SH 调软」分支作废，只剩「early 加追问维保护 / 提高阈值（≥0.85）」（①σ 分支已实证负增量，作废）
- **第三档①关闭**：σ 闸门未通过（conc 灾难），第二档（文案/扩题）即为算法侧终点，诚实接受 early sw*10 锁死的天花板（conc≈0.47-0.75，由 seeded jitter 决定，非采样/评分可破）

---

## 任务⑨② early 硬过滤 + 追问维保护 重试 — 跨 session 无正收益，不落地

> 任务⑨① 关闭①σ 后，early sw*10 锁死的唯一剩余路径是任务① early 硬过滤的可重试条件（「追问维保护 / 提阈值0.85」两分支）。本节实证两分支，并**首次测跨 session 相似性**（重点）。临时脚本 `_early-filter-exp.test.ts`（测完即删，三件套绿）。pickNextQuestion 加临时 `earlyFilter?` 参数（threshold + pursueProtect），测完 git checkout 回退。

### 关键转向：跨 session 相似性才是重点

任务①/⑨① 只测单 session（earlyCen/lateCen/conc）。但用户真正痛点是**跨 session 同质化**——"做了好几次老差不多"。新增跨 session 指标族（附录 A.2 已定义，首次纳入实测）：

| 指标 | 定义 | 方向 |
|:--|:--|:--|
| 跨 session conc | 某题在所有 session 出场率（max） | ↓好 |
| jaccard | 任意两 session 题集 \|A∩B\|/\|A∪B\| 均值 | ↓好（最直接同质化） |
| used | N session 用过不重复题/214 | ↑好 |

### 跨 session 结果（SH 启用，recentCounts 跨 3 轮累积，3轮×5画像×2seed=30 session/配置）

| 配置 | conc | jaccard | used | 判定 |
|:--|:--|:--|:--|:--|
| baseline | 0.167 | **0.050** | 100% | SH 已压到极低 |
| hard080（任务①复现） | 0.200（**+20%**） | 0.057（**+16%**） | 100% | ❌ 跨 session **恶化** |
| hard080-protect（追问维保护） | 0.167（0%） | 0.049（−1%） | 100% | ◐ 持平 |
| hard085（阈值0.85） | 0.167（0%） | 0.052（+5%） | 100% | ❌ 微升 |

### 单 session 结果（无 SH，32 runs，对照）

| 配置 | earlyCen | winCen | conc | pursue | acc |
|:--|:--|:--|:--|:--|:--|
| baseline | 0.5123 | 0.5257 | 0.469 | 9% | 0.9503 |
| hard080 | 0.3024（−41%） | 0.3268（−38%） | 0.563（+20%） | 22% | 0.9563 |
| hard080-protect | 0.4601（−10%） | 0.4659（−11%） | 0.469（0%） | 13% | 0.9522 |
| hard085 | 0.3665（−29%） | 0.3734（−29%） | 0.500（+7%） | 16% | 0.9560 |

> pursue 全 <40%：本脚本画像组成 baseline pursue 9%（vs experiments 基线 41%），画像/seed 细节差异；single-session 相对对比有效。

### 结论

1. **跨 session 同质化已被 SH 解**（baseline jaccard **0.050**、conc 0.167、used 100%）——用户重点关心的"跨次重复"已压到极低，early 硬过滤无空间。
2. **early 硬过滤对跨 session 无正收益，反恶化**：hard080 conc +20%、jaccard +16%。机制——硬过滤把所有 session 的 early 题推向同一批"cen<0.80 合规题"，跨次同质化。**即使 single-session earlyCen 降 41%，跨 session 反而变差**，彻底否定其价值。
3. **追问维保护防恶化但得不偿失**：hard080-protect 跨 session 持平（jaccard −1%），但 single-session earlyCen 收益从 −41% 缩到 −10%（保护让硬过滤力度减半），且 conc 不降、pursue 仍低。
4. **提阈值0.85 也不行**：跨 session jaccard +5% 微升，single-session conc +7%。

### 处置与可重试闭环

**early 硬过滤（含追问维保护、提阈值）不落地**。任务⑨① 列的 early 硬过滤可重试条件**两分支全部实证失败**：
- 追问维保护：跨 session 持平 + single-session 收益有限（−10%）→ 不值得
- 提阈值0.85：跨 session 微升 + single-session conc 升 → 不值得

**early sw*10 锁死的真解是扩基线题库**（数据层，第二档任务⑦）——让 early 有更多样的合规基线题可选，从源头分散，而非评分后过滤（过滤会让跨 session 同质化）。这与任务⑨① 关闭①、sw*10 局限分析（解在数据层非评分/采样层）三方向一致收敛。

**可重试条件更新**：early 硬过滤路径**无合理可重试变体**（追问维保护/提阈值均已实证失败）。若未来重提，须先扩基线题库让"合规题池"足够大，否则任何硬过滤都会把 session 早期题同质化。

### 新增指标含义（备查）

- **跨 session jaccard**：任意两 session askedIds 题集的 |A∩B|/|A∪B| 均值。0.050 = 两次测试平均只重叠 5% 的题。比"跨 session 重复题数"更规范（比例，不受 session 长度影响）。SH 强度评估的"跨 session 重复 4.5→0.1"是相邻 session 绝对数；jaccard 是全局 session 对比例，更全面。

---

## 第二档（数据层）实验 — 214→456 题，C→B→D→humanizer 双循环

> 第一档算法侧收口（§11.12 ①关闭）后，转数据层解瓶颈⑤（文案同质化）+ ③（温度维）。

### B 任务：getSessionStemCounts 主题键 pursue 暴跌 → 回退 stem 键

| 配置 | pursueRate | mean | 集中度(single-session) |
|:--|:--|:--|:--|
| 基线（stem 全文，失效） | 41% | 27.4 | 0.63 |
| 主题键含 flavor-axis | **22%** | 25.9 | 0.775 |
| **回退 stem 键（落地）** | 41% | 27.4 | 0.63 |

**根因**：同维题（flavor-axis 相同）被当同主题，STEM_DEDUP[1]=0.3 压制机制B 需的同维二次探测 → pursue 暴跌（与任务① early 硬过滤"误杀同维探测"同构）+ 集中度升。

**决策**：B 只做跨 session（sessionPenalty 用 primaryTopic 主题键），session 内回退 stem 键（P8.1 沉睡兜底；session 内同主题靠 MMR topicPenalty）。

### primaryTopic 排除 flavor-axis + format + cap

跨 session 主题键排除：flavor-axis（测量维，机制B 需同维）+ format（题型太粗，dish-vs-dish 占 71%，作主标签会让 200+ 题连带屠版）。取 region/scene/ingredient/temperature。SESSION_TOPIC_FREQ_CAP=3（0.7³=0.343，防大主题连带，与 id 级上限一致）。

### 温度维启用（瓶颈③解决）

补 8+12 温度题，密度 24.8→27.7≥25，机制C 不再跳过温度维。**坑**：vitest deps 缓存旧 questions.json 致 BANK_DENSITY 误判（温度断言误报），需清 node_modules/.vite。

### 扩题质量：随机配对 → 同 cuisine 配对

初版 generate-questions-v7 随机菜品对：荒谬对（冰淇淋 vs 小笼包）+ 重复对（同对 4 次）。regen 改**同 cuisine 配对 + 去重** → 合理对比。sour 密度被 dish-vs-dish 稀释 33.9→24.37<25 → 补 6 sour 题 → 25.99。

### early sw*10 锁死天花板（继承第一档）

456 题下集中度冲到 1.0——single-session 犀利度分层硬约束，第三档①已关闭（任务⑨①），诚实接受。

### 已知问题

- 模板节奏单一：234 新题 stem 由 8 模板轮换，跨题句式重复（机械扫描无 AI 词，节奏需后续人工多样化）。
- smooth 23%：dish-vs-dish（sharp）为主，早期分层靠选题逻辑优先 smooth。
- sour/温度维靠自定义偏好题补密度（dish-vs-dish 菜品 sour/temp 信号弱）。

---

## early sw*10 锁死破解实验（第三档重探）— warm-up 破 conc 但代价 production 质量，撤回接受 conc=1.0

> 用户不接受 §11.12「诚实接受 early sw*10 锁死天花板」，要求联网+实验重探。允许大规模重构。
> 三个 Explore 代理（含联网）查清：已试全失败（VR/硬过滤/gDPP/MMR/Cluster/EMA/SH/扩题/top-K/scale），遗漏**第四路径——early 绕过评分管线**（warm-up seed pool / UCB 加性）。本节实证第四路径。

### 锁死机制精确定位

early 评分 `score=(sw*10 + stdTerm + covTerm·jitter + jitterBase)·stemPenalty·sessionPenalty`（adaptiveSelector.ts:630）。`sw*10` 跨层差距 **3.0**（smooth=4.0/sharp=1.0）> 多样项总和（stdTerm≤0.5 + covTerm·jitter≤0.85 + jitterBase≤3.0）→ 前 12 题 smooth 子集垄断。`sw=sharpnessWeight(count,sharpness)` 与 profile 无关，count=0 纯按题型分层。

**conc=1.0 真实根因（非 artifact）**：真实 App 条件（随机 seed + SH）实测仍 1.0。垄断题 q505（sour 维 fix-sour 手工设计 sour=88 outlier），mid `undercoveredDims`（warm-up 1 题 sour profile<COVERAGE_FLOOR 180）→ covTerm 强选最强 sour 题 → 每 session 都选。**sw*10 锁死 + mid undercovered 覆盖驱动**双重锁定。

### 阶段 0 基线（456 题，无 warm-up，closestTo 40session）

| acc | conc | earlyCen | lateCen | mean | pursue | jaccardAll |
|:--|:--|:--|:--|:--|:--|:--|
| 0.9630 | **1.000** | 0.2848 | 0.2946 | 29.1 | 53% | 0.308 |

### 阶段 1 seed pool 构造

`build-seed-pool.mjs`：8 维×6=48 题，score=std+0.3·maxDim-0.5·overlap（overlap cap 0.85，smooth 优先 sharp 补）。sharp 率 27%（≤0.4 = early target）。loader/schema 加载期校验（8维≥3/id真实/无重复）。

### 阶段 2 Warm-up（count<N 绕 sw*10，seeded 维度槽轮转）

| N | conc | earlyCen | jaccard8 | pursue(quiz-sim) |
|:--|:--|:--|:--|:--|
| 8 | 1.000 | 0.154（-46%）| 0.103 | 41% |
| 12 | 0.975 | 0.147 | 0.135 | — |
| **14** | **0.925** | **0.085（-70%）** | 0.162 | **41%** |
| 25(mid seed pool) | 0.850 | 0.152 | — | **13%（崩）** |

- **N=14 帕累托最优**：conc 破 1.0（0.925）、earlyCen -70%、jaccardAll 0.277（<基线 0.308，没涨）、pursue 41%（quiz-sim 正常）。
- **N=25 不可用**：conc 0.850 但 pursue 崩 13%（占满 early，机制B/C 不触发）+ jaccardAll 0.344（涨>基线）。
- **垄断位置诊断**：q510 出场 count 全在 8-18（mid 早期），`sw10=1.0`/`covTerm=0.058` 低 → 非 undercovered 驱动，是 warm-up 占 top smooth 后 mid dedup 滤 smooth → sharp 填补集中。

### 阶段 3 UCB 加性探索（实测无效，撤回）

`score += UCB_C·sqrt(ln(T+1)/(freq+1))`（加性，量级匹敌 sw*10）。UCB_C 扫描 3/6/100 + sour 池扩（+4 等价题，460 题）+ 真实条件（SH+随机seed）：

| UCB_C | conc | 垄断题 |
|:--|:--|:--|
| 3 | 1.000 | q505 |
| 6 | 1.000 | q507 |
| 100 | 1.000 | q510 |

**UCB 完全无效**。诊断铁证：q510@count10 `sw10=1.0`/`covTerm=0.058`/`ucb=4.6` → UCB 把低频 sharp 题顶上去（ucb>sw10），**制造新垄断**（q505→q510）而非轮流。根因：mid 每 session 选的题频次都高 → ucb 退化为不区分；UCB 是"频次"工具，对"覆盖驱动 + dedup 填补"垄断不对症。**UCB 撤回（UCB_C=0）**。

### 方向1 dedup 排除 warm-up 题

mid dedup `recent` 窗口排除 count<WARMUP_N 题（避免 warm-up 占 smooth 后滤光 mid smooth）。实测 conc 仍 1.0（q510 40/40），未破。撤回。

### 最终决策：撤 warm-up，接受 conc=1.0

N=14 warm-up 破 conc（0.925）+ 全指标改善，**但破坏 production 质量机制**（4 测试失败）：
- **剪枝**：warm-up 绕评分不接 pruned → 选用户否决维（spicy=-40 仍选辣题）= **真实用户体验风险**
- **SH 频次**：warm-up 不接 recentCounts → 跨 session SH 不作用于 warm-up 题
- **dedup**：方向1 改 dedup 行为

**warm-up 破 conc 的代价是 production 质量（剪枝/SH/dedup），权衡保质量**。撤 warm-up（WARMUP_N=0）+ 撤方向1 + UCB_C=0，回基线。保留 sour 池扩（+4 等价题，460 题，sour 维密度提升，独立数据层改进）。

### 结论

early sw*10 锁死 + mid undercovered 覆盖驱动是**结构性双重锁定**。第四路径（warm-up 绕评分）能破 conc（0.925）但绕过评分 = 绕过剪枝/SH/dedup 等 production 质量机制，得不偿失。**与 §11.12 一致接受 conc=1.0 天花板**，但本次经联网 + 第四路径实证后结论更扎实：评分/采样/过滤/绕评分四路径全实证，conc=1.0 是 early sw*10 + mid undercovered + 题库结构（sour outlier）的硬约束。真解需 production 质量机制与 warm-up 解耦（warm-up 接 pruned/SH，未实施——复杂度 vs 收益不划算）。
