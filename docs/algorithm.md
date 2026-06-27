# food-quiz 味觉算法白皮书

> **范围**：`food-quiz/src/lib/taste/` 全部算法层的形式化描述、数值对比与演进历史。
> **状态**：选题多样性（问题一）已闭环；推荐区分度（问题二）已修复；gDPP 经实证否决。
> **日期**：2026-06-13 ~ 2026-06-27（61 commits，含 1 merge）。本文档随 `b6b16fb` 之后的 P11 改动重建（旧 `algorithm.md` 于 `6d3f80c` 精简时移除），merge main 温度维（`6d71ed5`）后全文同步。

---

## 摘要

food-quiz 是一个**零网络**的「中国味觉性格测试」：被试先选忌口，再作答 25–45 道自适应题目，每题选项携带 8 维味觉权重，累加成味觉画像向量，归一化后渲染为雷达图 + 长评价 + 跨菜系推荐菜 + 国风分享卡。全部数据编译期内联（Vite glob），无 fetch / 无 API / 无后端。

算法层（`lib/taste/`，第 1 层，纯函数 + 100% 单测）由 9 个模块组成，分四条主线：

1. **向量体系**（keys/types）：8 维单字母空间 `S T H L I X C N`，256 组合索引。
2. **变换与度量**（normalize/similarity）：归一化、标准差、余弦/去中心化余弦/欧氏/混合相似度。
3. **自适应选题**（adaptiveSelector/state）：CAT 变体，信息增益 + 多层去重 + MMR + 追问 + 跨 session 衰减。
4. **结果组装**（result/loaders/radarChart）：归一化→档位→联动/全能文案→推荐菜 MMR→菜系百分比→Canvas 雷达图。

本文档形式化每条主线，给出关键标定的**实测数值**，并以 commit 粒度记录演进。

---

## 1. 系统总览

### 1.1 四阶段状态机（[App.tsx](food-quiz/src/App.tsx)）

```
intro → dietary → quiz → calculating → result
                    ↑                     ↓
                    └── 上一题（可回退）───┘
```

- **intro**：开始。
- **dietary**：9 种忌口探测（影响推荐菜过滤）。
- **quiz**：自适应选题循环。每答一题 `applyAnswer` 更新 profile，调 `pickNextQuestion` 出下一题，`shouldStop` 判定是否进 calculating。
- **calculating → result**：`assembleResult` 归一化 + 组装渲染结构，画雷达图 / 推荐菜 / 分享卡。

### 1.2 三层架构（分层铁律）

```
lib/taste/    第 1 层：算法核心（纯函数，100% 单测，禁 import 第 2/3 层）
content/      第 2 层：JSON 文案资产（5 目录 + dishes.json，互不引用）
components/   第 3 层：React 组件 + Canvas 副作用（shareImage）
```

第 1 层只接收纯数据（如 `ReadonlyMap`），不 import `utils/`（`sessionMemory` 属第 3 层）。坏形状 JSON 被 loader 静默降级为 `null`，对应 section 不渲染——**不抛错**。

### 1.3 算法模块清单

| 模块 | 职责 | 核心导出 |
|:--|:--|:--|
| [keys.ts](food-quiz/src/lib/taste/keys.ts) | 8 维字母体系 + 256 索引 + 档位标签 | `DIMS`, `keyToIndex`, `letterToTierLabel`, `valueToGrade` |
| [types.ts](food-quiz/src/lib/taste/types.ts) | 类型 + `ZERO_VECTOR` + 犀利度 + 忌口 | `WeightVector`, `DimensionVector`, `sharpnessOf` |
| [normalize.ts](food-quiz/src/lib/taste/normalize.ts) | 归一化 + 标准差 | `normalize`, `std` |
| [similarity.ts](food-quiz/src/lib/taste/similarity.ts) | 4 种相似度 | `cosineSim`, `centeredCosineSim`, `euclideanDist`, `blendedScore` |
| [state.ts](food-quiz/src/lib/taste/state.ts) | 答题状态机 + profile 累加 | `applyAnswer`, `undoLast` |
| [adaptiveSelector.ts](food-quiz/src/lib/taste/adaptiveSelector.ts) | 自适应选题（核心） | `pickNextQuestion`, `shouldStop`, `detectPursueDims` |
| [result.ts](food-quiz/src/lib/taste/result.ts) | 结果组装 + 忌口过滤 | `assembleResult`, `passesDietary` |
| [loaders.ts](food-quiz/src/lib/taste/loaders.ts) | JSON 加载 + 形状校验 | `loadInterval`, `loadDishes` 等 |
| [radarChart.ts](food-quiz/src/lib/taste/radarChart.ts) | Canvas 雷达图绘制 | `drawRadarChart` |

---

## 2. 8 维味觉空间

### 2.1 维度与字母体系（keys.ts）

固定顺序，**不可重排**：

| 字段 | sour | sweet | temperature | spicy | salty | rich | crunchy | tender |
|:--|:--|:--|:--|:--|:--|:--|:--|:--|
| 字母 | S | T | H | L | I | X | C | N |
| 中文 | 酸 | 甜 | 热 | 辣 | 咸 | 浓 | 脆 | 嫩 |

- 第 3 位 `temperature`（热，上桌冷热，0 冰冷→100 滚烫）替原 `bitter`（苦）——Phase B Step1（69e0c20），因苦维区分度低、数据稀疏。
- 第 5 位字段名固定 `rich`（浓），禁 `umami`/`鲜`；字母 `X` 让位给"浓"。
- 8 字母互异 → 256 组合串唯一（§2.3）。

### 2.2 类型层（types.ts）

| 类型 | 含义 | 值域 |
|:--|:--|:--|
| `WeightVector` | 原始累加权重（profile） | 允许负值、允许超 100 |
| `DimensionVector` | 归一化向量（雷达/匹配） | $[0,100]$ |
| `TasteLetter` | 单字母联合类型 | `S\|T\|H\|L\|I\|X\|C\|N` |

**犀利度**（派生元数据，不入 JSON）：`sharpnessOf(q)` = 2 选项 → `sharp`（权重绝对值大，精准探测/剪枝），否则 → `smooth`（建基线）。

### 2.3 256 组合索引（keyToIndex）

8 字符串，大写=1、小写=0，`S T H L I X C N` 对应 bit7..bit0：

$$\text{idx} = \sum_{i=0}^{7} \mathbb{1}[\text{letter}_i \text{ 大写}] \cdot 2^{7-i} \in [0,255]$$

例：`StHliXcN` → `10100101`₂ = 165。这 256 个索引唯一对应 `intervals/000.json ~ 255.json` 的整体组合画像文案。

### 2.4 档位标签（两套并行）

| 函数 | 用途 | 规则 |
|:--|:--|:--|
| `letterToTierLabel` | **文案触发**（驱动 interval/synergy 选择） | 非 H/X 维：score>60 → `重X`，else → `低X`；浓维(X)→`浓`/`清淡`；**温度维(H)三档**：凉(<33)/温(33≤x<66)/烫(≥66) |
| `valueToGrade` | **视觉层**（雷达/bar/徽章颜色） | A≥80, B≥60, C≥40, D≥20, E<20（每档 20 分） |

两套独立，互不替换。旧"极档 ⚡"已于 2026-06 并入高档，文案不再区分。

---

## 3. 向量变换与度量

### 3.1 归一化 normalize（[normalize.ts:16](food-quiz/src/lib/taste/normalize.ts:16)）

$$v[d] = \mathrm{clamp}\!\left(50 + \frac{50 \cdot raw[d]}{m},\ 0,\ 100\right),\quad m=\max(1,\ \max_d|raw[d]|)$$

- $raw = +m \to 100$，$raw = -m \to 0$，$raw = 0 \to 50$（中点）。
- 按最大绝对维等比缩放，**保留正负形状**（profile 的正负 → 归一化后围绕 50）。

### 3.2 标准差 std（[normalize.ts:29](food-quiz/src/lib/taste/normalize.ts:29)）

总体标准差（除以 $N=8$）。$std < 15$ 触发**全能文案**分支（§6.4）——8 维都很接近 50（中庸型）。

### 3.3 相似度 similarity（[similarity.ts](food-quiz/src/lib/taste/similarity.ts)）

| 函数 | 公式 | 用途 |
|:--|:--|:--|
| `cosineSim` | $\frac{a\cdot b}{\|a\|\|b\|}$（标准） | 画像评估/选题 closestTo（保留，不改） |
| `centeredCosineSim` | 减 8 维均值后余弦，$[-1,1]$ | **问题二**：推荐/dedup/penalty |
| `euclideanDist` | $\sqrt{\sum(a-b)^2}$ | blendedScore 距离项 |
| `blendedScore` | $0.5\cdot\frac{\mathrm{cen}+1}{2} + 0.5\cdot\frac{1}{1+\mathrm{dist}}$ | 推荐菜/菜系匹配 |

### 3.4 全正压缩与去中心化（问题二根因）

`topicVector`（题主题向量）= options 权重绝对值均值，8 维**恒非负**。任意两题都落在全正象限，标准余弦虚高：

| 度量 | 题库采样均值（400 对） | 含义 |
|:--|:--:|:--|
| `cosineSim`（标准） | **0.801** | 虚高：任意两题"都挺像" |
| `centeredCosineSim`（去中心） | **0.498** | 真实：恢复形状区分力 |

去中心化先减均值，向量围绕 0 有正有负，余弦才反映"形状差异"。常数向量 → 0。**这是推荐区分度与选题去冗余的共同根因**，P10/P11 统一用 `centeredCosineSim` 修复（`blendedScore` 的 cos 项也改用它并映射 $[0,1]$）。

---

