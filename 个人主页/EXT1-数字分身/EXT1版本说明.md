# EXT1 版本说明 — “小月”AI 数字分身

> **版本号**：EXT1  
> **完成日期**：2026-09-18  
> **基线版本**：V3  
> **本版本主题**：在个人主页右下角接入原创 2D 轻量动态角色“小月”，提供公开可用的 AI 数字分身聊天体验。  
> **技术栈**：原生 HTML / CSS / JavaScript + SSE + Supabase Edge Function + DeepSeek + Cloudflare Turnstile  
> **当前状态**：前端、知识库、Supabase SQL、Secrets、Edge Function 与真实 DeepSeek 流式问答已完成；Turnstile 待补，当前使用严格次数和预算限制临时保护。

---

## 1. 本版本做了什么

EXT1 在保留 V3 主页、主题开关、粒子、交互网格和 Feedback 功能的基础上，新增一个独立的数字分身扩展：

- 右下角新增“问问小月”悬浮入口，排在 Feedback 上方。
- 聊天窗顶部使用原创 SVG 绘制轻量 2D 科技女孩，不使用真人照片。
- 角色支持待机呼吸、眨眼、思考、说话与离线状态。
- 聊天支持会话内记忆、建议问题、流式输出、自动语言跟随与键盘操作。
- 没有后端服务时自动切换本地资料速答，不会出现空白窗口。
- 服务端使用 Supabase Edge Function 代理 DeepSeek，浏览器不接触模型密钥。
- Cloudflare Turnstile、会话/IP/全站限额与 15 元月度预算熔断共同防止滥用。
- 只将哈希标识、请求次数、token 和费用写入 Supabase，不保存聊天正文。
- `docs/` 已同步为 EXT1 发布镜像。

---

## 2. 文件清单

| 文件 | 说明 |
|---|---|
| `index.EXT1.html` | 完整主页 + 数字分身入口、聊天窗和 SVG 角色 |
| `style.EXT1.css` | V3 全站样式 + 数字分身深浅主题、响应式与动画 |
| `script.EXT1.js` | V3 交互 + 会话记忆、SSE、Turnstile 与 FAQ 降级 |
| `config.EXT1.js` | 公开配置；当前 `endpoint` 与 Turnstile Site Key 留空 |
| `knowledge.EXT1.json` | 版本化公开知识库与中英文 FAQ |
| `supabase_twin.EXT1.sql` | 私有表、RLS、配额函数、费用记录函数 |
| `edge/twin-chat.EXT1.ts` | Edge Function 版本化源码 |
| `EXT1部署说明.md` | DeepSeek、Turnstile、Supabase 部署步骤 |
| `EXT1已实现功能.md` | 功能与验证清单 |
| `EXT1版本说明.md` | 本文件 |
| `screenshot_EXT1_full.png` | 深色整页截图 |
| `screenshot_EXT1_light_full.png` | 浅色整页截图 |
| `screenshot_EXT1_chat_dark.png` | 深色聊天窗截图 |
| `screenshot_EXT1_chat_light.png` | 浅色聊天窗截图 |
| `screenshot_EXT1_mobile.png` | 390 px 移动端聊天窗截图 |
| `supabase_feedback.EXT1.sql` | 从 V3 保留的 Feedback 数据表脚本 |

部署目录：

- `supabase/functions/twin-chat/index.ts`
- `docs/index.html`
- `docs/index.EXT1.html`
- `docs/style.EXT1.css`
- `docs/script.EXT1.js`
- `docs/config.EXT1.js`
- `docs/knowledge.EXT1.json`

---

## 3. 与上一版本（V3）相比的改动

### 3.1 新增

