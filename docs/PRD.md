# DreamReel — Product Requirements Document

> **赛事**：MiniMax Week 2026 (GMI Cloud × MiniMax) · Multimodality 赛道
> **截止**：2026-09-06
> **文档版本**：v1.0（2026-08-28）
> **作者**：产品/工程 owner
> **状态**：For build

---

## 0. TL;DR

**DreamReel** 是一个 Web 应用：用户醒来后用 60 秒描述梦境，AI 在 90 秒内将梦境"拍摄"成一部 30 秒电影 —— 包含 4 段 H3 生成的画面、Music 3.0 生成的情绪配乐、Speech 2.8 生成的诺兰式旁白。每个梦境可保存到个人"梦的档案"中。

**参赛定位**：
- **赛道**：Multimodality（多模态）
- **核心模型**：M3（推理+剧本） + H3（视频） + Music 3.0（音乐） + Speech 2.8（语音），共 4 个 MiniMax 模型
- **反套路点**：**没有人用 H3 做"超现实/潜意识"内容**；我们站在"梦境记录 ∩ AI 短片生成 ∩ 心理学"三者的交叉点

---

## 1. 愿景与目标

### 1.1 愿景（Vision）

> **Sora 让你看见世界。DreamReel 让你看见自己的潜意识。**

把人类最私密、最丰富、最被低估的素材库（梦境）变成可观赏的艺术品。

### 1.2 目标（Goals）

| # | 目标 | 衡量 |
|---|------|------|
| G1 | originality 拉满 | 评审"为什么没人做过这个"的反应 |
| G2 | model usage 拉满 | 4 个 MiniMax 模型全用上（M3 / H3 / Music 3.0 / Speech 2.8） |
| G3 | usability 强 | 用户 3 分钟内从"打开网页"到"看完电影" |
| G4 | demo 视频天然有冲击力 | 演示片段在 1 分钟内传达"这是一个 30 秒梦境电影" |

### 1.3 非目标（Non-Goals）

明确**不**做什么，避免 scope 蔓延：

- ❌ 不做社交分享 / Feed / 关注系统
- ❌ 不做梦境类型的科学研究分析
- ❌ 不做冥想 / 助眠 / 清醒梦诱导
- ❌ 不做多语言（首版仅英文 + 简中）
- ❌ 不做移动端原生 App（仅 Web 响应式）
- ❌ 不做实时生成（明确告知用户"90 秒出片"）

---

## 2. 用户与场景

### 2.1 目标用户

**主用户**：「梦境敏感者」—— 一周至少记得 1 次梦、对梦境有好奇心、愿意用文字/语音记录的人。

**画像**：
- 25-40 岁，互联网原住民
- 接触过 Headspace / Calm / Day One / 飞书文档 等记录类工具
- 喜欢 A24 电影、David Lynch、Christopher Nolan 的非主流叙事美学
- **不**是生产力用户，**是**审美/情绪/记录型用户

**次用户**：心理学爱好者、内容创作者、电影/艺术学生。

### 2.2 核心场景

**场景 1：早晨醒来记梦**
> 早上 7:30，闹钟响了，用户眯着眼打开手机，语音描述"我梦见自己在一座倒过来的图书馆里飞，楼梯是水做的"。90 秒后，屏幕上播放一段 30 秒的梦境电影。

**场景 2：回看梦境档案**
> 晚上临睡前，用户打开 DreamReel，看自己过去一周的 7 个梦境，挑选最喜欢的分享给朋友。

**场景 3：展示给朋友**
> 朋友来家里玩，用户给 TA 演示"这是我周三做的梦"—— 体验完整流程。

### 2.3 反向场景（明确不支持）

- 不支持连续梦境（首版不做"昨晚的梦接今早的梦"）
- 不支持用户编辑梦境片段（AI 输出即终稿）
- 不支持团队/多人协作

---

## 3. 用户体验（UX）

### 3.1 全局设计原则