## 4. 答题状态机（state.ts）

### 4.1 profile 累加（[state.ts:66](food-quiz/src/lib/taste/state.ts:66)）

每答一题，所选 option 的 8 维权重累加进 profile：

$$profile[d] \mathrel{+}= opt.weights[d]$$

profile 是 `WeightVector`（原始，未归一化），可正可负，范围约 ±几百（25–45 题累积）。

### 4.2 temperature 初始 0（[state.ts:26](food-quiz/src/lib/taste/state.ts:26)）

$$profile_0 = \{sour:0,\dots,temperature:0,\dots,tender:0\}$$

温度维无进化论式的默认偏恶，不预设偏置（替原 `bitter:-15`——苦维曾用 −15 补偿题库密度偏低；换温度维后偏置移除，因温度无"普遍偏好"先验）。

### 4.3 可逆性

`applyAnswer` / `undoLast` / `replaceAnswer` 全部基于"加减权重"，profile 永远是**当前已答选项的净累加**。支持"回退到某题改答"（后续答案丢弃，profile 同步回滚）。

### 4.4 profile 的下游消费

| 消费者 | 判据 | 代码 |
|:--|:--|:--|
| 信息增益选题 | $gain=\sum\|profile[d]\|\cdot|w|$ | adaptiveSelector.ts:558 |
| 剪枝（极度排斥） | $profile[d]\le -30$ | adaptiveSelector.ts:184 |
| 追问收敛 | $\|profile[d]\|\ge 140$ | adaptiveSelector.ts:411 |
| 覆盖度追问 | 累计 $|weight| < 180$ | adaptiveSelector.ts:431 |
| 最终归一化 | normalize → 雷达图 | result.ts:252 |

> **profile vs topicVector**：profile 描述**人**（可正可负，累加）；topicVector 描述**题**（恒非负，绝对值均值）。全正压缩只影响后者。

---

## 5. 自适应选题（adaptiveSelector.ts）—— 核心

### 5.1 选题管线

```
pool = 题库 − asked
  → 剪枝（profile≤−30 的维相关题）
  → L1 exact dedup（最近1题 cen≥0.95）
  → L2 cover dedup（最近2-5题维度重合>3）
  → L4 global dedup（最近10题同题≤1次，无追问时）
  → 评分（早期: std/coverage/jitter；后期: gain/sw/lowCover/MMR/contraBoost）
  → top-K=12 加权采样
```

每层过滤后若池空，**退回上一层池**（兜底，防死锁）。

### 5.2 犀利度分层（sharpnessWeight）

按答题进度匹配题的犀利度：

| 阶段 | count | 目标 sharp 比例 | 实现 |
|:--|:--:|:--:|:--|
| early | <10 | 0.4（smooth 主导） | $1-EARLY\_SMOOTH\_RATIO=0.4$ |
| mid | 10–24 | 0.4→0.6 线性插值 | — |
| late | ≥25 | 0.6（sharp 主导） | $LATE\_SHARP\_RATIO=0.6$ |

返回 $[0,1]$，作乘法加权：$sw\cdot 10$（早期）或 $0.6+0.4sw$（后期）。

### 5.3 信息增益评分（后期）

$$gain(q) = \sum_{opt}\sum_d |profile[d]|\cdot|w_{opt}[d]|$$

profile 越大的维，被该题改动后信息量越大。这是 CAT 的主项——把画像不确定的维问清楚。

### 5.4 多层 local 去重栈

| 层 | 作用域 | 阈值 | 动作 |
|:--|:--|:--|:--|
| L1 exact | 最近 1 题 | cen ≥ 0.95 | **排除**（换皮） |
| L2 cover | 最近 2–5 题 | 维度重合 > 3 | **排除** |
| L3 MMR | 最近 5 题 | 连续 | **降权**（§5.5） |
| L4 global | 最近 10 题 | 同题 ≥ 2 | **排除** |
| L5 stem | 全 session | 累计 n 次 | $\times[1,0.3,0.1,0.03,0.01]$ |

### 5.5 MMR 连续去冗余（P11）

L3 原 P7.1 为**离散计数**（超 0.80 各 ×0.3）。两个缺陷：计数非 max（单点极相似漏判）、离散阈值突变。P11 改为标准 MMR 连续形式：

$$topicPenalty = 1 - W_{mmr}\cdot\mathrm{clamp}(mmrMax,0,1)$$
$$mmrMax = \max_{r \in last5}\mathrm{cen}(tv(q),\,tv(r))$$
$$\text{若 } mmrMax \ge 0.80:\ topicPenalty \leftarrow \min(topicPenalty,\ FLOOR)$$

$W_{mmr}=0.6$，$FLOOR=0.3$（安全网，对齐原 ×0.3 强度）。负相似截 0（形状相反=天然多样，不奖不罚）。

**标定**（5 画像 × 8 seed，强制 MAX，隔离早/后期）：

| 指标 | 早期（无 MMR） | 后期（有 MMR） | 变化 |
|:--|:--:|:--:|:--:|
| 邻对 cen 均值 | 0.522 | **0.415** | −20% |
| 高相似（≥0.80）占比 | 29.3% | **3.5%** | −88% |

后期 0.415 < 随机基线 0.498，证明主动避相似且未过压。

### 5.6 追问机制（detectPursueDims，渐进式 25–45）

三套机制都不依赖负权重，规避"题库各维权重几乎全正"的偏态：

| 机制 | 触发 | 参数 |
|:--|:--|:--|
| **A 同主题不一致** | 同主题题对（sig≥0.6）共同主维上，归一化表态强度差 ≥ 0.45 | `THEME_SIM=0.6`, `INCONSISTENCY_GAP=0.45` |
| **B 强弱波动** | 某维既给强信号（\|w\|≥18）又在能强表态的题选弱（\|w\|≤5） | `STRONG_W=18`, `WEAK_W=5` |
| **C 覆盖度不足** | 某维累计信号 < 180（题库密度<25 的维跳过，如温度维） | `COVERAGE_FLOOR=180`, `BANK_MIN_DENSITY=25` |

**收敛保证**：$|profile[d]| \ge CLARIFIED\_ABS=140$ 或累计信号 ≥ 180 后，该维脱离追问集，不会卡满 45。

> 注：机制 A 的同主题判定**暂保留 `signatureSim`**（未去中心化），属追问战线，不随 P10 连带改。

### 5.7 停止判定 shouldStop（25–45 渐进模型）

$$count \ge 45 \to \text{停};\quad count < 25 \to \text{继续}$$

$count \ge 25$ 后按残余追问维度数渐进容忍：

| count | 停止条件 |
|:--|:--|
| 25–32 | 追问维 = 0 才停（严格） |
| 33–36 | 追问维 ≤ 1 |
| 37–40 | 追问维 ≤ 2 |
| 41+ | 必停 |

实测平均约 33 题（`93ae269`）。

### 5.8 跨 session SH 频次衰减（P11）

`sessionMemory`（localStorage，滚动窗 $MAX\_SESSIONS=3$）记录最近 3 轮 askedIds。选题时读出频次：

$$sessionPenalty = SESSION\_SOFT\_PENALTY^{freq},\quad freq=\text{最近 3 轮出现次数}$$

$0.7^{freq}$：1 次→0.70（沿用 P9 二元基线），2 次→0.49，3 次→0.34。P9 原为二元（出过即 ×0.7），高频垄断题未被额外压制；P11 恢复拼平数组中本就存在的频次（此前被 `new Set` 去重丢失）。

**标定**（3 画像 × 5 轮，within-profile 跨轮 Jaccard）：

| 模式 | Jaccard |
|:--|:--:|
| 无 SH | 0.087 |
| **频次 SH（P11）** | **0.004（−95.5%）** |
| 二元 SH（P9 baseline） | 0.053 |

### 5.9 集中度控制（A1）

集中度 = 单题在多 session 的最高出场率。机制：top-12 加权采样（≈ Randomesque）+ seeded 抖动 + 早期多样性项。

早期评分（$count<25$，无 profile，信息增益退化为均匀覆盖）：

$$score = (sw\cdot 10 + stdN\cdot W_{div} + covN\cdot W_{div}\cdot jitter + jitterBase)\cdot stemPenalty\cdot sessionPenalty$$

$W_{div}=EARLY\_DIV\_WEIGHT$ 标定扫描（5 画像 × 8 seed）：

| $W_{div}$ | 集中度 | 现象 |
|:--:|:--:|:--|
| 1.0 | 0.88 ❌ | stdN 固定主导，排名僵化 |
| **0.5** | **0.63** ✅ | 谷底 |
| 0.3 | 0.82 ❌ | 打散不足 |

护栏断言集中度 $\le 0.7$。当前实测 ≈ 0.63（5×8 seed）；P10 度量去中心化后辅助测量降至 0.375（3×8 seed）。

### 5.10 gDPP 评估（负结果）

理论担忧：MMR 是 local（max-sim），长 session 可能"温水煮青蛙"（每步 max 过关但整体坍塌）。gDPP（贪心 DPP，log-det 边际增益 $\propto 1-k^\top K^{-1}k$）是 joint 度量，理论上能抓。

**诊断一**（last5 窗口 mean pairwise sim）：后段 0.432 < 前段 0.569，且后段窗口 mean 0.432 ≈ 邻对 max 0.415 → **无累积坍塌**。

**诊断二**（3 方案 × 4 窗口全因子，3 画像 × 3 seed）：

| 方案\窗口 | 5 | 10 | 15 | 20 |
|:--|:--:|:--:|:--:|:--:|
| **MMR（base）** | **0.423** | 0.473 | 0.523 | 0.564 |
| gDPP | 0.668 | 0.713 | 0.715 | 0.711 |
| hybrid | 0.599 | 0.622 | 0.673 | 0.670 |

