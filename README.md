# 是啊，吃什么呢 — 味觉灵魂测试

> 25–45 道动态自适应问题，揭开你 8 维味觉偏好；雷达图 + 五类文案 + 推荐菜 + 国风分享卡。
> 纯前端、零网络请求、生产依赖只有 `react` 与 `react-dom`。

线上：你部署的域名（见下方部署章节）

---

## 功能

- **动态 25–45 题**：基础 25 题必答；检测到「同主题不一致 / 同维强弱波动」矛盾时追加追问，最多 45 题。
- **8 维味觉向量**：酸 / 甜 / 苦 / 辣 / 咸 / 浓 / 脆 / 嫩，单字母 S T K L I X C N。
- **国风结果页**：米纸 / 朱砂 / 思源宋体；雷达图 + 八维明细 + 联动 / 区间 / 极档 / 全能四类文案 + 跨菜系推荐菜。
- **推荐菜匹配池随机抽样**：blendedScore ≥ 60% 最高分的菜按 score² 加权随机；同画像每次推荐都不一样，但都"够匹配"。
- **国风分享卡**：540×960 JPEG，米纸纹理 + 印章「鉴」+ 毛笔标语；离线生成，可直接保存。
- **「吃什么啊？」随机菜页**：从 popular 库（104 道日常知名菜）随机抽，"换一个"不重复上一道。

---

## 技术栈

| 类别 | 选型 |
|:---|:---|
| UI 框架 | React 19.2.6（函数组件 + Hooks，禁止 class） |
| 语言 | TypeScript ~6.0.2（`verbatimModuleSyntax`） |
| 构建 | Vite 8.0.12（Oxc） |
| 状态 | `useState` + `useCallback` + `useEffect`（业务态 < 10 个） |
| 样式 | 纯手写 CSS + CSS 自定义属性（无 Tailwind / Sass / UI 库 / CSS-in-JS） |
| 字体 | Google Fonts `Noto Serif SC` / `Noto Sans SC` / `Ma Shan Zheng` |
| 测试 | Vitest 4.1.8（199 个单测覆盖纯函数层 + 端到端模拟） |
| 后端 | **无**（数据 100% 内联 JSON，零 fetch / 零 API） |

**生产依赖只有 2 个：`react` 和 `react-dom`。**

---

## 本地开发

```bash
cd food-quiz
npm install
npm run dev          # Vite dev server（默认端口见控制台）
npm run build        # tsc -b && vite build → dist/
npm run preview      # 预览 dist/

# 验证（CLAUDE.md §2 规定的三件套）
npx vitest run       # 单测
npx tsc -b --noEmit  # 类型检查
npm run build        # 构建
```

---

## 生产环境部署

`npm run build` 输出在 `food-quiz/dist/`，是**纯静态文件**（HTML + JS + CSS + JSON 资产，无服务端依赖）。任何静态托管都能跑。

### 选项 1：Vercel（推荐，零配置）

最快上线方式，自动 HTTPS、CDN、Git 触发自动部署。