| 原则 | 解释 |
|------|------|
| **极简** | 单页应用，从进入到完成 ≤ 3 步 |
| **私人感** | 深色背景 + 等宽字体 + 微光，避免明亮、SaaS 化的视觉 |
| **仪式感** | "按下录音"是一个事件，90 秒等待是仪式，电影播放是奖励 |
| **可逆性** | 任何状态都有"返回上一步"的入口 |
| **无账号可体验** | 未登录用户可完整体验一次（轻量账户是增值项，不是门槛） |

### 3.2 主流程（Happy Path）

```
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Landing                                             │
│  ───────────                                                 │
│  - 大麦克风按钮（圆形，缓慢呼吸动画）                            │
│  - 一行字："Describe your dream. We'll shoot it for you."     │
│  - 副标题："30 seconds. 4 models. One movie."                 │
└─────────────────────────────────────────────────────────────┘
                          ↓ 按住按钮录音 60 秒
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Recording                                           │
│  ─────────────                                               │
│  - 录音波形实时可视化                                          │
│  - 倒计时进度环：60s → 0s                                     │
│  - 释放按钮后，进入 Step 3                                      │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Generating（90 秒）                                   │
│  ────────────────────                                        │
│  - 旋转的胶片动画                                              │
│  - 4 阶段进度文案：                                            │
│      1. "Writing the screenplay..." (M3, 0-15s)               │
│      2. "Shooting scene 1 of 4..." (H3, 15-40s)              │
│      3. "Scoring the music..." (Music 3.0, 40-55s)            │
│      4. "Recording the voiceover..." (Speech 2.8, 55-90s)     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 4: Watch                                               │
│  ──────────                                                  │
│  - 视频自动播放（带控件）                                       │
│  - 视频下方：梦境解析文本（100 字内）                              │
│  - 情绪标签徽章：[surreal] [absurd] [flying]                   │
│  - 底部按钮组：                                                │
│      [Save to my dreams]   [Make another]   [Share]           │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 异常流程

| 异常 | 体验 |
|------|------|
| 录音不到 5 秒 | Toast: "Tell me more. Dreams need at least a moment." |
| 录音超过 90 秒 | 自动截断到 60 秒 |
| 网络断开 | 提示 + 重试按钮 |
| M3 返回非法 JSON | 自动重试 1 次，再失败显示降级 UI（"AI 失眠了，请重试"） |
| H3 生成失败 | 该镜头用占位图（黑屏 + 文字"该镜头在梦中模糊"），不影响其余镜头 |
| Music 3.0 失败 | 静音播放 |
| Speech 2.8 失败 | 显示文字旁白，无配音 |

### 3.4 账户相关流程

```
未登录用户:
  - Step 4 后点击 [Save] → 弹出 OAuth 登录（GitHub / Google 二选一）
  - 登录后跳转 Step 4，自动保存

已登录用户:
  - Step 4 后点击 [Save] → 直接保存
  - 顶部导航 [My Dreams] 入口
```

### 3.5 导航结构

```
顶部（仅在已登录后显示）:
  [Logo DreamReel]                  [My Dreams]   [Avatar]
```

未登录：纯净的 Landing 单页，无导航。

---

## 4. 视觉规范（UI Spec）

### 4.1 配色

| 用途 | 颜色 | HEX |
|------|------|-----|
| 背景 | 近黑 | `#0A0A0F` |
| 主文字 | 米白 | `#F4F1EA` |
| 副文字 | 灰白 | `#A8A29E` |
| 强调 | 琥珀 | `#D4A574` |
| 录音状态 | 暗红 | `#8B2635` |
| 错误 | 砖红 | `#C44536` |
| 成功 | 雾绿 | `#5C8068` |

**整体气质**：暗色 + 暖色点缀，参考 A24 电影海报。

### 4.2 字体

| 用途 | 字体 |
|------|------|
| 主标题 | `IBM Plex Serif`（思源宋体的英文等价） |
| 正文 | `IBM Plex Sans` |
| 终端/计时器 | `JetBrains Mono` |

### 4.3 关键组件

**录音按钮**（Landing 中央）：
- 直径 120px，圆形
- 默认：米白描边，呼吸动画（scale 1.0 ↔ 1.05, 3s）
- Hover：填充微光
- Active（录音中）：暗红填充 + 脉动