（数值为后段邻对 cen 均值，越低越好）

**三大发现（反转假设）**：
1. **MMR 扩窗口恶化**：$5\to20$，0.423→0.564。max-sim 在大窗口均一化，失去区分力。
2. **gDPP 全线最差**：proj energy 在去中心化量纲下数值极小，penalty≈1，实质失效。
3. **hybrid 被拖累**：弱惩罚稀释 MMR 效果。

**换度量分析**：`sig`（标准余弦）让 K 更病态（K⁻¹ 爆炸）；RBF 核能稳但要标定 σ 且脱离 `cen` 体系。**换度量救不活 gDPP**。

**根因**：① CAT 主次冲突（gDPP 把多样性当主目标，与 gain 主项打架）；② 度量病态（`cen` 作 kernel 近奇异）；③ 窗口均一化。**结论：MMR·last5 最优，gDPP 不上。**

---

## 6. 结果组装（result.ts）

### 6.1 主入口 assembleResult（[result.ts:245](food-quiz/src/lib/taste/result.ts:245)）

输入 raw profile + 可选 `{seed, dietary, maxAbs, topNDishes}`，输出 `AssembledResult`（归一化向量 + 档位 + 文案 + 推荐菜/菜系）。

### 6.2 256 interval index + 标题去堆砌

- 每维 $v[d] > HIGH\_THRESHOLD=75$ → 高档位（bit=1）。
- **去堆砌**（`MAX_LABEL_DIMS=2`）：高档维 > 2 时，只保留 $|v-50|$ 最大的 2 维定 interval index，避免"浓/嫩"堆砌。
- $HIGH\_THRESHOLD$ 于 P9 从 60 收紧到 75：normalize 相对缩放会把中等维推 >60，导致多维全判高、塌缩到少数 interval（实测 32 样本仅 2 种标题、69% 同标题）；75 后分散到 7 种/最高频 38%。

### 6.3 联动 synergy（Top1+Top2 > 75）

最强的 2 维都 > 75 → 加载 `synergies/<ab>.json`，未命中走 `_fallback.json` 模板（替换 `{a}{b}` 为中文名）。

### 6.4 全能 allround（std < 15）

$std < STD\_ALLROUND=15$ → 8 维都接近 50（中庸型）→ 加载 `allround/_index.json` 随机抽一条。独立分支。

### 6.5 长评价 buildProfileCopy（[result.ts:154](food-quiz/src/lib/taste/result.ts:154)）

一段 ~100 字整体人格定性，由 3 句拼成：

$$profileCopy = overallCopy\ +\ (synergyCopy\ \|\|\ scene句)\ +\ tail句$$

scene/tail 句池按 $highCount$ 分 3 桶（清淡≤1 / 适中2-3 / 重口≥4），用不同散列独立选取避免撞句。所有素材经 humanizer-zh 润色（不走裸文案，CLAUDE.md 铁律）。

### 6.6 推荐菜 MMR 加权抽样（[result.ts:341](food-quiz/src/lib/taste/result.ts:341)）

1. 全菜按 `blendedScore(v, dish.vector)` 评分降序；
2. 取 top 分 $\ge topScore \times MATCH\_RATIO(0.6)$ 作匹配池（池不足退回全量）；
3. 池内按 $weight = score^2$ 加权随机抽 $N=5$ 道（同 seed 确定性），菜名去重。

$score^2$ 权重让高分菜更易命中但不垄断。这取代了早期"纯 top-N"（相似菜扎堆）。

### 6.7 菜系百分比（[result.ts:365](food-quiz/src/lib/taste/result.ts:365)）

每菜系取该系 **top3 菜的 blendedScore 均值**作绝对匹配度 $\in (0,1]$，$\times 100$ 取整为百分比：

$$cuisineScore = \mathrm{mean}\big(\text{top3 } blendedScore\big),\quad percent = \mathrm{round}(cuisineScore \times 100)$$

**关键设计**：用 top3 均值而非全菜系均值——大菜系（川菜，菜多但不全匹配）不被不匹配菜拉低，小菜系特色菜能突围。这是问题二（去中心化）在菜系层的对应修复。

### 6.8 忌口过滤 passesDietary（[result.ts:199](food-quiz/src/lib/taste/result.ts:199)）

9 种忌口，**交集**判定（每条都须满足）：

| 忌口 | 判据 |
|:--|:--|
| no-pork/beef/lamb/chicken | `meatTypes` 含对应肉 → 排除 |
| no-seafood | 含 fish 或 seafood → 排除 |
| no-egg/offal | 标记 === true → 排除（未标放行） |
| vegetarian/halal | 标记 === true 才放行（**未标不放行**） |

过滤后菜数 $< N+2$ 则回退到全 popular 池，保证总有推荐。

---

## 7. 数据加载与校验（loaders.ts）

### 7.1 Vite glob eager（[loaders.ts:6](food-quiz/src/lib/taste/loaders.ts:6)）

```ts
const allJson = import.meta.glob('../../content/**/*.json', { eager: true });
```

编译期内联全部 JSON，零运行时 fetch。

### 7.2 形状校验（静默降级）

每个 `load*` 函数检查返回值的字段类型，**坏形状 → null**（不抛错）：

```ts
if (typeof e.copy !== 'string' || typeof e.label !== 'string' ...) return null;
```

调用端收到 null 走兜底（默认文案 / 空数组 / section 不渲染）。**这是分层铁律的容错基石**——删任一 JSON 不影响其他模块。

### 7.3 兜底链

| loader | 缺失/坏形状兜底 |
|:--|:--|
| `loadInterval` | null → "味觉画像"/"自成一格" |
| `loadSynergy` | 具体文件 → `_fallback.json` → 硬编码 |
| `loadAllround` | null → 不触发全能分支 |
| `loadDishes` | null → 不渲染推荐菜 |

---

## 8. 雷达图绘制（radarChart.ts）

### 8.1 几何

- 8 轴均匀分布：$angle_i = \frac{2\pi i}{8} - \frac{\pi}{2}$（顶轴朝上）。
- 半径 $R = \max(40,\ size/2 - padding)$，$padding=50$（防标签裁切，`d86e426`）。
- 5 圈同心八边形网格（20/40/60/80/100）。
- 数据多边形：朱砂半透明径向渐变填充（中心 0.08 → 边缘 0.22）+ 朱砂描边。

### 8.2 国风色板（对齐 App.css :root）

| 用途 | 色 |
|:--|:--|
| 墨（标签主字） | `#1F1A17` |
| 墨灰（grade 字母） | `#9A8B75` |
| 朱砂（数据） | `#9E2B25` |
| 米纸（底色） | `#F5EFE0` |

### 8.3 标注

每轴双行：上行 grade 字母（墨灰小字，**纯文本无徽章**，`c4fb5a5`）、下行中文维名（墨主字）。`GRADE_COLORS` 保留供 ResultCard CSS 对齐，但雷达图本身不用颜色徽章（P8.3 统一）。

---

## 9. 改动历史（61 commits，2026-06-13 ~ 06-27）

### 9.1 Phase 1 奠基（06-13 ~ 06-14）

| commit | 内容 |
|:--|:--|
| `caf4a91` | 项目初始提交 |
| `1425b65` | 三层算法参考文档 |
| `46473ea`~`a44e7b6` | 味觉基因标签 ABCD-pq → **STKLIXCN 单字母体系**（5 个 plan commit） |
| `e628f5b` | 加 vitest + test 脚本 |
| `a5b2f8e` / `541ebd6` | types.ts / keys.ts |
| `9d0f7a6` | 题库 JSON 形状校验器 |
| `d8930c3` | 200 题题库（8 维覆盖断言） |
| `dca9301` | **单入口自适应选题器**（20–45 题，8 维） |
| `00e3965` | grade A/B/C/D/E 渲染管线 + 5 解耦文案模块 |
| `bf7158b` | 280 文案 + 85 中文菜（Phase 4+5） |
| `1a106a8` | 雷达图 / 去重追问 / sharp-smooth 分层 / jpeg 分享卡 / 去括号 |

### 9.2 P7/P8 多级去重 + 国风（06-17）

| commit | 内容 |
|:--|:--|
| `99ab6fd` | **P7/P8 多级去重引擎** + 菜扩至 196 |
| `cd070ca` | 题库 v6（真实菜品向量） |
| `4003c12` | 题干"啥"→"什么" + 生僻菜换亲民零食 |
| `37d4027` | **国风 editorial 重构** + "吃什么啊"随机菜页 |

### 9.3 修复期（06-18 ~ 06-20）

| commit | 内容 |
|:--|:--|
| `c5bc5dd` | **loaders glob 路径修复**（文案/菜此前全加载为 null） |
| `c6f57e1` | 推荐菜/题库只取日常知名菜 |
| `39b24eb` | 修复"上一题"跳过错位 bug |
| `d86e426` | 雷达图加画布内边距（标签不裁切） |
| `69df620` | 删避雷指南 + 推荐菜加菜系/地区多样性 |
| `32b928f` | **topDishes 改 MMR 多样性选菜**（解决相似菜扎堆） |
| `c9ca57b` | **25–45 动态矛盾追问模型** |
| `8aedcb7` / `e2d17af` | 推荐菜 seed 加权抽样 → 匹配池加权随机 |
| `04b5780` | humanizer-zh 润色后的结果文案 |
| `2b2d3a4` | 雷达图 grade 徽章错位 + 味觉特征 top3 重复修复 |

### 9.4 性能 + 精简（06-24）

