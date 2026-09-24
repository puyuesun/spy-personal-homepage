# EXT1.1 版本说明 — 首页导航与“小月”Q 版形象修订

> **版本号**：EXT1.1  
> **完成日期**：2026-09-21  
> **基线版本**：EXT1  
> **本版本主题**：首页滚动指示可点击、顶部新增“首页”、用 Q 版人物替换小月形象、修复弹窗标题重叠。  
> **当前状态**：前端已部署；DeepSeek / Supabase 服务端逻辑沿用 EXT1，不改函数、表或密钥；Turnstile 仍待补。

---

## 1. 本版本做了什么

- 首屏“向下滚动”指示改为链接，点击或按键盘后平滑进入“关于”区。
- 顶部导航在“关于”左侧新增“首页 Home”，点击回到页面最顶端。
- 将小月原来的原创 SVG 角色替换为两张 Q 版人物透明 PNG。
- 睁眼图常驻，闭眼图在眼睛区域羽化覆盖，每 5.2 秒短暂闪现一次。
- 保留呼吸、思考、说话和离线状态效果。
- 弹窗头部改为正常纵向流式布局，在线状态、AI DIGITAL TWIN、姓名、副标题不再重叠。
- 生成 EXT1.1 深色 / 浅色整页截图、弹窗截图和 390px 移动端截图。
- 桌面对话框扩大为 440×700px，小月人物缩小到约 112px，消息区扩大到约 338px。
- 深色与浅色主题的聊天输入文字、发送消息气泡均改为高对比度。
- 联系区“简历”卡片改为“微信 WeChat / spy_0809”。
- 同步 `docs/`，不创建快照，不影响 V4。

---

## 2. 文件清单

| 文件 | 说明 |
|---|---|
| `index.EXT1.1.html` | EXT1.1 页面结构 |
| `style.EXT1.1.css` | EXT1.1 样式与 Q 版角色动效 |
| `script.EXT1.1.js` | 沿用 EXT1 交互逻辑 |
| `config.EXT1.1.js` | 公开 Supabase 与 Edge Function 配置 |
| `knowledge.EXT1.1.json` | 公开知识与 FAQ |
| `avatar_xiaoyue_open.EXT1.1.png` | 睁眼 Q 版人物透明素材 |
| `avatar_xiaoyue_blink.EXT1.1.png` | 闭眼 Q 版人物透明素材 |
| `edge/twin-chat.EXT1.1.ts` | 当前 Edge Function 版本化留档 |
| `supabase_twin.EXT1.1.sql` | 当前 Supabase 私有表与函数留档 |
| `EXT1.1部署说明.md` | 部署与维护说明 |
| `EXT1.1已实现功能.md` | 功能清单 |
| `screenshot_EXT1.1_full.png` | 深色整页截图 |
| `screenshot_EXT1.1_light_full.png` | 浅色整页截图 |
| `screenshot_EXT1.1_chat_dark.png` | 深色弹窗截图 |
| `screenshot_EXT1.1_chat_light.png` | 浅色弹窗截图 |
| `screenshot_EXT1.1_mobile.png` | 390px 移动端截图 |

---

## 3. 与上一版本（EXT1）相比的改动

### 新增

- 首页“向下滚动”点击进入“关于”。
- 顶部“首页 Home”导航。
- Q 版睁眼 / 闭眼人物素材及眨眼效果。
- EXT1.1 版本目录、文档与截图。

### 修改

- 小月由 SVG 动画角色改为 Q 版人物图片。
- 弹窗头部由绝对定位改为纵向流式布局，解决标题与“在线 ·”重叠。
- 小月说话动效改为轻微起伏与缩放，不再使用嘴巴张开动画。
- 输入框文字和光标颜色改为高对比度。
- 对话框加宽、人物缩小、消息显示区扩大。
- 页面页脚版本改为 EXT1.1。

### 保留

- 深色 / 浅色主题、粒子、交互网格、玻璃拟态和 Feedback。
- 数字分身的真实 DeepSeek 流式回答。
- 单会话 8 条、单 IP 每日 20 条、全站每日 120 条。
- 15 元月度预算保护和“不保存聊天正文”。

### 未改动

- V1–V3 原文件不改。
- EXT1 原文件不改。
- `twin-chat` 服务端函数、Supabase 表和 Secrets 不改。
- 不创建快照。

---

## 4. 验证记录

| 检查项 | 结果 |
|---|---|
| 首页滚动指示点击并进入关于区 | 通过 |
| “首页”点击并回到顶部 | 通过 |
| 滚动指示键盘可操作 | 通过原生 `<a>` Enter 触发 |
| Q 版睁眼 / 闭眼素材加载 | 2048 × 2048，均 HTTP 200 |
| 眨眼动画 | `twin-image-blink` 正常启用 |
| 标题与在线状态重叠 | 无重叠 |
| 深色 / 浅色聊天窗 | 通过 |
| 390px 移动端 | 无横向溢出 |
| 本地资料问答矩阵 | 38 条通过 |
| 真实 DeepSeek 流式回答 | 通过 |
| 浏览器控制台 | 0 条 error / warning |

---

## 5. 当前线上状态

- GitHub Pages 入口：`https://puyuesun.github.io/spy-personal-homepage/`
- Edge Function：`https://mkqqhgymlcpkykckzhrh.supabase.co/functions/v1/twin-chat`（实际配置无空格）
- Turnstile：待补，当前使用严格次数和预算限制。

---

*完成时间：2026-09-21　|　EXT1.1-数字分身*