1. **导入仓库**：[vercel.com/new](https://vercel.com/new) → 选你 fork 的仓库
2. **配置**（Vercel 不会自动识别 monorepo 子目录，需要手动设）：
   - **Root Directory**: `food-quiz`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`（默认）
   - **Output Directory**: `dist`（默认）
   - **Install Command**: `npm install`（默认）
3. 点 **Deploy**。每次 `git push origin main` 自动重新部署。

**自定义域名**：项目 Settings → Domains → 添加域名 → 按提示在 DNS 加 CNAME / A 记录。

### 选项 2：Netlify

操作类似：

1. [app.netlify.com/start](https://app.netlify.com/start) → 选仓库
2. **Base directory**: `food-quiz`
3. **Build command**: `npm run build`
4. **Publish directory**: `food-quiz/dist`
5. Deploy site。

也可以直接拖 `dist/` 目录到 Netlify 首页（不走 Git，单次部署）。

### 选项 3：GitHub Pages

需要 GitHub Actions 因为 `dist` 在子目录。在仓库根目录新建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
        working-directory: food-quiz
      - run: npm run build
        working-directory: food-quiz
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: food-quiz/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

**重要**：仓库 Settings → Pages → Source 选 **GitHub Actions**（不是 "Deploy from a branch"）。

如果发布到 `https://用户名.github.io/仓库名/`（非根域），需要在 `food-quiz/vite.config.ts` 加 base：

```ts
export default defineConfig({
  base: '/仓库名/',  // 替换成实际仓库名
  plugins: [react()],
})
```

### 选项 4：Cloudflare Pages

国内访问体验通常优于 Vercel/Netlify。

1. [dash.cloudflare.com](https://dash.cloudflare.com) → Workers & Pages → Create → Pages → Connect to Git
2. **Build command**: `cd food-quiz && npm install && npm run build`
3. **Build output directory**: `food-quiz/dist`
4. Save and Deploy。

### 选项 5：自建 Nginx（含 HTTPS）

适合自有 VPS / 需要完全控制的场景。

**1. 服务器准备 Node 环境（用于构建）**

如果在服务器上构建：
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx
```

**2. 拉代码 + 构建**

```bash
git clone https://github.com/<你的仓库>.git /opt/food-quiz-src
cd /opt/food-quiz-src/food-quiz
npm ci                          # 比 npm install 更快更稳
npm run build                   # 产出 dist/
sudo mkdir -p /var/www/food-quiz
sudo cp -r dist/* /var/www/food-quiz/
```

或在本地 build 后只把 `dist/` 上传：
```bash
# 本地
cd food-quiz && npm run build
scp -r dist/* user@server:/var/www/food-quiz/
```

**3. Nginx 配置 `/etc/nginx/sites-available/food-quiz.conf`**

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com;

    # 强制 HTTPS（首次跑 certbot 后再开）
    # return 301 https://$host$request_uri;

    root /var/www/food-quiz;
    index index.html;

    # SPA fallback：所有未知路径都回 index.html（你这是单页应用）
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资产长缓存（Vite 输出带 hash 文件名，可放心缓存）
    location ~* \.(js|css|woff2|ttf|otf|jpg|jpeg|png|webp|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # JSON 数据短缓存（万一题库/菜品微调）
    location ~* \.json$ {
        expires 1h;
        add_header Cache-Control "public";
    }

    # gzip
    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;
}
```

**4. 启用站点 + 申请 HTTPS**

```bash
sudo ln -s /etc/nginx/sites-available/food-quiz.conf /etc/nginx/sites-enabled/
sudo nginx -t                     # 检查配置
sudo systemctl reload nginx

# Let's Encrypt 免费证书
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
# 选择 "Redirect" 自动跳 HTTPS；证书 90 天自动续期
```

**5. CDN 加速（可选）**

`dist/` 上传到 OSS / S3 / 七牛 / 又拍，CDN 回源到对象存储。Vite 输出的资产文件名带 hash，永久缓存即可（`Cache-Control: public, max-age=31536000, immutable`）。

### 选项 6：阿里云 OSS / 腾讯云 COS

1. **构建**：`cd food-quiz && npm run build`
2. **上传 `dist/` 到 Bucket**（阿里云控制台 / `ossutil` / `coscli`）
3. **开启静态网站托管**：默认首页 `index.html`、错误页 `index.html`（关键，让 SPA 路由不 404）
4. **绑定自定义域名 + CDN**：阿里云 Bucket → 传输管理 → 域名管理 → 绑定域名

`ossutil` 上传一行：
```bash
ossutil cp -r food-quiz/dist/ oss://你的-bucket/ --update
```

---

## 常见部署坑

| 现象 | 原因 | 修复 |
|:---|:---|:---|
| 子路径部署后白屏 / 资产 404 | Vite 默认 `base: '/'`，子路径需改 | `vite.config.ts` 加 `base: '/子路径/'` 重新 build |
| 刷新页面 404 | 这是 SPA，路由前端控制；服务端没配 fallback | Nginx `try_files $uri /index.html`；S3/OSS 错误页指 `index.html` |
| 分享卡保存为空白方块 | Noto Serif SC 字体未加载完成 | 已用 `preloadShareCardFonts()` 在 App 挂载时预载，2.5s 超时兜底；服务端 CSP 别屏蔽 fonts.googleapis.com |
| 推荐菜 / 文案显示空白 | dishes.json 没打包进 dist | 检查 `dist/assets/` 里有没有 dishes 相关 JSON；`vite.config.ts` 不要加 `assetsInclude` 排除 JSON |
| 国内访问 Google Fonts 慢 | Noto Sans/Serif SC 从 fonts.googleapis.com 加载 | 改成自托管（下载 woff2 放 `public/fonts/` 改 `index.html` `<link>`），或换字节跳动 CDN 镜像 `<https://font.sec.miui.com>` |

---

## 项目架构

完整设计文档见 [`CLAUDE.md`](CLAUDE.md)（项目规约，优先级最高）和 [`pro.md`](pro.md)（历史规划）。

### 三层架构

```
food-quiz/src/
├── lib/taste/        ← 第 1 层：算法核心（纯函数，100% 单测）
├── content/          ← 第 2 层：JSON 文案资产（互不引用）
├── components/       ← 第 3 层：React 组件（ResultCard / RadarChart）
├── utils/            ← 第 3 层：副作用工具（shareImage.ts = Canvas）
├── App.tsx           ← 第 3 层：4-phase 状态机
└── styles/App.css    ← 全部样式
```

**铁律**：第 1 层不能 import 第 2/3 层；第 2 层 JSON 互不引用。算法改动只发生在第 1 层，必须配单测。

### 第 1 层模块

| 模块 | 职责 |
|:---|:---|
| `types.ts` | 类型 + `ZERO_VECTOR` + `sharpnessOf()` |
| `keys.ts` | **8 维单字母体系唯一真相源**（DIMS / DIM_FIELDS / DIM_CHINESE） |
| `normalize.ts` | `normalize()` Min-Max → [0,100]；`std()` |
| `similarity.ts` | `cosineSim` / `euclideanDist` / `blendedScore` |
| `state.ts` | 不可变答题状态机：`initialState` / `applyAnswer` / `undoLast` |
| `adaptiveSelector.ts` | 动态 25–45 选题：`pickNextQuestion` / `shouldStop` / `detectPursueDims` |
| `result.ts` | 主入口 `assembleResult(raw)` → `AssembledResult` |
| `loaders.ts` | 5 类文案 + dishes 的 JSON loader（缺文件返回 null/[]，永不抛错） |
| `radarChart.ts` | `drawRadarChart()` 纯绘制函数（React 与分享卡共用） |

### 8 维体系

| 位 | 维度 | 字段名 | 单字母 | 中文 |
|:--:|:--|:--|:--:|:--|
| 0 | 酸 | `sour` | **S** | 酸 |
| 1 | 甜 | `sweet` | **T** | 甜 |
| 2 | 苦 | `bitter` | **K** | 苦 |
| 3 | 辣 | `spicy` | **L** | 辣 |
| 4 | 咸 | `salty` | **I** | 咸 |
| 5 | 浓 | `rich` | **X** | 浓 |
| 6 | 脆 | `crunchy` | **C** | 脆 |
| 7 | 嫩 | `tender` | **N** | 嫩 |

**约束**：第 5 位字段名一律 `rich`（浓），禁 `umami` / `鲜`；8 字母互异保证 256 组合串唯一。

### 关键阈值

| 常量 | 值 | 含义 |
|:--|:--|:--|
| `MIN_QUESTIONS` | 25 | 基础题必答 |
| `MAX_QUESTIONS` | 45 | 硬上限 |
| `STRONG_W` / `WEAK_W` | 20 / 5 | 机制 B：某维既强又弱才判矛盾 |
| `CLARIFIED_ABS` | 100 | profile 推到此值视为该维澄清，脱离追问 |
| `HIGH_THRESHOLD` | 60 | 高档 / 区间文案 / 联动触发线 |
| `EXTREME_THRESHOLD` | 90 | 极档文案触发线 |
| `STD_ALLROUND` | 15 | std < 15 → 触发"全能味觉" |
| `PRUNE_THRESHOLD` | -30 | raw ≤ −30 → 该维剪枝（极度排斥） |

### 推荐菜算法

每次进入结果页时：
1. 计算 8 维 profile → 全 popular 库每道菜算 `blendedScore`（cosine + 距离混合）
2. 匹配池 = 分数 ≥ 60% 最高分的所有菜（动态阈值，池可大可小）
3. 池太小（< topN）→ 扩到全 popular 库兜底
4. 池内**按 score² 加权随机无放回抽样**：高分易中、低分仍有机会
5. 唯一硬约束：**不重菜名**（同菜系 / 同地区都允许）
6. App 每次进 result 阶段传 `Math.random()` 新 seed → 同画像每次推不同菜组合
7. 同 seed → 确定性（测试可复现）

### 渲染顺序（结果页与分享卡一致）

```
1. 联动文案 synergy        ← 仅 Top1+Top2 都 >60
2. 8 维雷达图              ← 永远显示
3. 区间 / 全能文案         ← std<15 显示 allround，否则 intervals
4. 极档警告 extremes       ← 仅 value ≥90
5. 推荐菜 topDishes        ← 永远显示（默认折叠）
6. 操作按钮                ← 重新测试 / 复制文案 / 保存结果图
```

避雷指南已下线（数据保留以备恢复，详见 commit `69df620`）。

---

## 文案资产

```
food-quiz/src/content/
├── questions/questions.json     # 200 题总库 + schema（加载期校验）
├── intervals/                   # 256 条区间文案（000.json … 255.json）
├── extreme/{s,t,k,l,i,x,c,n}.json   # 8 条极档文案
├── synergies/                   # 10 个字母对 + 1 个 _fallback
├── allround/                    # _index.json + 01..04（std<15 抽一条）
├── avoid/                       # _index.json + s..n.json（数据保留，已不再消费）
└── dishes.json                  # 196 道菜（104 popular + 92 冷门地方菜）
```

**解耦铁律**：5 个文案目录 + dishes.json 互不引用，统一通过 `keys.ts` 共享单字母体系。删除任意一个 JSON 不影响其他模块（loader 返回 null/[]，组件相应 section 静默不渲染）。

---

## 性能基线

| 指标 | 数值 |
|:---|:---|
| 首屏 JS（gzipped） | ~105 KB |
| 首屏 CSS | ~16 KB（gzip 4 KB） |
| 总 bundle | ~419 KB |
| TTI（4G） | < 1.5s |
| 一次完整答题计算 | < 100 ms（含 1.5s 计算屏动画） |
| 分享卡生成 | < 500 ms（字体已预载时） |

---

## 工作流约定

详见 [`CLAUDE.md`](CLAUDE.md)。重点：

- 算法 / 数据 / 类型改动**必须配单测**，不靠浏览器肉眼。
- 验证三件套：`npx vitest run` + `npx tsc -b --noEmit` + `npm run build` **全过**才算完成。
- 中文交流。
- 破坏性 / 外向动作（删文件、强推、改公共数据结构）前先确认。

---

## 许可

MIT