| commit | 内容 |
|:--|:--|
| `6cb4b39` | 味觉特征重构为**一段长综合评价** + 文案 humanize |
| `93ae269` | selector 优化至**平均 ~33 题** |
| `c4fb5a5` | radar 标签裁切修复 + 国风重构 |
| `6d3f80c` | **精简 CLAUDE.md/README，移除 algorithm.md/pro.md/技术栈.md** |

### 9.5 忌口 + 菜系（06-26）

| commit | 内容 |
|:--|:--|
| `1a2d633` | **忌口探测 + 菜系百分比 + 题库去重阔题 + 分享卡菜系区** |
| `50b145f` | 库外选项频次超限清理（29 项降到 ≤2） |

### 9.6 多样性闭环（06-27，本工作）

| commit | 内容 |
|:--|:--|
| `ea65cac` | **A1 集中度护栏 + 自适应多样性 + 分层修复 + 推荐匹配去中心化**（问题二 blendedScore 改 cen） |
| `b6b16fb` | **P10 选题去冗余度量去中心化**（先决：sig 0.801→cen 0.498，阈值重标） |
| `41f356c` | **P11 MMR 连续去冗余 + SH 频次衰减**（后期高相似 29.3%→3.5%；within Jaccard 0.087→0.004） |
| `21499ae` | docs：补 §11 当前问题与算法瓶颈（5 项瓶颈分类） |
| `6d71ed5` | **Merge main 温度维 Step1 进 P10/P11 线**（69e0c20 bitter→temperature 合入；机制B 触发率 56%→40.6%，基线断言 0.45→0.40） |
| `673f686` | docs：全文同步温度维（§2/§4/§5/§11 + 附录B） |

---

## 10. 参数总表

### 选题（adaptiveSelector.ts）

| 参数 | 值 | 标定依据 |
|:--|:--|:--|
| `MIN/MAX_QUESTIONS` | 25 / 45 | 产品定义 |
| `PRUNE_THRESHOLD` | −30 | 极度排斥剪枝 |
| `EXACT_DEDUP_THRESHOLD` | 0.95 | cen p95=0.949 |
| `COVER_OVERLAP_THRESHOLD` | 3 | 维度重合 |
| `TOPIC_OVERLAP_THRESHOLD` | 0.80 | cen p73≈0.815（MMR 硬线） |
| `MMR_DIV_WEIGHT` | 0.6 | §5.5 标定 |
| `MMR_HARD_FLOOR` | 0.3 | 对齐原离散 ×0.3 |
| `GLOBAL_DEDUP_WINDOW` | 10 | 同题去重窗 |
| `STEM_DEDUP_SOFT_PENALTY` | [1,.3,.1,.03,.01] | stem 频次 |
| `STEM_DEDUP_LATE_DOUBLE_PENALTY` | 0.3 | 后期≥20 题 + stem≥2 |
| `SESSION_SOFT_PENALTY` | 0.7 | SH 频次衰减底 |
| `EARLY_DIV_WEIGHT` | 0.5 | 扫描谷底（§5.9） |
| `EARLY_STD_SCALE` / `EARLY_COVERAGE_SCALE` | 35 / 300 | 归一化上限 |
| `EARLY/LATE_SMOOTH/SHARP_RATIO` | 0.6 / 0.6 | 犀利度分层 |
| `LOW_RESPONSE_WINDOW` | 5 | recent / MMR 窗口（§5.10 证为甜区） |
| `THEME_SIM` | 0.6 | 追问同主题（保留 sig） |
| `INCONSISTENCY_GAP` | 0.45 | 追问机制 A |
| `STRONG_W` / `WEAK_W` | 18 / 5 | 追问机制 B |
| `CLARIFIED_ABS` | 140 | 追问收敛 |
| `COVERAGE_FLOOR` / `BANK_MIN_DENSITY` | 180 / 25 | 追问机制 C |
| `TOP_K` | 12 | 候选池 |

### 结果（result.ts）

| 参数 | 值 | 含义 |
|:--|:--|:--|
| `HIGH_THRESHOLD` | 75 | 判高档（P9: 60→75 收紧） |
| `MAX_LABEL_DIMS` | 2 | 标题去堆砌 |
| `STD_ALLROUND` | 15 | 全能文案触发 |
| `MATCH_RATIO` | 0.6 | 推荐菜匹配池下限 |
| `DEFAULT_TOP_N_DISHES` | 5 | 推荐菜数 |

### 其他

| 参数 | 值 | 位置 |
|:--|:--|:--|
| `MAX_SESSIONS` | 3 | sessionMemory 滚动窗 |
| profile 初始 `temperature` | 0 | state.ts（无偏置） |
| 雷达 `padding` | 50 | radarChart.ts |

---

## 11. 当前问题与算法瓶颈

算法层的选题多样性（问题一）与区分度（问题二）已闭环，但仍有若干**结构性瓶颈**。本节按"算法可改进 / 算法不可解"分类，指出后续优化的真实着力点与天花板——区分二者比给"解法"更重要。

### 11.1 瓶颈 ①：MMR 作用域与 session 长度分布错配（核心）

**现象**：P11 的 MMR 连续去冗余只在**后期**（$count \ge 25$）分支生效；早期（$count < 25$）分支的评分（§5.9）**无 topicPenalty**，仅靠离散的 exact/cover dedup + stem 频次 + std/coverage/jitter 打散。

**错配**：
- session 长度分布两极：**一致画像**（多数用户，口味明确）在 $count=25$ 即无追问维 → `shouldStop` 立即停；**矛盾/波动**画像追问至 30–45。
- 全局平均 ~33 题（`93ae269`），但中位数偏低——相当比例的 session 在 25 题停，**MMR 完全不触发**。
- 即便 33 题的 session，MMR 也只覆盖第 26–33 题（~8 题）；**前 25 题（每个 session 都有的主体、用户感知最强区段）反而去冗余最弱**。

**数值证据**：真实停止（用 `shouldStop`）下测量后期邻对样本量仅 **4**（3 画像 × 8 seed 贴画像，`_mmr-calib` 首版），证明后期段在多数 session 中近乎不存在；MMR 的"后期高相似 29.3%→3.5%"是在**强制 MAX** 下才观测到的。

**性质**：算法架构错配，**可改进**。潜在方向：把 MMR（或等价的 max-sim 连续惩罚）**下沉到 early 分支**——前 25 题同样有换皮/同质风险且是主体体验。需重标定 early 的 diversity 权重与 std/coverage 协同，避免压过犀利度分层。

### 11.2 瓶颈 ②：集中度的固有天花板

**现象**：集中度实测 0.63，护栏 $\le 0.7$，无法进一步显著降低。

**根因**：`weightedPick` 的 top-12 加权采样（Randomesque 曝光控制）——`TOP_K_WEIGHTS = [0.15, 0.13, …, 0.05]` 让前 12 题都有可观命中概率，最高频题天然落到 ~60%+。这是"曝光控制"与"贪心选最优"的刻意折中。

**性质**：帕累托边界，**不宜单边突破**。要更低集中度需 top-8 或更陡权重，但会牺牲信息增益（相关性下降）。当前 0.63 是平衡点。

### 11.3 瓶颈 ③：温度维探索的算法不可达（换维未解，只换皮）

**现象**：追问机制 C（覆盖度不足）跳过 `BANK_MIN_DENSITY < 25` 的维度 → 温度维（题库密度 ≈ 24.8）**永不追问**，`COVERAGE_FLOOR`/`CLARIFIED_ABS` 对温度维形同虚设。

**换维背景**：Phase B Step1（69e0c20）将苦维（密度 ≈ 14.4）替换为温度维，动机是苦维区分度低、数据稀疏。但温度维**刻意采用稀疏+小值策略**（密度 24.8，仍 < 25），"与原苦维对称被机制 C 跳过，保持选题动力学稳定"（69e0c20 message）。

**根因**：这是**产品语义决策，不是对瓶颈 ③ 的算法解**。换维只把"被跳过的维"从苦换成温度——稀疏维被机制 C 跳过的结构性问题**原样存在**。题库温度维信号密度不足（数据层制约），算法无法弥补"题不够"导致的画像模糊。

**性质**：**数据层制约算法**，算法侧不可解。需扩充温度维题库（content 层）至密度 ≥ 25 才能让机制 C 覆盖温度维；或接受该维不参与追问、仅由初始题目被动采集。

### 11.4 瓶颈 ④：全局 joint 多样性的架构性缺失（已接受）

**现象**：gDPP 经 12 配置实证否决（§5.10），"全 session 联合多样性"在当前架构（短窗口 $w=5$ + 多层 local 去重）下无优化空间。

**性质**：**非缺陷**（实验证明不需要），但是架构性限制——若未来题库爆增（>500）或窗口架构改变，需重新评估 gDPP / RBF kernel。当前接受为闭环。

### 11.5 非 算法瓶颈：文案层同质化（数据层，最高 ROI）

**现象**：题干模板化占比 45%，2 个固定高频模板各 13 题（"饿急了眼前…"、"…让你删一个"）。

**性质**：**算法无法解决**——选题再分散，题干句式雷同仍让被试感到同质。归属 `content/questions.json`，需走 humanizer-zh + 既定脚本 pipeline（CLAUDE.md 铁律）。

**与算法瓶颈的对照**：§11.1 是"算法可改进但未做"，§11.5 是"算法不可解须转数据"。后者是用户原始反馈"题目同质化严重"的真正落点。

### 11.6 瓶颈优先级