**胶片加载动画**（Generating）：
- SVG 旋转胶片
- 周围 4 颗"镜头"依次亮起（与 4 阶段进度同步）

**视频卡片**（Watch）：
- 16:9 黑底
- 字幕叠层：底部 8% 位置，等宽字体，米白 80% 透明
- 视频下方：情绪标签（胶囊形）+ 解析文本

### 4.4 响应式

- **桌面**（≥ 1024px）：视频 720p，文本宽度 720px 居中
- **平板**（768-1023px）：视频 540p
- **移动**（< 768px）：视频 360p，按钮放大到 160px 直径

### 4.5 微交互

- 录音开始：屏幕轻微震动（haptic on mobile）
- 阶段切换：胶片颗粒"咔哒"一声（Web Audio API 短促咔哒）
- 视频播放结束：渐隐 1.5s

---

## 5. 功能需求（Functional Requirements）

### 5.1 必须有（Must）

| ID | 需求 | 优先级 |
|----|------|--------|
| F1 | 语音录音（按住 60 秒，自动停止） | P0 |
| F2 | 录音转文字（M3 内置 STT） | P0 |
| F3 | M3 生成 4 镜头剧本 | P0 |
| F4 | M3 生成旁白文本 + 情绪标签 | P0 |
| F5 | H3 生成 4 段视频（并行） | P0 |
| F6 | Music 3.0 生成 30 秒配乐 | P0 |
| F7 | Speech 2.8 生成 30 秒旁白 | P0 |
| F8 | FFmpeg 合成最终 30 秒 MP4 | P0 |
| F9 | 视频播放 + 解析文本 + 情绪标签展示 | P0 |
| F10 | 重新生成（重置整个流程） | P0 |
| F11 | 轻量账户（GitHub/Google OAuth） | P0 |
| F12 | 保存梦境到个人档案 | P0 |
| F13 | 我的梦境列表（按时间倒序） | P0 |
| F14 | 我的梦境详情页（可重看视频+解析） | P0 |
| F15 | IP 限流（每 IP 每小时 5 次） | P0 |
| F16 | 内容审核（仅过滤露骨暴力） | P0 |

### 5.2 应该有（Should）

| ID | 需求 | 优先级 |
|----|------|--------|
| F17 | 梦境类型学分类（Hall/Van de Castle 分类） | P1 |
| F18 | 梦境档案"周报"（聚类分析） | P1 |
| F19 | 分享链接（生成只读 URL，24h 过期） | P1 |
| F20 | 复制解析文本到剪贴板 | P1 |

### 5.3 可以有（Could）

| ID | 需求 | 优先级 |
|----|------|--------|
| F21 | "重写梦境"功能（把噩梦改成美梦） | P2 |
| F22 | 连续梦境模式 | P2 |
| F23 | 多语言（先英中） | P2 |

### 5.4 不会有（Won't）

- ❌ 实时生成（不在 14 天内）
- ❌ 用户编辑镜头（AI 输出即终稿）
- ❌ 移动端原生 App
- ❌ 梦境内容社区

---

## 6. 数据模型

### 6.1 实体关系

```
User ──< Dream
         │
         ├─ video_url (R2)
         ├─ transcript (user input)
         ├─ screenplay_json (M3 output)
         ├─ analysis_text (M3 output)
         ├─ emotion_tag (M3 output)
         ├─ dream_type (M3 output, P1)
         └─ created_at
```

### 6.2 D1 Schema

