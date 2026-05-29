export const PROVIDER_PRESETS = [
  {
    providerType: "kimi",
    label: "Kimi / Moonshot",
    protocol: "openai_chat",
    baseUrl: "https://api.moonshot.cn/v1",
    authType: "bearer",
  },
  {
    providerType: "deepseek",
    label: "DeepSeek OpenAI-compatible",
    protocol: "openai_chat",
    baseUrl: "https://api.deepseek.com/v1",
    authType: "bearer",
  },
  {
    providerType: "mimo",
    label: "Xiaomi MiMo OpenAI-compatible",
    protocol: "openai_chat",
    baseUrl: "https://api.xiaomimimo.com/v1",
    authType: "bearer",
  },
  {
    providerType: "openai_compatible",
    label: "Custom OpenAI-compatible",
    protocol: "openai_chat",
    baseUrl: "https://example.com/v1",
    authType: "bearer",
  },
  {
    providerType: "anthropic_compatible",
    label: "Custom Anthropic-compatible",
    protocol: "anthropic_messages",
    baseUrl: "https://api.anthropic.com/v1",
    authType: "x-api-key",
  },
] as const;