| 瓶颈 | 性质 | 可改进性 | ROI |
|:--|:--|:--|:--|
| ① MMR 作用域错配 | 算法架构 | ✅ 可（下沉 early） | 中（改善主体体验） |
| ② 集中度天花板 | 算法取舍 | ⚠️ 帕累托边界 | 低（已平衡） |
| ③ 温度维不可达 | 数据制约 | ❌ 需扩题库 | 中（数据层） |
| ④ joint 缺失 | 已接受闭环 | — | — |
| ⑤ 文案同质化 | 数据层 | ❌ 需 humanizer | **高**（用户原声） |
| ⑥ early 犀利度锁死 | 算法架构 | ⚠️ 待评估 | 中（降集中度需重构 early） |

> **结论**：算法层唯一值得动手的是**瓶颈 ①（MMR 下沉 early）**——它是"已优化区段（后期）与主体体验区段（前期）错配"的设计缺陷，而非帕累托边界。其余要么是刻意取舍（②）、数据制约（③⑤）、已闭环（④）、派生待评（⑥）。**§11.7 三阶段实验已实证**：MMR 下沉 early（硬过滤形态）早期邻对 cen −32% 且准确度近乎免费；gDPP 二次否决；集中度 conc=1 是 early 犀利度分层硬约束（瓶颈⑥）。

### 11.7 三阶段甜区实验（目标函数翻转：体验为主，准确度为成本）

**动机**：趣味测试的"结果"是性格标签 + 分享卡，非临床诊断，用户对 ±10% 画像偏差无感，但对"邻题雷同 / 跨次同题"直接感知且反感。故将目标函数从"准确度为主、多样性为约束"翻转为"体验为主、准确度为成本"，找甜区。

**方法**：3 stage 一次性 `_stage{1,2,3}-exp.test.ts`（forceMax+wobble，5 画像 × 8 seed = 40 session/cfg，测完即删）。指标：acc=cos(normalize(profile),normalize(target))↑好、conc=单题最高出场率↓好、earlyCen/lateCen=邻对 cen↓好。

#### Stage 1：MMR scope × early diversity 量级

扫描 MMR scope {late(现状) / both(下沉 early)} × earlyDivScale {2,5,10}。**关键发现：early 评分被 `sw*10` 犀利度分层锁死，乘性 topicPenalty 与 diversity 量级旋钮均无效（6 格数据全同）；唯有把 MMR 做成 early 的硬过滤（top-K 内剔除与 recent cen≥0.80）才生效。**

| cfg | acc | dAcc | earlyCen | dEarly | lateCen |
|:--|:--|:--|:--|:--|:--|
| late/scale2（≈现状） | 0.9529 | — | 0.5135 | — | 0.5213 |
| **both/scale2（MMR 下沉 early 硬过滤）** | **0.9547** | **+0.0018** | **0.3478** | **−0.1657（−32%）** | 0.6538 |

- **早期邻对 cen −32%，准确度几乎免费**（+0.0018，印证"早期 profile≈0，换多样性无成本"）。
- **副作用：lateCen 恶化 +25%**（0.5213→0.6538）——early 硬过滤改变 askedIds 序列，late 的 MMR 反而更难压。需 late 也用硬过滤（Stage 2 已做）。
- **scale 旋钮无效**：early diversity 不能靠加权，只能靠硬排除。

#### Stage 2：gDPP 干净重评（用户点名项）

在 both 配置上对比 diversity 方法 {MMR·last5 / gDPP-cen / gDPP-rbf}，penalty 同斜率 0.6 公平对比，early+late 都用硬过滤让 diversity 发力。

| method | acc | earlyCen | lateCen |
|:--|:--|:--|:--|
| **mmr** | **0.9602** | 0.3433 | **0.3415** |
| gdpp-cen | 0.9602 | 0.3433 | 0.3415 |
| gdpp-rbf | 0.9564 | 0.3388 | 0.5686 |

- **gDPP-cen 与 MMR 完全相同**——cen kernel 下 proj energy 极小，gain≈0，penalty≈1，等效无惩罚。**实证度量病态**（§5.10 诊断②复现）。
- **gDPP-rbf 负优化**：lateCen +66%（0.3415→0.5686），acc 还降 0.0038。RBF kernel 把太多有用候选误剔。**换度量救不活 gDPP，反劣化**（诊断③确认）。
- **结论：gDPP 不上，MMR 够用**。MMR·last5（硬过滤形态）early+late 双低、acc 最高，是甜区 diversity 方法。

#### Stage 3：TOP_K × 权重陡峭度（集中度扫描）

扫描 TOP_K {8,12,16} × shape {flat/current/steep}，基于 MMR early+late 硬过滤配置。

| cfg | acc | conc | earlyCen | lateCen |
|:--|:--|:--|:--|:--|
| K12/current（≈现状） | 0.9602 | **1** | 0.3433 | 0.3415 |
| K16/flat（最平） | 0.9619 | **1** | 0.3360 | **0.2903** |
| K8/steep（最陡） | 0.9599 | **1** | 0.3989 | 0.3322 |

- **conc=1 在 9 格全不变**——集中度对 TOP_K/权重陡峭度**完全无响应**。acc 波动 ±0.002（噪声级）。
- **根因**：conc=1（某题 40/40 session 全命中）是 **early `sw*10` 犀利度分层 + 题库结构**决定的——某些题（如 q1）在几乎所有 session 前几题都被需要以建立基线。**采样权重旋钮无效**，要降集中度得动犀利度分层本身或题库。
- lateCen 有微弱规律：更平的采样（K16/flat）让 late 段更多样（0.2903），但这是邻对 cen 微调，集中度纹丝不动。

#### 三阶段综合结论

1. **甜区 diversity = MMR·last5 硬过滤形态，early+late 都用**（Stage 1+2 联合）。早期邻对 cen −32%、准确度近乎免费；lateCen 经 late 硬过滤也压到 0.34。
2. **gDPP 实证否决（第二次）**：cen 病态、rbf 负优化，换度量救不活。MMR 够用。
3. **集中度 `conc=1` 是 early 犀利度分层 + 题库结构的硬约束**，非采样可解——比 §11.2 的 0.63 天花板更极端（forceMax 下冲到 1.0）。要降集中度需重构 early 犀利度分层（让基线建立题更多样）或扩题库，属新瓶颈⑥。
4. **准确度代价在任何 diversity 配置下都 <0.002**（近乎免费）——目标函数翻转的可行性得到验证：体验提升的代价远低于预期。

> **新瓶颈⑥（待评估）**：early 犀利度分层 `sw*10` 锁死选题，使集中度冲到 1.0、diversity 量级旋钮无效。若要进一步降集中度，需把 early 的"犀利度主导"改为"犀利度+多样性联合"，或扩充基线建立题的题库多样性。这是 Stage 1 发现的派生瓶颈，ROI 待估。

#### 落地复核（commit 860e812）：early 硬过滤伤追问，暂缓；late 落地

§11.7 三阶段结论（early+late 都用硬过滤）在 forceMax+wobble 画像下成立，但工程化落地到 quiz-simulation（closestTo + 追问机制）时暴露盲区：

- **盲区**：§11.7 指标只有 acc/conc/earlyCen/lateCen，**未测追问触发率**（pursueRate）。forceMax 画像始终选最强烈选项、无摇摆，追问机制不触发，故 early 硬过滤的追问代价不可见。
- **early 硬过滤实测伤追问**：early 分支硬剔除"与 recent cen≥0.80"的同维候选，误杀摇摆画像机制B 所需的**同维二次探测**——摇摆画像 step%5 用 closestTo 选 spicy 强题 q_a，下次本应再选同维 q_b 形成"先强后弱"波动信号，但 q_a/q_b 同维→cen≥0.80→q_b 被 early 硬过滤误杀→spicy 维只有单次强表态、无强-弱对比→机制B 哑火。实测 pursueRate **41%→28%**、mean 27.4→26.2。
- **结构性冲突**：同维追问题与换皮题在 topicVector cen 上无法区分（都 cen≥0.80），非调阈值能轻易调和——除非阈值高到只剔真正换皮（cen≥0.95），但那样 earlyCen 降幅有限。
- **late 硬过滤无回归**：late 不改 profile/pursue 状态（pursue.size 由 early 积累的 profile 决定），只影响 ≥25 题后选题序列，故 quiz-simulation 三数全持平（平均 27.4 / 机制B 41% / 重复 0）。late 收益（降 lateCen）沿用 §11.7 forceMax 实证，closestTo 下未单独量化。

**决策**：early 硬过滤暂缓（留任务③ A 判据实验定可行阈值/条件，或确认⑥需根因解①）；late 硬过滤落地（`mmrHardFilter` helper，与乘性 topicPenalty 叠加）。**§11.7"earlyCen −32% 近乎免费"修正为：仅在无追问机制的画像下成立；closestTo+追问语境下 early 多样性的代价是 pursueRate −13pp。**

### 11.8 外部方案评审：有效候选方向

外部《自适应测评系统算法优化方案》评审（docx，2026-06-27）。方向与三阶段实验趋同，但核心公式（乘性 λ·penalty）、删 early/late 分支、α/SE 临床指标已被 §11.7 证伪或不适用，不采纳为实施依据。抽出仍有效的 5 点，按 ROI 排序纳入后续候选：

#### 候选 A（高 ROI）：跨 session 热度曝光硬帽 — 直击瓶颈⑥

> 源自 §4.2.2「题目热度排行榜 / 曝光上限，达上限后自动降权」

**问题**：Stage 3 实测 conc=1（某题 40/40 session 全命中），且 TOP_K/权重陡峭度旋钮全无效——early `sw*10` 锁死。P11 SH 的软衰减（`0.7^freq`）对 conc=1 不够：freq=3 时惩罚 0.34，仍能被 top-1 抽中。