- 新增右下角数字分身悬浮入口。
- 新增原创 SVG 2D 角色与小月品牌形象。
- 新增数字分身聊天窗、建议问题、输入计数与自动滚动。
- 新增待机、眨眼、思考、说话、离线角色状态。
- 新增会话内多轮上下文，刷新后清空。
- 新增本地资料速答与 FAQ 降级。
- 新增 Supabase Edge Function、DeepSeek 流式接口和 Turnstile 验证。
- 新增会话、IP、全站三层限额和 15 元月度费用熔断。
- 新增 `twin_sessions`、`twin_rate_limits`、`twin_usage` 私有表。
- 新增版本化 `knowledge.EXT1.json`。
- 新增 EXT1 部署说明、版本说明与功能清单。
- 新增 5 张 EXT1 验证截图。
- 新增 `docs/` EXT1 镜像，但保留旧 V3 文件。

### 3.2 保留

- V3 的主页内容、导航、主题开关、3D 粒子、Shimmer、交互网格和玻璃拟态。
- V3 Feedback 按钮、反馈弹窗与 Supabase 写入逻辑。
- 中英双语页面内容和响应式布局。
- 邮箱复制与深浅主题持久化。

### 3.3 未改动

- V1、V2.1、V2.2、V2.3 和 V3 源文件均未修改。
- V4 尚未开始，因此 EXT1 以 V3 作为基线，之后 V4 完成时需要再做一次兼容合并。
- 未创建快照，因为用户没有明确要求“创建快照”。

---

## 4. 内容状态

| 内容 | 状态 |
|---|---|
| 姓名、学校、专业、年级、技能、兴趣、邮箱 | 真实 |
| 数字分身身份、AI 边界 | 已完成 |
| 项目、奖项、简历 | 明确为“暂未公开” |
| 个人主页项目介绍 | 已加入知识库 |
| 风格摘要 | 先使用“活力、热情、真诚、简洁”临时风格 |
| 脱敏聊天记录 | 待用户提供后校准 |
| DeepSeek Edge Function | ✅ 已部署并完成真实流式测试 |
| Turnstile | 🟡 待配置，当前由限额与预算保护 |
| 真正 Live2D、3D、语音 | 不在首版范围 |

---

## 5. 数据与安全

- 前端只显示 Supabase anon key、Edge Function URL 与公开 Turnstile Site Key。
- DeepSeek API Key、Turnstile Secret、Supabase `service_role` 只允许保存在 Supabase Secrets。
- 不保存聊天正文、系统提示或模型回答。
- 限额表只存储会话哈希、IP 哈希、日期、次数、token 和费用。
- 日限额数据超过 30 天自动清理。
- `TWIN_ENABLED=false` 可立即关闭模型调用。
- 预算达到 15 元后停止模型调用并切换 FAQ 降级。

---

## 6. 验证记录

| 检查项 | 结果 |
|---|---|
| HTML / CSS / JavaScript / JSON 可加载 | 通过，全部 HTTP 200 |
| 数字分身入口与 Feedback 共存 | 通过，桌面间距 16 px |
| 390 px 移动端 | 通过，无横向溢出，入口间距 13 px |
| 本地资料问答矩阵 | 30 / 30 通过 |
| 深浅主题 | 通过 |
| 浏览器控制台 | 0 条 error / warning |
| 整页截图 | 深色 1440 × 4152；浅色 1440 × 4152 |
| 聊天窗截图 | 深色 / 浅色 1440 × 1000 |
| 移动端截图 | 390 × 844 |
| Edge Function TypeScript 语法 | 通过 Node `.mts` 语法检查 |
| 密钥扫描 | 未发现 DeepSeek Key、Turnstile Secret 或 service_role 实际值 |

---

## 7. 尚未完成的部署

以下步骤必须由用户提供账号或密钥后执行：

1. 在 Supabase SQL Editor 执行 `supabase_twin.EXT1.sql`。
2. 设置 `DEEPSEEK_API_KEY`、`TURNSTILE_SECRET_KEY`、`TWIN_HASH_SALT` 等 Secrets。
3. 部署 `twin-chat` Edge Function。
4. 将 Edge Function URL 与公开 Turnstile Site Key 写入 `config.EXT1.js`。
5. 用真实问题验证 DeepSeek 流式回答、限额、预算熔断与降级。
6. 将 `config.EXT1.js` 同步到 `docs/`，再提交并发布 GitHub Pages。

---

*完成时间：2026-09-18　|　EXT1-数字分身*