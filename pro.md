Task: 味觉测试项目底层算法全面重构

Context & Goal:
之前的方案存在理论缺陷（Pearson平庸陷阱、出题效率低、结果缺乏社交传播力）。现在我不怕重构，目标是追求极致的匹配准确度和结果趣味性。请按照以下全新架构重构。

Core Architecture Shift:
1. 出题层：升级为基于信息增益 (Information Gain) 的自适应出题。
2. 评估层：升级为 Min-Max 归一化 + 标准余弦相似度 + 欧氏距离惩罚。
3. 结果层：升级为 K-Means 味觉原型聚类 + 毒舌避雷指南。

请严格按以下 3 个 Phase 分步执行，每完成一个 Phase 停下来等我确认。

Phase 1: 题库数据结构与多标签矩阵重构
重新定义 Question 和 Option 接口。每个 Option 必须携带完整的 8 维权重向量 [spicy, umami, sweet, sour, crunchy, tender, intense, light]。提供题库 JSON 结构示例。

Phase 2: 动态出题引擎重构
废弃现有 pickNextQuestion。引入信息增益策略：实时计算 profile 方差，找出最不确定的维度，挑选能最大程度探测这些维度的题目。引入硬性剪枝：若某维度得分极低，后续过滤该维度权重 > 0 的题目。写出新的 AdaptiveSelector 核心类。

Phase 3: 评估与结果生成重构
1. 向量 Min-Max 归一化到 [0, 100]。
2. 混合相似度：Score = α * Cosine(U, C) + β * (1 / (1 + Euclidean(U, C)))。
3. 味觉原型聚类：提取最高2个和最低1个维度，映射为 MBTI 式标签（如“爆炎重口狂战”）。
4. 毒舌避雷：提取最低2个维度，映射反向吐槽文案。