**方案**：在 SH 之上加**硬帽**——最近 N 轮（sessionMemory 滚动窗）出场 ≥ K 次的题，本轮禁选或强降权至 0。硬帽强制让位，绕过 early 评分锁死。

**与 SH 区别**：SH 是乘性软衰减（仍可抽中），硬帽是硬排除。两者可叠加：软衰减压频次、硬帽兜底禁选。

**落地**：第 3 层 sessionMemory 扩 `loadHotIds(K)` 接口 + adaptiveSelector 接 `hotIds: ReadonlySet<string>` 参数，在 pool 过滤阶段排除。不动第 1 层纯函数契约，三件套可验。**Stage 3 之后唯一没试过的降集中度杠杆**。

#### 候选 B（高 ROI）：stem 主题级衰减 — 直击瓶颈⑤

> 源自 §4.2.1「引入主题级衰减，避免同一主题下的不同题目被过度抑制」

**问题**：P11 SH 只按题 id 衰减。同 stem/主题的不同变体（如"饿急了眼前…"13 道模板）每题 id 频次低、不被惩罚，但用户感知到的是**主题重复**——与 §11.5 文案同质化（45% 模板化）同源。

**方案**：sessionMemory 除记 askedIds，再记 stem 频次；选题时 stem 频次也施 `0.7^freq` 衰减，与题 id 衰减叠加。

**落地**：sessionMemory 扩 `loadRecentStemCounts()`；adaptiveSelector 的 `recentCounts` 旁加 `recentStemCounts` 参数，评分乘 `SESSION_SOFT_PENALTY ** stemFreq`。第 3 层 + 接口扩展，不动第 1 层。**瓶颈⑤的算法侧补丁**（文案侧仍需 humanizer）。

#### 候选 C（中 ROI）：题库主题标签体系 — 基础设施

> 源自 §5.2.1「建立题目主题标签体系，便于多样性控制」

**价值**：当前去重靠 `topicVector`（向量级 cen），但"主题"是更粗粒度（不同向量同模板）。加显式 stem 标签为候选 A/B 提供锚。

**注意**：新增 content JSON 字段须确认 loader 形状校验（§7.2）仍过——坏形状静默降级 null，不报错。属 content 层 + loader。

#### 候选 D（中 ROI）：扩充温度维题库（含基线重标） — 解瓶颈③

> 源自 §5.2.1「重点扩充温度维等低密度维度的题目数量」

**陷阱**：Phase B Step1（69e0c20）**刻意**把温度维密度保持 24.8 < 25，"与原苦维对称被机制 C 跳过，保持选题动力学稳定"。扩密度 → 机制 C 开始追问温度维 → quiz-simulation 基线（mean 26-36、机制B ≥40%）需重标。非单纯加题，是连带重标。方向认可但成本不小。

#### 候选 E（低 ROI）：相似度矩阵预计算 — 性能优化

> 源自 §5.3.2「预计算题目相似度矩阵 / 缓存常用计算结果」

**现状**：`BANK_DENSITY` 已是此思路局部应用；性能基线已达标（`93ae269` ~33 题），无实测瓶颈。题库扩至 500+（多模态方向）才真正需要。**低优先**。

#### 证伪 / 不采纳（评审记录）

| 外部方案点 | 处置 | 原因 |
|:--|:--|:--|
| §4.1.1 乘性 λ(count)·MMR_Penalty | ❌ 证伪 | Stage 1 实测 6 格全同，被 sw*10/gain 淹没；需硬过滤 |
| §5.3.1 删 early/late 硬分支 | ❌ 危险 | 会破坏犀利度分层（§5.2），丢 CAT 核心机制 |
| §7.2 α系数/SE/临床意义 | ❌ 不适用 | 本项目趣味测试，无 CTT/IRT 建模，不可计算 |
| §5.2.2 LLM 裸扩写 | ❌ 违规 | 违反 humanizer-zh + 脚本 pipeline 铁律（CLAUDE.md） |
| §9.2 多模态测评 | ❌ 超界 | 超出零网络纯前端味觉测试定位 |

### 11.9 外部评审（范式级）：不确定性建模方向

外部算法评审（2026-06-27，Adaptive Testing / Active Learning / Recommendation / Diversity / Information Theory 五视角）。评审比 §11.8 的方案高一层级——不再在现有框架内调参，而指出**框架本身的定义缺陷**。工程质量★★★★★、算法设计★★★★☆、学术创新★★★☆☆（有提升空间）。判断当前已进入第二阶段（"如何减少提问同时提升体验"），局部策略（MMR/Penalty/Threshold）收益已下降，下一阶段应转向**不确定性建模**。

#### 核心诊断：gain 不是真 Active Learning（评审优先级①，且同时解瓶颈⑥）

当前 `gain(q)=Σ|profile[d]|·|w[d]|`（§5.3）本质是 **Weight-based Greedy Selection**——"继续强化已有偏好"，而非"优先确认未知偏好"。

**评审点出的盲区**：profile 仅维护 μ，无 σ，故无法区分：
- Case A：辣=+100 来自 **10 道一致回答**（高置信）
- Case B：辣=+100 来自 **1 道极端题**（低置信）

二者当前完全等价，可信度却天差地别。

**建议**：profile 从 `mean` 升级为 `mean + variance + sampleCount + confidence`；每题估计 **Expected Posterior Variance** 或 **Expected Entropy Reduction**，选 ΔVariance 最大而非 Gain 最大。CAT 真正进入 Active Learning 范畴。

> **本项目校准——评审未点破的最大价值**：此方向**同时解瓶颈⑥**。§11.7 卡在 early `sw*10` 锁死、diversity 旋钮全无效，根因表面是犀利度主导，真正根因是 **early profile≈0 时 `Σ|profile|·|w|` 也≈0 退化均匀** → 早期无信息驱动信号 → 只能靠 `sw*10` 兜底。改用 Variance Reduction 后，early profile≈0 时**不确定性最大**，gain 不退化，diversity 项自然有发力空间。**优先级①不只是新方向，是瓶颈⑥的根因解**。

#### 其余方向（评审建议 + 本项目校准）

| 方向 | 评审 | 本项目校准 |
|:--|:--|:--|
| **Lookahead/Beam Search**（模拟未来 2-3 步） | ★★★★★ 有论文价值 | ⚠️ 是①的**下游**——"未来收益"需基于不确定性模型才定义得清；先做①，②才有意义。单独做②会沿用错误的 gain。且 214 题 × beam 成本对单次趣味测试收益未必划算，需先量化 |
| **Thompson Sampling**（Question Reward + 在线探索） | ★★★★ 长期在线 | ⚠️ 需校准：本项目是**单次 25-45 题**趣味测试，无跨题 Reward 闭环；"在线学习"更适合多轮长期系统。单次 session 内 Thompson 信号弱，降级 |
| **Candidate Topic Cluster**（题→Cluster→每簇保留若干→MMR） | ★★★★ 降重复感 | ✅ **独立有效，可先做**：呼应 Stage 3"conc=1 是题库结构决定"。Cluster 比 topicVector cen 稳定，且不依赖①，可立即试 |
| **Quality-Diversity DPP**（kernel $L_{ij}=q_i q_j s_{ij}$，q=InfoGain） | ★★★ 值得实验 | ⚠️ **与 Stage 2 结论有张力**：Stage 2 证 cen 度量病态、rbf 负优化；QD-DPP 若用 cen 继承病态，用 rbf 已被证负优化。除非 Quality 项改变数值结构——不确定，需专门实验，**不能假设它绕过了我们的实证否决**，预期偏负面 |
| **Session EMA**（`EMA←0.95·old+0.05·appear`，`×1/(1+EMA)`） | ★★★ 工程优化 | ✅ 合理：0.7^freq 滚动窗有边界效应，EMA 更平滑。ROI 中等，独立可做 |
| MMR 参数微调 | ★ 极低 | ✅ 共识停（§11.7 已停） |

#### 本项目优先级（校准后）

| 序 | 方向 | 评审 | 本项目 | 理由 |
|:--|:--|:--|:--|:--|
| 1 | 不确定性建模（profile 加 σ，gain 改 Variance Reduction） | ★★★★★ | **★★★★★** | 评审核心，且**同时解瓶颈⑥**——优先级比评审所述更高 |
| 2 | Candidate Topic Cluster | ★★★★ | **★★★★** | 独立于①可先做，直接降 conc |
| 3 | Session EMA | ★★★ | **★★★** | 工程改进，顺手 |
| 4 | Lookahead | ★★★★★ | **★★** | 是①下游，不能先于①；成本/收益需量化 |
| 5 | QD-DPP | ★★★ | **★★** | 继承 Stage 2 否决张力，需重评，预期负面 |
| 6 | Thompson | ★★★★ | **★** | 单次趣味测试适用性存疑 |

#### 两点保留意见

1. **定位克制**："学术创新有空间"准确，但本项目是趣味测试非研究系统。不确定性建模/Lookahead 方向对，但目标仍是"用更少题、更准、体验更好"，非发论文。Lookahead 的实现成本（214 题 × beam 2-3 步）对单次测试收益未必划算，需先量化再决定是否投入。
2. **QD-DPP 诚实**：评审称"白皮书否决的是 Pure Diversity DPP"——对，但 Stage 2 连 gDPP-rbf 都否了（负优化）。QD-DPP 把 gain 放进 kernel **可能**改变数值结构，也**可能**继承 cen 病态。不能因名字多了"Quality"就假设它绕过实证否决；值得一次专门实验，但预期偏负面。