```sql
-- users
CREATE TABLE users (
  id           TEXT PRIMARY KEY,         -- crypto.randomUUID()
  oauth_id     TEXT UNIQUE NOT NULL,     -- GitHub/Google id
  oauth_provider TEXT NOT NULL,          -- 'github' | 'google'
  email        TEXT,
  display_name TEXT,
  avatar_url   TEXT,
  created_at   INTEGER NOT NULL,         -- unix ms
  last_seen_at INTEGER NOT NULL
);

CREATE INDEX idx_users_oauth ON users(oauth_provider, oauth_id);

-- dreams
CREATE TABLE dreams (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,         -- nullable for anon
  transcript      TEXT NOT NULL,         -- user voice-to-text
  screenplay_json TEXT NOT NULL,         -- M3 output
  analysis_text   TEXT NOT NULL,
  emotion_tag     TEXT NOT NULL,         -- 'terror' | 'love' | 'surreal' | ...
  dream_type      TEXT,                  -- P1: Hall-Van de Castle category
  video_r2_key    TEXT NOT NULL,         -- e.g. 'dreams/<id>/final.mp4'
  duration_ms     INTEGER NOT NULL,
  is_public       INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_dreams_user_created ON dreams(user_id, created_at DESC);
CREATE INDEX idx_dreams_emotion ON dreams(emotion_tag);

-- rate_limits (KV 中也存,这里 D1 仅做持久统计)
CREATE TABLE rate_limits (
  ip         TEXT PRIMARY KEY,
  hour_key   TEXT NOT NULL,              -- 'YYYY-MM-DD-HH'
  count      INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
```

### 6.3 R2 存储结构

```
dreams/
  <dream_id>/
    final.mp4          ← 合成后的 30 秒视频
    scene-1.mp4        ← 原始 H3 片段 1 (P1: 用于重生成)
    scene-2.mp4
    scene-3.mp4
    scene-4.mp4
    music.mp3          ← Music 3.0 输出
    voiceover.mp3      ← Speech 2.8 输出
    thumbnail.jpg      ← 视频第一帧 (可选)
```

R2 生命周期策略：
- `final.mp4` 永久保存（用户数据）
- `scene-*.mp4` 30 天后删除（中间产物）
- `music.mp3` / `voiceover.mp3` 7 天后删除（中间产物）

---

## 7. API 设计

### 7.1 路由总览

| Method | Path | 鉴权 | 用途 |
|--------|------|------|------|
| GET | `/` | 否 | Landing 页 |
| GET | `/dreams` | 是 | 我的梦境列表 |
| GET | `/dreams/:id` | 是 | 单个梦境详情 |
| POST | `/api/dreams/generate` | 是 (anon 允许) | 创建梦境（启动生成） |
| GET | `/api/dreams/:id/status` | 是 | 轮询生成状态 |
| GET | `/api/dreams/:id/video` | 是 | 流式播放 R2 视频 |
| DELETE | `/api/dreams/:id` | 是 | 删除梦境 |
| POST | `/api/share/:id` | 是 | 创建分享链接 |
| GET | `/share/:token` | 否 | 公开访问分享页 |
| GET | `/api/auth/me` | 是 | 当前用户信息 |
| GET | `/api/auth/oauth/:provider` | 否 | 启动 OAuth |
| GET | `/api/auth/callback/:provider` | 否 | OAuth 回调 |

### 7.2 关键端点详情

#### POST /api/dreams/generate

**请求**：
```json
{
  "transcript": "I was flying in an upside-down library, the stairs were made of water..."
}
```

**响应**（202 Accepted）：
```json
{
  "dream_id": "d_abc123",
  "status": "pending",
  "poll_url": "/api/dreams/d_abc123/status"
}
```

**处理流程**（Worker 内异步）：
```
1. 入库 dreams 表 (status='pending')
2. 调用 M3 (生成 screenplay + analysis + emotion)
3. 更新 status='rendering'
4. 并行调用 H3 × 4, Music 3.0 × 1, Speech 2.8 × 1
5. FFmpeg 合成 → 上传 R2
6. 更新 status='done', video_r2_key, duration_ms
```

#### GET /api/dreams/:id/status

**响应**：
```json
{
  "id": "d_abc123",
  "status": "pending" | "rendering" | "done" | "failed",
  "stage": "screenplay" | "scene-1" | "scene-2" | "scene-3" | "scene-4" | "music" | "voiceover" | "compositing",
  "progress": 0.42,
  "video_url": null,
  "analysis_text": null,
  "emotion_tag": null,
  "error": null
}
```

`status` 状态机：
```
pending → rendering → done
                 ↓
                failed
```

#### GET /api/dreams/:id/video

**响应**：302 重定向到 R2 预签名 URL（有效期 1 小时）。

#### POST /api/share/:id

**请求**：
```json
{ "expires_in_hours": 24 }
```

