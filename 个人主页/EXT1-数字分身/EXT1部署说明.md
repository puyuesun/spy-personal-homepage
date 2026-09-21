# EXT1 数字分身部署说明

> 当前状态：前端、知识库、Supabase SQL、Secrets 与 `twin-chat` Edge Function 已部署，真实 DeepSeek 流式回答测试通过。  
> Cloudflare Turnstile 尚未配置，当前临时使用单会话 8 条、单 IP 20 条、全站 120 条和 15 元月预算保护。

## 1. 部署前准备

1. 在 DeepSeek 开放平台创建 API Key，并确认账户有少量余额。
2. 在 Cloudflare Turnstile 创建站点：
   - Hostname：`puyuesun.github.io`
   - Widget 模式：Managed / Invisible
   - 保存 **Site Key** 和 **Secret Key**
3. 在 Supabase 项目中打开 SQL Editor，执行：
   - `个人主页/EXT1-数字分身/supabase_twin.EXT1.sql`
4. 确认 Supabase 项目可部署 Edge Functions。

## 2. 服务端 Secrets

只通过 Supabase Dashboard 或 CLI 设置，不要把值写入前端文件或公开仓库。

必需：

```text
DEEPSEEK_API_KEY=你的 DeepSeek API Key
TURNSTILE_SECRET_KEY=你的 Cloudflare Turnstile Secret
TWIN_KNOWLEDGE_URL=https://puyuesun.github.io/spy-personal-homepage/knowledge.EXT1.json
TWIN_ALLOWED_ORIGINS=https://puyuesun.github.io
TWIN_MONTHLY_BUDGET_CNY=15
```

推荐设置：

```text
TWIN_HASH_SALT=一串随机长字符串
TWIN_ENABLED=true
TWIN_SESSION_LIMIT=8
TWIN_IP_DAILY_LIMIT=20
TWIN_GLOBAL_DAILY_LIMIT=120
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_INPUT_CNY_PER_MILLION=2
DEEPSEEK_OUTPUT_CNY_PER_MILLION=8
TWIN_STYLE_PROFILE=活力、热情、真诚、简洁；避免夸张承诺；按访客语言回答。
```

说明：输入/输出单价只是保守预算参数，用于本地费用熔断，不代表 DeepSeek 当前报价。上线时按实际价格更新。

## 3. 部署 Edge Function

源码有两个位置：

- 版本化留档：`个人主页/EXT1-数字分身/edge/twin-chat.EXT1.ts`
- Supabase 部署目录：`supabase/functions/twin-chat/index.ts`

使用 Supabase CLI：

```powershell
supabase functions deploy twin-chat --project-ref mkqqhgymlcpkykckzhrh --no-verify-jwt
```

本函数使用 Turnstile、哈希 IP、会话限额、全站限额和预算熔断，因此不使用 Supabase JWT，而是以 `--no-verify-jwt` 部署。不要把 `service_role` 放到前端。

## 4. 前端启用

函数地址已写入 `config.EXT1.js`：

```js
endpoint: "https://mkqqhgymlcpkykckzhrh.supabase.co/functions/v1/twin-chat"
```

后续更新配置时编辑 `个人主页/EXT1-数字分身/config.EXT1.js`：

```js
endpoint: "https://mkqqhgymlcpkykckzhrh.supabase.co/functions/v1/twin-chat",
turnstileSiteKey: "你的公开 Turnstile Site Key"
```

Site Key 可以公开；Secret Key 不行。

然后同步发布镜像：

```powershell
Copy-Item '个人主页/EXT1-数字分身/config.EXT1.js' 'docs/config.EXT1.js' -Force
Copy-Item '个人主页/EXT1-数字分身/index.EXT1.html' 'docs/index.html' -Force
```

## 5. 上线前测试

1. 先设置 `TWIN_MOCK=true` 和 `TWIN_ALLOW_UNVERIFIED=true`，确认 Edge Function 能返回资料速答。
2. 再关闭两个测试开关，使用真实 Turnstile 与 DeepSeek 测试。
3. 检查：
   - 中文与英文回答自动切换
   - 回答只依据 `knowledge.EXT1.json`
   - 限额达到后显示 FAQ 降级提示
   - 预算达到 15 元时模型停止调用
   - `twin_rate_limits` 和 `twin_usage` 中没有聊天正文
   - 浏览器 Network 中不存在 DeepSeek Key、Turnstile Secret 或 `service_role`

## 6. 更新知识库

编辑 `个人主页/EXT1-数字分身/knowledge.EXT1.json`，复制到：

```text
docs/knowledge.EXT1.json
```

GitHub Pages 更新后，Edge Function 会在下一次请求读取新版知识。缺失项目、简历、奖项等必须继续明确写为“暂未公开”，不得让模型猜测。