> **结论**：评审核心诊断（gain 非真 Active Learning）成立，且**可能同时解 §11.7 卡住的瓶颈⑥**——这是评审最大的、连它自己都没点破的价值。下一阶段真正值得投入的是**不确定性建模**：profile 加 σ、gain 改 Expected Variance Reduction。这不是又一个局部优化，是把项目从"经验驱动"升到"概率驱动"的范式转换。Candidate Cluster 可独立先做，EMA 可顺手，Lookahead/Thompson/QD-DPP 需校准或依赖①先行。

### 11.10 两份外部方案综合评估与瓶颈-方案映射

§11.8（方案一，改进）与 §11.9（方案二，重构）非并列候选，而是**层次递进**：方案一在现有框架内打补丁（动 sessionMemory 接口 / pool 过滤 / stem 衰减），方案二换框架定义本身（动 `gain` 与 `profile` 数据结构）。两份方案真正交叠的只有**瓶颈⑥**一个，其余各管各的（③归 D，⑤归 B/C/humanizer，①②④都不归）。

#### 11.10.1 两路径定性

| | 方案一（§11.8 改进） | 方案二（§11.9 重构） |
|:--|:--|:--|
| 层级 | 框架内调参/补丁 | 换框架定义本身 |
| 动什么 | sessionMemory 接口、pool 过滤、stem 衰减 | `gain` 定义、`profile` 数据结构 |
| 瞄准 | 症状指标（conc、跨次主题重复） | 根因（early gain 退化均匀） |
| 对瓶颈⑥ | 绕过（硬排除霸榜题） | 解根因（让 gain 不退化） |
| 第 1 层契约 | 不动 | **动**（profile 加 σ） |
| 成本/风险 | 低/低 | 高/高 |

**核心张力**：两条路径都瞄准⑥，但一个治症状、一个治根因。方案一能压症状指标但**解不了根因**——没有一个候选触及 `gain=Σ|profile|·|w|` 的定义，A 只是在 gain 退化时靠硬排除换题，根因仍在，且 A 天花板受题库结构限（压掉 q1 霸榜 → 可能转移至次优基线题）。方案二是唯一根因解，但有 σ 不可用合成 target 验证的方法论隐患。

#### 11.10.2 瓶颈-方案映射矩阵

| 瓶颈 →<br>方案 ↓ | ① MMR 作用域 | ② 集中度 0.63 | ③ 温度维不可达 | ④ joint 缺失 | ⑤ 文案同质化 | ⑥ early sw 锁死 |
|:--|:--:|:--:|:--:|:--:|:--:|:--:|
| A 热度硬帽 | — | ◐ 不对症 | — | — | — | ◐ 绕过 |
| B stem 衰减 | — | — | — | — | ◐ 缓解 | — |
| C 主题标签 | — | — | — | — | ◐ 使能 | — |
| D 扩温度维 | — | — | **✓ 根因** | — | — | — |
| E 矩阵预计算 | — | — | — | — | — | — |
| ① 不确定性建模 | — | ◐ 间接 | — | — | — | **✓ 根因** |
| ② Lookahead | — | — | — | — | — | — |
| ③ Thompson | — | — | — | — | — | — |
| ④ Candidate Cluster | — | ◐ 间接 | — | ◐ 重评 | — | ◐ 结构层 |
| ⑤ Session EMA | — | — | — | — | ◐ 间接 | — |

图例：**✓ 根因解**（治本）／**◐** 部分/间接/缓解／**—** 无关

**关键观察**：六个瓶颈里只有 **③（D）** 和 **⑥（①）** 有根因解；①（MMR 作用域）已被 §11.7 闭环、②（集中度 0.63）是帕累托边界、④（joint 缺失）已接受闭环——**这三个无任何方案对应，也不该有**。所有改进动作实际集中在 ③⑤⑥ 上。②（0.63，真实停止+top-12 采样）与⑥（1.0，forceMax+sw 锁死）语境不同，A/①/Cluster 瞄准的是⑥的 1.0 不是②的 0.63。

#### 11.10.3 瓶颈⑥的三方对应（抉择焦点）

| 方案 | 层级 | 治症/治本 | 依赖 | 天花板 |
|:--|:--|:--|:--|:--|
| A 热度硬帽 | 跨 session 硬排除 | 治症（绕过 sw） | 无 | 受题库结构限，可能转移霸榜 |
| ① 不确定性建模 | gain/profile 定义 | **治本** | σ 模型设计 + A 判据 | 根因解，但 σ 不可验证 |
| ④ Candidate Cluster | 题库结构层 | 治症（换粒度） | 无 | 独立可先做 |

A 与①的关系：A 可作①必要性的**判据实验**——A 能压 conc 且 acc 不崩 → ⑥可硬解、①降级；A 压不动或 acc 崩 → ⑥是根因层、①必要。Cluster 是不论 A 成败都值得独立做的第三条路（呼应 Stage 3"conc=1 是题库结构决定"，在簇粒度打散，比 topicVector cen 稳定）。

#### 11.10.4 优先级排序（三档）

按"是否需要先决条件"分档。**文案/扩题类（B/C/D/humanizer）居中**——排在需先决条件的范式重构之前，排在无需先决条件的探针/独立改进之后：到上①时，文案/扩题等"非算法地基"改进已收口，①的重标窗口可顺带把 D 的温度维重标一并完成。

| 档 | 序 | 动作 | 路径 | 解瓶颈 | 先决条件 |
|:--|:--|:--|:--|:--|:--|
| **一：探针/独立<br>（无需先决，先做）** | 1 | A 热度硬帽（判据实验） | 改进 | ⑥ 治症 | 无；**结果决定是否上①** |
| | 2 | Candidate Cluster | 改进 | ⑥ 结构层 | 无 |
| | 3 | Session EMA | 改进 | ⑤ 间接 | 无 |
| **二：文案/扩题<br>（数据层收口，中做）** | 4 | B stem 衰减 | 改进 | ⑤ 跨次缓解 | C 的主题标签 |
| | 5 | C 主题标签（含 loader 校验） | 改进 | ⑤ 使能 | 无；B/A 的脚手架 |
| | 6 | humanizer（⑤文案层根治） | 数据 | ⑤ 根治 | 走脚本 pipeline |
| | 7 | D 扩温度维题库 | 改进 | ③ 根因 | 重标窗口与①合并 |
| **三：需先决条件<br>（范式重构，后做）** | 8 | ① 不确定性建模 | 重构 | ⑥ 根因 | A 判据支持 + σ 模型有据可依 |
| | 9 | Lookahead | 重构 | — | ①先行 |
| | 10 | Thompson | 重构 | — | 单次测试适用性校准 |
| | 11 | QD-DPP | 重构 | ④ 重评 | 专门实验，预期负面 |

**档间约束**：第二档的 D（扩温度维）会触发 quiz-simulation 基线重标（密度过 25 → 机制 C 追问温度维），与第三档①改 gain 的重标同性质——**D 的重标应推迟到①窗口合并完成**，故 D 虽排第二档但其重标动作挂在第三档。若 A 判据显示⑥可硬解、①不上，则 D 独立重标。

**①的前置闸门**：上①前须先回答"σ 凭什么有据可依"——若只能给启发式 `confidence=n/10`，则①退化为换皮 `sw*10`，不值得动地基；此时第二档（A+B+C+D+humanizer）即为终点，诚实接受⑥的天花板。σ 不可用合成 target 验证（合成 target 无真不确定性），这是①最大软肋，须在 A 实验期间并行思考。

#### 11.10.5 落地路径

1. **第一档**：起 A 判据实验（验证热度硬帽能否压 conc 从 1.0、acc 是否崩、消除还是转移）+ Cluster 试做 + EMA 顺手。A 结果**直接决定第三档①是否启动**。
2. **第二档**：C 先行（B 的脚手架，盯 loader schema）→ B（stem 衰减）→ humanizer（⑤根治）→ D（扩题，重标挂第三档窗口）。
3. **第三档**：据 A 结果 + σ 闸门分叉——A 成功或 σ 无解 → ①降级，第二档收口为终点；A 失败 + σ 有解 → 上①，全基线重标（顺带 D 温度维重标），Lookahead/Thompson/QD-DPP 视①结果再议。

> **结论**：方案一是"在错误的 gain 上做工程优化"，能压症状但解不了根因；方案二是"换地基"，根因解⑥但有 σ 不可验证隐患。用方案一的 A 当探针判方案二①的必要性——把两条路径串成一条决策链而非各做各的。文案/扩题类改进居中：在探针/独立改进之后收口数据层，在范式重构之前清场，使①的重标窗口可一次性吞下 D 的连带重标。

### 11.11 外部 docx 四方案综合评估（仅记有效增量与证伪实证）

外部《food-quiz 算法改进与重构方案评估》docx（2026-06-27）提 4 个新颖重构方案。综合评估后，3 个不采纳（前提证伪或已否决），仅方案 1 的一个技术增量有效。本节只记有效部分与关键证伪实证，不展开已否决方案。

#### 11.11.1 温度维独立性实证——证伪 DTC/DNA 的 culinary 前提（强化 §11.3）

方案 2（DTC 双池温度补偿）与方案 4（DNA 动态叙事）共同依赖"温度维与其他维存在强 culinary 相关"（如辣-烫、酸-凉、浓-烫）。在 214 题题库上算 topicVector 维间 Pearson 相关，**温度维 H 与所有其他维 \|r\| < 0.19**：

| 维对 | r | 维对 | r |
|:--|:--|:--|:--|
| H-T(sweet) | −0.185 | H-S(sour) | −0.088 |
| H-C(crunchy) | −0.169 | H-N(tender) | +0.077 |
| H-X(rich) | +0.048 | H-L(spicy) | −0.048 |
| H-I(salty) | −0.035 | | |

