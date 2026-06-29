# 第二档（数据层）工作日志 — C→B→D→humanizer-zh 双循环，214→456 题

> 承接第一档算法侧收口（experiments §11.12 第三档①关闭）。第二档解瓶颈⑤（文案同质化）+ ③（温度维）+ B 跨次主题衰减。
> 双循环：第一轮基于现成 214 题（通机制+洗题干+补温度），第二轮整体扩题（颠覆+趣味）+ 再循环。

## 用户决策（拍板）
- 规模 450 题（实 456）；多标签主题词表（每题 1-3）；humanizer 脚本批量 + Skill 抽样复核。
- 补充约束：菜品全国知名度门槛（糌粑可/崩豆张不可）、饮料可入、北方菜补强、严格中文语序禁机翻、词表可增添。

## 第一轮（214→222，基于现成）

| 任务 | 内容 | 关键点 |
|:--|:--|:--|
| T1 代码基建 | types `topics?: string[]` + schema 校验 | **点分格式 `大类.具体`，schema 只校验结构（1-3/格式/同大类互斥）不锁白名单**——支持词表动态增添 |
| T2 214 题挂标 | assign-topics.mjs 自动挂标 | 主标签来自主导维（range 最大）→ flavor-axis；副标签 format/region/ingredient 词典 |
| T3 sessionMemory | StoredSession={ids,topics?} + 双形状兼容 + loadRecentStemCounts | 读 localStorage topics 快照，**不 import questionBank**；旧 string[][] 升级不丢 |
| T4 B 衰减 | sessionPenalty 跨 session 主题键 + SESSION_TOPIC_FREQ_CAP=3 | **getSessionStemCounts 回退 stem 键**（见下关键决策） |
| T5 温度题 | 补 8 道温度题 | 密度 24.8→28，负权探针 1→7 |
| T6 断言+Sim1 | 温度维启用断言、count、基线 | quiz-sim mean∈[26,36]/pursue≥40% **仍成立**（温度维启用未失控） |
| T7 humanizer | polish-stems.mjs + Skill 抽样 | 修 3 处"让你多想一下"套话；Skill 评分 45+/50 |
| T8 验证 | 三件套 | 全绿 |

## 第二轮（222→456，整体扩题）

| 任务 | 内容 | 关键点 |
|:--|:--|:--|
| T9 扩题 | generate-questions-v7→**regen-questions-v7** | mmx 核查北方菜系（鲁/东北/西北代表菜）；**同 cuisine 配对 + 菜品对去重**（修初版随机荒谬对：冰淇淋vs小笼包） |
| T10 挂标 | 生成器自动 topics | dish-vs-dish: format+region+flavor；temperature 题 + scenario |
| T11 验证 | schema/coverage/sessionMemory/adaptiveSelector | 全绿（456题） |
| T12 Sim2 重标 | quiz-sim 基线 + coverage | 集中度接受 early sw*10 锁死天花板（1.0） |
| T13 humanizer | polish-stems 全 456 题 | 机械扫描 0 AI 味；模板节奏单一记录 |

### 扩题质量修复链
1. 初版 generate-questions-v7（随机菜品对）→ 荒谬对（冰淇淋vs小笼包）+ 重复对（4次同对）。
2. **regen 改同 cuisine 配对 + 去重** → 合理对比（同菜系）。
3. 温度密度被 dish-vs-dish（菜品 temp=0）稀释 28→25.0 擦线 → 补 12 温度 smooth 题 → 27.7。
4. sour 密度被稀释 33.9→24.37<25（菜品酸味弱）→ 补 6 sour 题 → 25.99。
5. dishes 菜名括号（"煎饼（素）"）→ strip 9 处。
6. smooth 比例 23%（dish-vs-dish sharp 为主）→ 早期分层靠选题逻辑，未硬性补 smooth 题。

## 关键技术决策

### 1. B 衰减只做跨 session，session 内回退 stem
getSessionStemCounts 改主题键（含 flavor-axis）→ pursueRate 41%→22%（误伤机制B 同维二次探测）+ 集中度 0.63→0.775。**回退 stem 键**（P8.1 沉睡兜底），B 只做跨 session（sessionPenalty 主题键）。session 内同主题靠 MMR topicPenalty。

### 2. primaryTopic 排除 flavor-axis + format
- 排除 flavor-axis：口味维是测量维度，机制B 需同维探测。
- 排除 format：题型太粗，dish-vs-dish 占主体（71%）作主标签会让 200+ 题跨 session 连带屠版。
- 取 region/scene/ingredient/temperature（细粒度内容主题）。

### 3. SESSION_TOPIC_FREQ_CAP=3
跨 session 主题频次 cap（0.7³=0.343），防大主题连带，与 id 级自然上限一致。

### 4. 温度维启用（瓶颈③解决）
密度 24.8→27.7≥25，机制C 不再跳过温度维，纳入追问。BANK_DENSITY 模块缓存，扩题后自动重算（注意：**vitest deps 缓存旧 questions.json 会致温度断言误报，需清 node_modules/.vite**）。

### 5. early sw*10 锁死天花板（继承第一档）
456 题下集中度冲到 1.0——single-session 犀利度分层硬约束，第三档①已关闭，诚实接受（experiments 任务⑨① 决策）。

## 已知问题（诚实记录）
- **模板节奏单一**：234 道新题 stem 由 8 模板轮换生成（"摆一块/更馋哪个/留下谁"），跨题句式重复。humanizer 机械扫描无 AI 词，但节奏单一需后续人工多样化（或第二轮 Skill 全量改写）。
- **smooth 比例 23%**：dish-vs-dish（2选项 sharp）为主。早期分层靠选题逻辑优先 smooth，未硬补 smooth 题。
- **集中度 1.0**：early sw*10 锁死天花板，接受。
- **sour/温度维靠补题维持密度**：dish-vs-dish 菜品 sour/temp 信号弱，靠自定义偏好题（柠檬/温度）补，非纯 dishes 取权。

## 验证状态
- 456 题，三件套全绿（vitest 268/268 + tsc + build 467KB）。
- topics 多标签覆盖（format/region/flavor-axis/temperature/ingredient），schema 不锁白名单可增添。
- B 跨 session 主题衰减上线（sessionMemory 兼容旧数据 + App 接线）。
- 温度维纳入机制C追问（瓶颈③解决）。