**响应**：
```json
{
  "share_url": "https://dreamreel.app/share/<token>",
  "expires_at": 1725667200
}
```

分享 token 存 KV（不持久化到 D1），24h 后自动过期。

### 7.3 错误码

| HTTP Code | 含义 |
|-----------|------|
| 400 | 请求体非法（transcript 长度、字段缺失） |
| 401 | 未登录访问需要鉴权的端点 |
| 403 | 访问他人梦境 |
| 404 | 梦境不存在 |
| 409 | 正在生成中（同一 dream 重复请求） |
| 422 | 内容审核未通过 |
| 429 | 触发限流 |
| 500 | 内部错误（AI 调用失败等） |
| 502 | 上游 AI 服务不可用 |
| 504 | 生成超时（>5 分钟） |

---

## 8. 技术需求

### 8.1 技术栈

| 层 | 选型 | 理由 |
|----|------|------|
| 前端 | Next.js 14 (App Router) + React 18 + TypeScript | SSR/SSG 友好，部署到 Cloudflare Pages |
| 样式 | Tailwind CSS 3 | 原子化，dark mode 友好 |
| 状态 | Zustand | 轻量，比 Redux 简单 |
| 录音 | MediaRecorder API | 原生 Web API，无第三方依赖 |
| 视频播放 | `<video>` 原生 + hls.js (HLS 流，可选) | 简单优先 |
| 后端 | Cloudflare Workers + Hono | 边缘运行，TypeScript，Hono 路由清晰 |
| 数据库 | Cloudflare D1 (SQLite) | 用户/dream 元数据 |
| 对象存储 | Cloudflare R2 | 视频/音频文件 |
| 缓存/会话 | Cloudflare KV | OAuth state、share token、限流计数 |
| 鉴权 | Auth.js (NextAuth) v5 + GitHub/Google Provider | 标准方案 |
| 视频合成 | FFmpeg via ffmpeg.wasm (在 Worker 内调用) 或外部 API | 详见 §8.3 |
| AI 调用 | GMI Cloud OpenAI-compatible API | MiniMax 模型 |
| 部署 | Cloudflare Pages (前端) + Workers (后端) | 全 Cloudflare |

### 8.2 AI 模型与 API 选型

> 全部走 **GMI Cloud** 提供的 MiniMax 模型（赛事要求）。

| 模型 | 用途 | 调用方式 | 输入 | 输出 |
|------|------|---------|------|------|
| M3 | 剧本生成 + 梦境解析 | `/v1/chat/completions` | 系统 prompt + 用户梦境文本 | JSON（4 镜头 + 旁白 + 情绪） |
| H3 | 4 段视频生成 | `/v1/video/generations` (异步) | 镜头文本 prompt | 4 个 mp4 URL |
| Music 3.0 | 配乐生成 | `/v1/audio/music/generations` | 情绪标签 + 时长 | mp3 URL |
| Speech 2.8 | 旁白配音 | `/v1/audio/speech/generations` | 旁白文本 + 音色 ID | mp3 URL |

**关键参数**：
- H3：每个镜头 7-8 秒，分辨率 720p，aspect_ratio 16:9，fps 24
- Music 3.0：30 秒，stereo 44.1kHz
- Speech 2.8：30 秒内，voice="warm-male-en"（温暖男声）

### 8.3 视频合成方案

**方案对比**：

| 方案 | 优点 | 缺点 | 决策 |
|------|------|------|------|
| Cloudflare Worker 内 ffmpeg.wasm | 全 Cloudflare，免费 | Worker 128MB 内存限制，wasm 启动慢（冷启动 3-5s），4 段 30s 视频合成可能 OOM | ❌ |
| Cloudflare Container (beta) | 完整 Linux 环境，可装 ffmpeg | 仍 beta，计费复杂 | ⚠️ 备选 |
| 外部 API（如 Creatomate、Shotstack） | 稳定，RESTful | 引入第三方，不符合"全 Cloudflare"哲学 | ❌ |
| Cloudflare Worker 调用外部 ffmpeg 服务（自建 fly.io / Railway） | 灵活 | 引入非 Cloudflare 依赖 | ⚠️ 备选 |
| **Server-side：临时开一台 Cloudflare Container 做合成** | 满足"全 Cloudflare"+ 性能 | 配置稍复杂 | ✅ **采用** |