- **DTC 前提证伪**：$K_{d,H}\approx 0$ → 推断项 $\lambda\sum K_{d,H}(\mu_d-50)\approx 0$ → 等于没补偿。用其他维推断温度在题库上无据可依。
- **DNA 前提证伪**：culinary 模式"L-H 正相关"题库实测 −0.05；关系模式匹配无相关结构支撑。
- **根因**：Phase B Step1（69e0c20）刻意把温度维密度压到 24.8<25，稀疏化使温度维既不被机制 C 追问（§11.3），**也与其他维失去相关结构**——这是 §11.3"数据层制约"的延伸：温度维太稀疏，连"用其他维推断"的资格都没有。
- **结论**：DTC/DNA 不采纳。温度维相关问题只能走候选 D（扩题库至密度≥25），无算法侧绕过路径。此实证防止后续重提"温度维 culinary 相关推断"类方向。

#### 11.11.2 方案 1 的 τ² 增量——σ 闸门的有效技术路径（补强 §11.10 第三档①）

方案 1（U-DED）主体即 §11.9 ①（profile 加 σ、gain 改 Variance Reduction），docx 自承"评审优先级①"，不构成新方案。但其给出具体公式，其中 **τ²_d(q)（题 q 在维度 d 上的选项方差，预计算）是 §11.10 σ 闸门的有效技术路径**：

$$\Delta\mathrm{Var}(q)=\sum_d \sigma_d^2\cdot\left(1-\frac{\sigma_d^2}{\sigma_d^2+\tau_d^2(q)}\right)$$

- **关键洞察（docx 自己未点破）**：early profile≈0 时 σ² 取先验最大，$1-\sigma^2/(\sigma^2+\tau^2)=\tau^2/(\sigma^2+\tau^2)$，σ²≫τ² 时 ΔVar≈$\sum_d\tau_d^2(q)$。**即 early 区分力落到 τ²——题固有属性（选项在该维的分散度），可预计算、有据可依，不依赖 profile 先验**。
- **对 σ 闸门的意义**：§11.10 卡在"σ 凭什么有据可依"。τ² 提供了不确定性的**题侧来源**——不必全靠 profile σ 先验（难定），区分力可部分来自题固有 τ²。这把 σ 闸门从"抽象质疑"降为"可验证的技术选项"：①实施时 early 用 $\sum\tau^2$ 驱动，late 用 ΔVar 联合 σ·τ²。
- **未验保留**：τ² 是题固有属性（与 sharpness 同类），early 换用 $\sum\tau^2$ 驱动是否真解⑥（还是换了个题属性信号、高 τ² 题霸榜），须在 A 判据实验时一并验证。非确定结论，是 ① 的候选技术路径。

#### 11.11.3 不采纳方案（记录备查）

| 方案 | 判定 | 依据 |
|:--|:--|:--|
| 2 DTC 双池温度补偿 | ❌ 前提证伪 | §11.11.1：温度维独立性，K≈0 |
| 3 URDS 冷启动多样性 | ❌ 已否决 | "绕过 σ 用 diversity 硬顶"死路：uncertainty 要么不退化（变另一个 sw）要么空壳；且 count<10 分支描述与代码（实际 count<25）不符 |
| 4 DNA 动态叙事 | ❌ 不采纳 | 解自造"结果层同质化"非 §11 瓶颈；现状 intervalIndex 已是 8 维联合关系模式，"新颖性"夸大；culinary 前提同被 §11.11.1 证伪；无 A/B 基础设施不可量化 |

> **结论**：docx 四方案仅 τ² 增量有效，纳入 §11.10 第三档①的技术路径选项；DTC/DNA 被"温度维独立性"实证证伪，URDS 已否决。温度维相关结构缺失是 §11.3 的延伸实证——温度维问题无算法侧绕过路径，只能扩题库。

### 11.12 任务⑨ ① σ 闸门实验结论——① 关闭，第三档收口

§11.10.4「①的前置闸门」（σ 凭什么有据可依）+ §11.11.2「τ² 是 σ 闸门有效技术路径」经任务⑨实验复核（详见 `docs/experiments.md` 任务⑨，临时 `_sigma-exp.test.ts` 测完即删，三件套绿）：

- **静态诊断**（count=0 候选评分分布）：VR gain≈Στ² 的 **Gini 0.494 / N_eff 114.8，比 sw*10（Gini 0.323 / N_eff 149.8）更集中**——VR 驱动会让 early conc 升非降。Pearson(sw*10, Στ²)=0.652（非换皮但同向）。
- **动态对比**（closestTo 32 runs，注入 `earlyScorer?` 临时参数，测完回退）：VR-A/VR-D **conc 0.469→1.000（+113%）**，某题 32/32 session 全命中。earlyCen 形式降（−24%/−57%）是 conc=1.0 的副产物（锁死同批高 τ² 题），非 diversity 发力。
- **根因——VR 的「强区分力」恰恰是锁死原因**：sw*10 在 count=0 只 smooth=4.0/sharp=1.0 两档、所有 smooth 题并列，seeded jitter（jitterBase 0-3）打散排名→conc 低；VR gain（Στ²）是确定性题固有属性，q43 Στ²=6232 独占→每 session 都选→conc=1.0。**§11.11.2「τ² 有效技术路径」证伪**：VR 用 τ² 驱动导致 top-1 独占，比 sw 更锁死。
- **σ 闸门未通过**：§11.10.4 担心「① 退化为换皮 sw*10」——实证比换皮更糟。

**决策**：第三档①**关闭**。① 对 early（SH 解⑥后唯一剩余必要性）严重负增量，对 late 无必要。§11.10.5 落地路径第三档分叉裁定为「σ 无解→① 降级，第二档收口为算法侧终点」。诚实接受 early sw*10 锁死的天花板（conc≈0.47-0.75，由 seeded jitter 决定，非采样/评分可破）。

**真正解 early 锁死的方向**（非①）：扩基线建立题库（数据层，第二档任务⑦）——而非换更强评分信号（VR/σ 强区分反而加剧锁死，任务⑨①证伪），也非评分后硬过滤（任务⑨② 实证：early 硬过滤+追问维保护/提阈值对跨 session 无正收益，hard080 反使跨 session jaccard +16%/conc +20%，且跨 session 同质化已被 SH 解至 jaccard 0.050/used 100%，硬过滤无空间）。Lookahead/Thompson/QD-DPP（§11.10.4 序 9-11）均依赖①先行，随①关闭一并搁置。**early sw*10 锁死的评分/采样/过滤三条路径全部实证失败**（VR 评分层 / top-K randomesque 已饱和 / 硬过滤层），唯一剩余解是扩题库（让 early 合规基线题池变大，从源头分散）。详见 experiments.md 任务⑨②。

---

## 附录 A：实验方法

### A.1 session 模拟范式

所有标定共用一套纯函数模拟（不碰 localStorage）：
- 固定 seed 的 Mulberry32 PRNG；
- "贴画像选 option"：每题选与目标向量 $\cos$ 最大的选项；
- 强制 MAX（不用 shouldStop）获取后段数据，或真实停止测业务指标。

### A.2 指标定义

- **集中度**：$\max_i \mathrm{count}(i)/N_{sessions}$（5×8 seed）。
- **邻对相似**：相邻题 $tv$ 的 cen；"后期"= $count\ge25$。
- **窗口 joint**：$w$ 题滑动窗口内 $\binom{w}{2}$ 题对 cen 均值。
- **跨轮 Jaccard**：两轮 askedIds 的 $|A\cap B|/|A\cup B|$。

### A.3 可复现性

标定脚本为一次性 `_*.test.ts`（`_overlap-measure`/`_homog-diagnose`/`_threshold-calib`/`_mmr-calib`/`_sh-calib`/`_gdpp-measure`/`_window-exp`），测完即删（`ls | grep '^_'` + `git status --short` 双验证）。本文档数值来自这些脚本的 `--reporter=verbose` console 输出。

---

## 附录 B：决策时间线

| 阶段 | 决策 | 关键数值 |
|:--|:--|:--|
| Phase 1 | 8 维单字母体系 + 单入口选题器 + grade 渲染 | — |
| P7/P8 | 多级去重引擎 | — |
| 25–45 追问 | 动态矛盾追问模型 | 平均 ~33 题 |
| 推荐菜 | MMR 多样性选菜 + 匹配池加权抽样 | 解决相似菜扎堆 |
| 问题二 | 推荐匹配改去中心化 cen | blendedScore cos 项 |
| P9/A1 | 集中度护栏 + 早期多样性项 | 集中度 0.88→0.63 |
| P10 | dedup/penalty 度量去中心化（先决） | sig 0.801→cen 0.498 |
| P11 MMR | 单 session 离散→连续 | 后期高相似 29.3%→3.5% |
| P11 SH | 跨 session 二元→频次衰减 | within Jaccard 0.087→0.004 |
| gDPP | 12 配置实证否决 | 全线劣于 MMR·5 |
| 窗口扩大 | 实证否决（负优化） | MMR $w:5\to20$ 恶化 |
| Phase B Step1（main 69e0c20） | 8 维体系 bitter→temperature | 苦维密度 14.4 → 温度维 24.8（仍<25 被机制C跳过） |
| merge main 进 P10/P11 线 | 温度维命名 + MMR/SH 算法叠加 | 机制B 触发率 56%→40.6%，基线断言 0.45→0.40 |
| 三阶段甜区实验（§11.7） | 目标函数翻转：体验为主、准确度为成本 | MMR 下沉 early 硬过滤：earlyCen −32% acc 近乎免费；gDPP 二次否决；conc=1 系 early 犀利度锁死 |
| 下一步 | 瓶颈转移至文案层 | 45% 模板化；温度维 Step2（128 intervals H-高 + h-t/c-h 文案）待 humanizer |
