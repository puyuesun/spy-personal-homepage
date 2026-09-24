/* EXT1.1 数字分身公开配置 —— 此文件只能出现公开信息。
   DeepSeek API Key、Turnstile Secret、Supabase service_role 严禁写入前端。 */
window.SPY_SUPABASE_CONFIG = {
  url: "https://mkqqhgymlcpkykckzhrh.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rcXFoZ3ltbGNwa3lrY2t6aHJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2NDc4MzAsImV4cCI6MjEwNTIyMzgzMH0.ZYnugCI2kJGVowAUqbcG454mAnviRw5jRoSDaQiSkHM",
  table: "feedback"
};

window.SPY_TWIN_CONFIG = {
  /* 部署 Edge Function 后填写，例如：
     https://mkqqhgymlcpkykckzhrh.supabase.co/functions/v1/twin-chat
     留空时自动使用本地资料速答，不会请求模型。 */
  endpoint: "https://mkqqhgymlcpkykckzhrh.supabase.co/functions/v1/twin-chat",
  knowledgeUrl: "knowledge.EXT1.1.json?v=20260924e",
  turnstileSiteKey: "",
  requestTimeoutMs: 25000,
  maxInputLength: 500,
  maxHistoryMessages: 8,
  privacyLabel: "对话内容会发送给 DeepSeek 生成回答；本站不保存聊天正文。 / Messages are sent to DeepSeek for generation. This site does not store chat transcripts."
};