**采用方案详细说明**：
- 主路径：Worker 拉起 Cloudflare Container（ffmpeg 镜像）
- Container 接收 4 段 H3 mp4 + 配乐 + 旁白
- 合成脚本：
  ```bash
  ffmpeg -i s1.mp4 -i s2.mp4 -i s3.mp4 -i s4.mp4 \
         -i music.mp3 -i voiceover.mp3 \
         -filter_complex "
           [0:v][1:v][2:v][3:v]xfade=transition=fade:duration=0.5:offset=7.5,...
           [4:a]volume=0.3[mus];
           [5:a]volume=1.0[vox];
           [mus][vox]amix=inputs=2
         " \
         -c:v libx264 -preset fast -crf 23 \
         -c:a aac -b:a 128k \
         -shortest output.mp4
  ```
- Container 在合成后自毁（按调用计费）

**简化方案（fallback）**：如果 Container 方案有问题，回退到 Cloudflare Worker + 调用外部 ffmpeg HTTP API（如 api.ffmpeg-api.com）。

### 8.4 项目结构

```
dreamreel/
├── apps/
│   ├── web/                      # Next.js (Cloudflare Pages)
│   │   ├── app/
│   │   │   ├── page.tsx          # Landing
│   │   │   ├── dreams/
│   │   │   │   ├── page.tsx      # 我的梦境列表
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── share/[token]/page.tsx
│   │   │   └── api/              # 一些 BFF 路由
│   │   ├── components/
│   │   ├── lib/
│   │   ├── public/
│   │   ├── tailwind.config.ts
│   │   ├── next.config.mjs
│   │   └── package.json
│   └── api/                      # Cloudflare Workers
│       ├── src/
│       │   ├── index.ts          # 入口
│       │   ├── routes/
│       │   │   ├── dreams.ts
│       │   │   ├── auth.ts
│       │   │   └── share.ts
│       │   ├── services/
│       │   │   ├── m3.ts         # M3 调用
│       │   │   ├── h3.ts         # H3 调用
│       │   │   ├── music.ts
│       │   │   ├── speech.ts
│       │   │   ├── composite.ts  # FFmpeg 容器调用
│       │   │   ├── storage.ts    # R2 操作
│       │   │   └── rate-limit.ts
│       │   ├── db/
│       │   │   └── schema.sql
│       │   └── types/
│       ├── wrangler.toml
│       ├── migrations/
│       └── package.json
├── packages/
│   └── shared/                   # 共享类型
│       ├── types/
│       └── package.json
├── docs/
│   ├── PRD.md                    # 本文件
│   ├── AGENTS.md                 # 工程边界
│   └── prompts/                  # M3 prompt 模板
├── AGENTS.md                     # 仓库根的 AGENTS.md
├── README.md
├── package.json                  # pnpm workspace
├── pnpm-workspace.yaml
└── .gitignore
```

### 8.5 关键依赖（pnpm）

```jsonc
// apps/web
{
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "typescript": "^5.5.0",
    "tailwindcss": "^3.4.0",
    "zustand": "^4.5.0",
    "next-auth": "^5.0.0-beta",
    "@dreamreel/shared": "workspace:*"
  }
}

// apps/api
{
  "dependencies": {
    "hono": "^4.5.0",
    "wrangler": "^3.70.0",
    "d1-orm": "^0.10.0",
    "jose": "^5.6.0",
    "zod": "^3.23.0"
  }
}
```

### 8.6 Cloudflare 资源清单

| 资源 | 名称 | 用途 |
|------|------|------|
| Pages Project | `dreamreel-web` | 前端 |
| Worker | `dreamreel-api` | 后端 API |
| D1 Database | `dreamreel-db` | 元数据 |
| R2 Bucket | `dreamreel-media` | 视频/音频 |
| KV Namespace | `dreamreel-kv` | OAuth state + 限流 + 分享 token |
| Container (按需) | `dreamreel-ffmpeg` | 视频合成 |

---

