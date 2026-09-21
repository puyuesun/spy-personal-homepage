# EXT1.1 数字分身部署说明

> 当前状态：EXT1.1 前端和 `docs/` 已同步；DeepSeek Edge Function、Supabase 私有表、限额和 15 元预算保护沿用 EXT1，无需重新部署。  
> Cloudflare Turnstile 尚未配置，当前临时使用无验证模式加严格限额保护。

## 1. 服务端沿用项

- Edge Function：`twin-chat`
- 公开地址：`https://mkqqhgymlcpkykckzhrh.supabase.co/functions/v1/twin-chat`
- Supabase 表：`twin_sessions`、`twin_rate_limits`、`twin_usage`
- Monthly budget：15 元；约 12 元告警
- 单会话：8 条
- 单 IP：每日 20 条
- 全站：每日 120 条
- 不保存聊天正文，只保存哈希标识、次数、token 和费用

## 2. 本次前端更新

- `index.EXT1.1.html`
- `style.EXT1.1.css`
- `script.EXT1.1.js`
- `config.EXT1.1.js`
- `knowledge.EXT1.1.json`
- `avatar_xiaoyue_open.EXT1.1.png`
- `avatar_xiaoyue_blink.EXT1.1.png`

同步位置：`docs/index.html` 与 `docs/` 下对应 EXT1.1 资源。

## 3. 修复内容

- 首页“向下滚动”改为链接，点击进入 `#about`。
- 顶部新增“首页 Home”，点击回到 `#top`。
- 小月使用 Q 版睁眼 / 闭眼 PNG，闭眼图每 5.2 秒短暂覆盖眼睛区域。
- 弹窗头部改为纵向流式布局，在线状态、AI DIGITAL TWIN、姓名和副标题不再重叠。

## 4. Turnstile 待办

1. 在 Cloudflare 创建 Turnstile Widget，Hostname 使用 `puyuesun.github.io`。
2. 设置 Supabase Secret：
   - `TURNSTILE_SECRET_KEY`
   - 将 `TWIN_ALLOW_UNVERIFIED` 改为 `false`
3. 将公开 Site Key 填入 `config.EXT1.1.js`。
4. 同步 `config.EXT1.1.js` 到 `docs/`。
5. 重新验证人机验证、限额和 FAQ 降级。

## 5. 更新知识库

编辑 `knowledge.EXT1.1.json` 后同步到 `docs/knowledge.EXT1.1.json`。Edge Function 会优先读取远端知识文件，读取失败时使用当前内置知识回退。