## 9. 非功能性需求

### 9.1 性能

| 指标 | 目标 |
|------|------|
| Landing 页 TTFB | < 200ms（Cloudflare 边缘） |
| Landing 页 LCP | < 1.5s |
| 完整生成时长 | ≤ 120 秒（p95） |
| 视频首帧 | < 2s（流式 R2 + range request） |
| 列表页加载 | < 500ms（10 条以内） |

### 9.2 可用性

| 指标 | 目标 |
|------|------|
| 系统可用性 | 99%（赛事期间，best effort） |
| 端到端成功率 | ≥ 90%（含部分镜头降级） |
| 4 镜头全成功 | ≥ 70% |

### 9.3 限流

| 资源 | 限制 |
|------|------|
| 未登录用户 | 3 次 / IP / 小时（更严格） |
| 登录用户 | 10 次 / 用户 / 小时 |
| 视频生成总成本 | 监控：每日 H3 调用不超过 500 次 |

### 9.4 安全与隐私

- 所有通信 HTTPS
- R2 视频不公开 URL，必须通过 Worker 鉴权后重定向
- 用户梦境内容不用于训练（项目 README 明确说明）
- 内容审核：调用前过 M3 的 moderation 或自建关键词黑名单
- 不存 IP 长期记录（仅限流 KV，1 小时滚动）

### 9.5 可观测性

- 所有 AI 调用记录耗时、token 数、失败原因
- Workers Logs（Cloudflare 自带）
- 关键事件发送 Webhook 到 Discord（赛事期间监控）

---

## 10. 验收标准（比赛提交级）

> 提交前必须 100% 通过。

### 10.1 必过项

- [ ] 完整跑通 1 个梦境：录音 → 生成 → 播放 → 保存
- [ ] 4 个 MiniMax 模型**都被调用**（在 README 中说明每个模型的调用点）
- [ ] 公开仓库，README 完整
- [ ] 部署到 Cloudflare Pages，公开 URL 可访问
- [ ] 3 分钟 demo 视频
- [ ] 在 X 发布 + 标记 @gmi_cloud
- [ ] 提交表单填写完整

### 10.2 加分项

- [ ] 我的梦境列表页可用
- [ ] 分享链接可用
- [ ] 移动端可用（不要求完美）
- [ ] 限流生效（自测 4 次后被限）
- [ ] 异常流程都有降级 UI

### 10.3 反向验证（不能出现的）

- ❌ 演示视频只有 Loom 录屏（必须是真实录屏 + 真实生成结果）
- ❌ 4 个模型有 1 个没真的调用（是 mock）
- ❌ README 是 AI 生成的空话
- ❌ 仓库 commit 只在最后一天

---

## 11. 风险与缓解

| 风险 | 等级 | 缓解 |
|------|------|------|
| H3 提示词难调，画面"不像梦境" | 🟡 中 | Day 1-2 集中迭代，准备 20+ 测试 case |
| H3 排队慢，超时 | 🟡 中 | 并行调用 + 重试 + 镜头降级 |
| M3 输出 JSON 格式不稳定 | 🟡 中 | 强 schema + JSON repair + 重试 |
| 视频合成失败（FFmpeg 容器） | 🟡 中 | 准备外部 ffmpeg API fallback |
| 14 天不够 | 🟢 低 | Must 项优先，Should 项看进度 |
| GMI Cloud API 限流 | 🟡 中 | 监控 + Worker 内 token bucket |
| OAuth 回调域名问题 | 🟢 低 | 提前在 GitHub/Google 配 callback |
| D1 写入慢 | 🟢 低 | 用 prepared statements + 批量 |
| H3 付费成本超 | 🟡 中 | 每天生成 demo 不超 10 次；选手测试用低分辨率 |

---

## 12. 附录 A：M3 Prompt 模板（核心资产）

### 12.1 剧本生成 Prompt

```
SYSTEM:
You are a director of oneiric cinema — a genre that adapts human dreams into 
7-8 second film scenes. Your aesthetic references: David Lynch, Lars von Trier, 
Andrei Tarkovsky, Gaspar Noé. You favor ambiguity, atmospheric tension, and 
the uncanny over plot clarity. You never explain the dream; you evoke it.

You output ONLY valid JSON conforming to the schema. No prose outside JSON.

USER:
The dreamer described:
"{{TRANSCRIPT}}"

Generate a 4-scene screenplay for a 30-second film adaptation.

Schema (strict):
{
  "scenes": [
    {
      "index": 1,
      "duration_seconds": 7.5,
      "visual_prompt": "<≤60 words, English, H3 prompt-style: composition, lighting, mood, camera movement>",
      "camera_movement": "<push | pull | pan | tilt | static | handheld | dolly>",
      "mood": "<3-5 words>"
    },
    ...4 scenes
  ],
  "narrative_arc": "<1 sentence, how the 4 scenes connect>",
  "voiceover": {
    "text": "<≤120 words English, Nolan-esque internal monologue, restrained, philosophical, never literal>",
    "voice": "warm-male-en",
    "pace": "slow"
  },
  "emotion_tag": "<one of: terror | love | surreal | nightmare | bliss | absurd | melancholic | cosmic | pursuit | falling>",
  "dream_type": "<one of: being-chased | falling | flying | arriving-too-late | teeth-falling-out | death | water | animals | unfamiliar-people | sexual | school-teacher | paralyzed | vivid-color | recurring-place>",
  "analysis": "<≤100 words, 1-2 sentence analysis in plain language, NOT explaining the dream, but offering a single poetic observation>"
}

Rules:
1. visual_prompt must be a single sentence fragment, suitable for H3.
2. Each scene's mood should be distinct yet thematically linked.
3. voiceover.text should NOT be a recap of the dream — it should be a reflection.
4. Never use the word "dream" or "sleep" in the visual prompts.
5. Embrace ambiguity. The dreamer should feel "yes, this is my dream" not "I understand my dream."
```

### 12.2 调试 checklist

- [ ] 输出 JSON 100% 可解析
- [ ] 4 个 scene 的 visual_prompt 平均 < 50 词
- [ ] 4 个 scene 的 mood 互不相同
- [ ] voiceover 不出现 "you dreamed" / "in your dream" 等元描述
- [ ] emotion_tag 一定在枚举中
- [ ] 50 个测试 case 通过

---

## 13. 附录 B：H3 Prompt 转换规则

M3 输出 `visual_prompt` 后，附加以下修饰词，形成最终 H3 prompt：

```
<visual_prompt>, cinematic, 24fps, anamorphic, shallow depth of field, 
<camera_movement>, dreamlike, surreal, soft grain, muted color palette, 
A24 film aesthetic, 16:9
```

示例：
- M3: `An upside-down library with infinite shelves stretching downward. A woman in white floats between the books. Water cascades up the staircase.`
- H3: `An upside-down library with infinite shelves stretching downward. A woman in white floats between the books. Water cascades up the staircase. cinematic, 24fps, anamorphic, shallow depth of field, slow dolly forward, dreamlike, surreal, soft grain, muted color palette, A24 film aesthetic, 16:9`

---

## 14. 附录 C：项目命名

| 候选 | 备注 |
|------|------|
| **DreamReel** | 首选：dream + reel（胶片卷轴） |
| Oneiric | 希腊语"梦" |
| Oneirograph | 罕见但强："梦的书写" |
| 梦匣子 | 中文版备选 |

最终采用 **DreamReel**。

---

## 15. 附录 D：Cloudflare 一键部署清单

提交前在 README 中给出"30 秒自部署"指引：

```bash
# 1. 克隆
git clone https://github.com/<owner>/dreamreel.git
cd dreamreel

# 2. 安装
pnpm install

# 3. 登录 Cloudflare
pnpm wrangler login

# 4. 创建资源
pnpm wrangler d1 create dreamreel-db
pnpm wrangler r2 bucket create dreamreel-media
pnpm wrangler kv:namespace create dreamreel-kv

# 5. 填入 wrangler.toml

# 6. 跑迁移
pnpm wrangler d1 migrations apply dreamreel-db

# 7. 部署
pnpm --filter web deploy      # Pages
pnpm --filter api deploy      # Worker
```

---

**END OF PRD v1.0**
